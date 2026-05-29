from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import Optional
from ..database import get_db
from ..models import ProveedorMaestro, Transaccion

router = APIRouter(prefix="/api/proveedores", tags=["proveedores"])

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
