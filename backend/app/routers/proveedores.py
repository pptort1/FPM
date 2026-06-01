from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import Optional
import io, re, openpyxl
from ..database import get_db
from ..models import ProveedorMaestro, Transaccion

router = APIRouter(prefix="/api/proveedores", tags=["proveedores"])


def _norm_rut(s: str) -> str:
    return re.sub(r"[.\s]", "", str(s or "")).upper().strip()

NOMBRES_CONOCIDOS = {
    "76034515-6": "CCE Arquitectos Ltda",
    "5279758-6":  "Luis Felipe Ibieta",
    "19567111-7": "María José Grez",
    "17403946-1": "Jerónimo de Alderete (Arriendo)",
    "17083572-7": "María Ignacia Grez",
    "18022436-K": "Ángeles Grez",
    "19324205-7": "Catalina Cuevas",
    "21093602-5": "Nataly Morales",
    "22520465-9": "Carolina Gutiérrez",
    "19606694-2": "Josefina Landaeta",
    "96719010-1": "Inmobiliaria Sierras de Bellavista",
    "10325328-4": "Patricia Guijuelos",
    "77406473-7": "Café del Parque SPA",
    "96794400-9": "CAPEX Local",
    "77423092-0": "Computador",
    "56059620-0": "GGCC / Arriendo Oficina",
    "6551524-5":  "Despachos Horeca",
}


class ProveedorIn(BaseModel):
    nombre: str
    cuenta: Optional[str] = None
    cc:     Optional[str] = None


@router.get("/lista")
def lista_proveedores(db: Session = Depends(get_db)):
    """Lista de proveedores únicos del historial de egresos + maestro."""
    # Del maestro
    maestro = {r.rut: r.nombre for r in db.execute(select(ProveedorMaestro)).scalars().all()}
    # Del historial de transacciones
    hist = db.execute(
        select(Transaccion.proveedor)
        .where(Transaccion.proveedor.isnot(None))
        .where(Transaccion.proveedor != "")
        .distinct()
        .order_by(Transaccion.proveedor)
    ).scalars().all()
    # Unir sin duplicados
    todos = sorted(set(list(maestro.values()) + list(NOMBRES_CONOCIDOS.values()) + [p for p in hist if p]))
    return todos


@router.get("/{rut}")
def get_proveedor(rut: str, db: Session = Depends(get_db)):
    rut_norm = rut.replace(".", "").upper()
    pm = db.get(ProveedorMaestro, rut_norm)
    if pm:
        return {"rut": pm.rut, "nombre": pm.nombre, "cuenta": pm.cuenta, "cc": pm.cc}
    nombre = NOMBRES_CONOCIDOS.get(rut_norm)
    if nombre:
        return {"rut": rut_norm, "nombre": nombre, "conocido": True}
    return {"rut": rut_norm, "nombre": None}


@router.put("/{rut}")
def upsert_proveedor(rut: str, body: ProveedorIn, db: Session = Depends(get_db)):
    rut_norm = rut.replace(".", "").upper()
    pm = db.get(ProveedorMaestro, rut_norm)
    if pm:
        pm.nombre = body.nombre
        if body.cuenta: pm.cuenta = body.cuenta
        if body.cc:     pm.cc     = body.cc
    else:
        pm = ProveedorMaestro(rut=rut_norm, nombre=body.nombre,
                              cuenta=body.cuenta, cc=body.cc)
        db.add(pm)
    db.query(Transaccion).filter(
        Transaccion.rut == rut_norm,
        Transaccion.proveedor == rut_norm,
    ).update({"proveedor": body.nombre})
    db.commit()
    return {"rut": rut_norm, "nombre": body.nombre}


@router.get("")
def listar_proveedores(db: Session = Depends(get_db)):
    rows = db.execute(select(ProveedorMaestro).order_by(ProveedorMaestro.nombre)).scalars().all()
    return [{"rut": r.rut, "nombre": r.nombre, "cuenta": r.cuenta, "cc": r.cc} for r in rows]


@router.post("/importar")
def importar_maestro(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Carga masiva del maestro de proveedores desde Excel.
    Detecta la hoja con cabecera RUT / Razón Social / CC.
    Formato esperado (maestro María Ignacia): hoja '01_Proveedores'
      col A=RUT, B=Razón Social, C=CC sugerido.
    """
    contenido = file.file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)

    # Buscar la hoja y fila de cabecera que tenga RUT + Razón Social
    ws = None
    header_row = 0
    for sheet in wb.worksheets:
        for i, row in enumerate(sheet.iter_rows(min_row=1, max_row=10, values_only=True), 1):
            vals = [str(c or "").upper().strip() for c in row]
            if any(v == "RUT" for v in vals) and any("RAZ" in v or "NOMBRE" in v for v in vals):
                ws = sheet
                header_row = i
                col_rut    = next(j for j, v in enumerate(vals) if v == "RUT")
                col_nombre = next(j for j, v in enumerate(vals) if "RAZ" in v or "NOMBRE" in v)
                col_cc     = next((j for j, v in enumerate(vals) if v.startswith("CC")), None)
                break
        if ws:
            break

    if not ws:
        wb.close()
        raise HTTPException(400, "No se encontró cabecera RUT / Razón Social en el archivo.")

    rows = list(ws.iter_rows(min_row=header_row + 1, values_only=True))
    wb.close()

    nuevos = actualizados = omitidos = 0
    RUT_RE = re.compile(r"^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$")
    for r in rows:
        if not r or col_rut >= len(r):
            continue
        rut_raw = str(r[col_rut] or "").strip()
        if not RUT_RE.match(rut_raw):   # salta filas de totales/encabezados
            omitidos += 1
            continue
        rut = _norm_rut(rut_raw)
        nombre = str(r[col_nombre] or "").strip() if col_nombre < len(r) else ""
        cc     = str(r[col_cc] or "").strip() if col_cc is not None and col_cc < len(r) else None
        if not nombre:
            omitidos += 1
            continue

        pm = db.get(ProveedorMaestro, rut)
        if pm:
            pm.nombre = nombre
            if cc: pm.cc = cc
            actualizados += 1
        else:
            db.add(ProveedorMaestro(rut=rut, nombre=nombre, cc=cc or None))
            nuevos += 1
        # Propagar nombre a transacciones que solo tienen el RUT
        db.query(Transaccion).filter(
            Transaccion.rut == rut, Transaccion.proveedor == rut
        ).update({"proveedor": nombre})

    db.commit()
    return {"nuevos": nuevos, "actualizados": actualizados, "omitidos": omitidos}
