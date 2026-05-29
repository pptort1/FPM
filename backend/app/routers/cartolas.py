from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Optional
import datetime

from ..database import get_db
from ..models import Transaccion
from ..parser_santander import parsear_cartola
from ..clasificador import clasificar, calcular_iva, PLAN

router = APIRouter(prefix="/api/cartolas", tags=["cartolas"])


def _mes_devengo(fecha: datetime.date, ajuste: int = 0) -> str:
    mes  = fecha.month + ajuste
    anio = fecha.year
    if mes <= 0:
        mes, anio = mes + 12, anio - 1
    return f"{anio}-{mes:02d}"


def _clasificar_movimiento(mov: dict) -> dict:
    """Clasifica un movimiento y devuelve los campos listos para Transaccion."""
    cuenta, cc, tipo_doc, confianza = clasificar(
        mov["descripcion_original"], mov.get("rut")
    )
    nombre_cta = PLAN[cuenta][0] if cuenta else "Sin clasificar"
    monto      = mov["monto"]
    iva        = calcular_iva(monto, tipo_doc)
    neto       = monto - iva
    ajuste     = -1 if cc == "CC2" and tipo_doc == "S" else 0
    estado     = "validado" if confianza >= 90 else ("revision" if not cuenta else "pendiente")

    return {
        "fecha_pago":    mov["fecha"],
        "mes_devengo":  _mes_devengo(mov["fecha"], ajuste),
        "descripcion":  mov["descripcion_original"],
        "proveedor":    mov.get("comercio") or mov.get("rut"),
        "monto_total":  monto,
        "tipo_doc":     tipo_doc,
        "forma_pago":   "Credito" if mov["descripcion_original"].upper().startswith("COMPRA") else "Debito",
        "nombre_cuenta": nombre_cta,
        "iva":           iva,
        "monto_neto":    neto,
        "cuenta":        cuenta,
        "cc":            cc,
        "archivo_origen": mov["archivo"],
        "estado":        estado,
        "firma_dedup":   mov.get("firma"),
        "rut":           mov.get("rut"),
        "confianza":     confianza,
    }


# ── Preview ────────────────────────────────────────────────────────────────

@router.post("/preview")
def preview_cartola(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Parsea y clasifica la cartola SIN guardar.
    Devuelve cada movimiento con su estado y clasificación propuesta.
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Solo se aceptan archivos Excel (.xlsx / .xls)")

    contenido = file.file.read()
    try:
        movimientos = parsear_cartola(contenido, file.filename)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Firmas ya en DB
    firmas_db: set[str] = set(
        r[0] for r in db.execute(
            select(Transaccion.firma_dedup).where(Transaccion.firma_dedup.isnot(None))
        ).all()
    )

    filas = []
    stats = {"nuevos": 0, "duplicados": 0, "excluidos": 0, "ingresos": 0}

    for mov in movimientos:
        if mov["tipo"] == "excluido":
            stats["excluidos"] += 1
            filas.append({
                "tipo_mov": "excluido",
                "fecha": str(mov["fecha"]),
                "monto": mov["monto"],
                "descripcion": mov["descripcion_original"],
                "estado_import": "excluido",
                "seleccionado": False,
            })
            continue

        if mov["tipo"] == "ingreso":
            stats["ingresos"] += 1
            filas.append({
                "tipo_mov": "ingreso",
                "fecha": str(mov["fecha"]),
                "monto": mov["monto"],
                "descripcion": mov["descripcion_original"],
                "estado_import": "ingreso",
                "seleccionado": False,
            })
            continue

        firma = mov.get("firma")
        if firma and firma in firmas_db:
            stats["duplicados"] += 1
            filas.append({
                "tipo_mov": "egreso",
                "fecha": str(mov["fecha"]),
                "monto": mov["monto"],
                "descripcion": mov["descripcion_original"],
                "estado_import": "duplicado",
                "seleccionado": False,
                "firma": firma,
            })
            continue

        # Nuevo egreso: clasificar
        cl = _clasificar_movimiento(mov)
        stats["nuevos"] += 1
        filas.append({
            "tipo_mov":     "egreso",
            "fecha":        str(cl["fecha_pago"]),
            "mes_devengo":  cl["mes_devengo"],
            "monto":        cl["monto_total"],
            "descripcion":  cl["descripcion"],
            "proveedor":    cl["proveedor"],
            "rut":          cl["rut"],
            "cuenta":       cl["cuenta"],
            "cc":           cl["cc"],
            "nombre_cuenta": cl["nombre_cuenta"],
            "tipo_doc":     cl["tipo_doc"],
            "forma_pago":   cl["forma_pago"],
            "iva":          cl["iva"],
            "monto_neto":   cl["monto_neto"],
            "confianza":    cl["confianza"],
            "estado_import": "sin_clasificar" if not cl["cuenta"] else "nuevo",
            "seleccionado": bool(cl["cuenta"]),   # pre-selecciona los clasificados
            "firma":        firma,
        })

    return {
        "archivo": file.filename,
        "stats":   stats,
        "filas":   filas,
    }


# ── Confirmar ──────────────────────────────────────────────────────────────

class FilaConfirmar(BaseModel):
    fecha:         str
    mes_devengo:   str
    descripcion:   str
    proveedor:     Optional[str] = None
    rut:           Optional[str] = None
    monto_total:   int
    tipo_doc:      str
    forma_pago:    str
    nombre_cuenta: Optional[str] = None
    iva:           int
    monto_neto:    int
    cuenta:        str
    cc:            str
    archivo_origen: Optional[str] = None
    firma:         Optional[str] = None
    confianza:     int = 0

class ConfirmarBody(BaseModel):
    filas: list[FilaConfirmar]

@router.post("/confirmar")
def confirmar_cartola(
    body: ConfirmarBody,
    db: Session = Depends(get_db),
):
    """
    Guarda solo las filas seleccionadas por el usuario.
    Las no-seleccionadas no se marcan como duplicadas
    (así pueden importarse en la próxima carga).
    """
    # Firmas ya en DB (doble check)
    firmas_db: set[str] = set(
        r[0] for r in db.execute(
            select(Transaccion.firma_dedup).where(Transaccion.firma_dedup.isnot(None))
        ).all()
    )

    nuevos = []
    skipped = 0
    for f in body.filas:
        if f.firma and f.firma in firmas_db:
            skipped += 1
            continue
        estado = "validado" if f.confianza >= 90 else ("revision" if not f.cuenta else "pendiente")
        tx = Transaccion(
            fecha_pago     = datetime.date.fromisoformat(f.fecha),
            mes_devengo    = f.mes_devengo,
            descripcion    = f.descripcion,
            proveedor      = f.proveedor,
            monto_total    = f.monto_total,
            tipo_doc       = f.tipo_doc,
            forma_pago     = f.forma_pago,
            nombre_cuenta  = f.nombre_cuenta,
            iva            = f.iva,
            monto_neto     = f.monto_neto,
            cuenta         = f.cuenta,
            cc             = f.cc,
            archivo_origen = f.archivo_origen,
            estado         = estado,
            firma_dedup    = f.firma,
            rut            = f.rut,
            confianza      = f.confianza,
        )
        nuevos.append(tx)
        if f.firma:
            firmas_db.add(f.firma)

    if nuevos:
        db.add_all(nuevos)
        db.commit()

    return {"agregados": len(nuevos), "skipped": skipped}
