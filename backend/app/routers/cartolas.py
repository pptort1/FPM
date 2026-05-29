from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
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


@router.post("/upload")
def upload_cartola(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Solo se aceptan archivos Excel (.xlsx / .xls)")

    contenido = file.file.read()
    try:
        movimientos = parsear_cartola(contenido, file.filename)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Firmas ya en DB (para dedup rápido)
    firmas_db: set[str] = set(
        r[0] for r in db.execute(
            select(Transaccion.firma_dedup).where(Transaccion.firma_dedup.isnot(None))
        ).all()
    )

    stats = {"agregados": 0, "duplicados": 0, "excluidos": 0, "ingresos": 0, "revision": 0}
    nuevos: list[Transaccion] = []

    for mov in movimientos:
        if mov["tipo"] == "excluido":
            stats["excluidos"] += 1
            continue
        if mov["tipo"] == "ingreso":
            stats["ingresos"] += 1
            continue

        firma = mov["firma"]
        if firma and firma in firmas_db:
            stats["duplicados"] += 1
            continue

        # Clasificar
        cuenta, cc, tipo_doc, confianza = clasificar(
            mov["descripcion_original"], mov["rut"]
        )

        if not cuenta:
            # Sin clasificar → va a revisión con cuenta vacía
            stats["revision"] += 1
            cuenta     = ""
            cc         = ""
            tipo_doc   = "S"
            nombre_cta = "Sin clasificar"
        else:
            nombre_cta = PLAN[cuenta][0]

        monto = mov["monto"]
        iva   = calcular_iva(monto, tipo_doc)
        neto  = monto - iva

        # Mes devengo: sueldos (CC2) devengan mes anterior
        ajuste = -1 if cc == "CC2" and tipo_doc == "S" else 0

        estado = "validado" if confianza >= 90 else "pendiente"
        if not cuenta:
            estado = "revision"

        tx = Transaccion(
            fecha_pago     = mov["fecha"],
            mes_devengo    = _mes_devengo(mov["fecha"], ajuste),
            descripcion    = mov["descripcion_original"],
            proveedor      = mov.get("comercio") or mov.get("rut"),
            monto_total    = monto,
            tipo_doc       = tipo_doc,
            forma_pago     = "Credito" if mov["descripcion_original"].upper().startswith("COMPRA") else "Debito",
            nombre_cuenta  = nombre_cta,
            iva            = iva,
            monto_neto     = neto,
            cuenta         = cuenta,
            cc             = cc,
            archivo_origen = mov["archivo"],
            estado         = estado,
            firma_dedup    = firma,
            rut            = mov.get("rut"),
            confianza      = confianza,
        )
        nuevos.append(tx)
        if firma:
            firmas_db.add(firma)
        stats["agregados"] += 1

    if nuevos:
        db.add_all(nuevos)
        db.commit()

    return {
        **stats,
        "total_leidos": len(movimientos),
        "archivo": file.filename,
    }
