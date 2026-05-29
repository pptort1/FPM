from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import Optional
from ..database import get_db
from ..models import Ingreso

router = APIRouter(prefix="/api/ingresos", tags=["ingresos"])

CANAL_NOMBRES = {
    "CH1": "HoReCa",
    "CH2": "B2C Personas",
    "CH3": "Delivery Apps",
    "CH4": "Carrito",
    "CH5": "Ferias",
    "CH0": "Sin Asignar",
}

CUENTA_NOMBRES = {
    "3.1": "Ventas HoReCa",
    "3.2": "Ventas B2C",
    "3.3": "Ventas Carrito",
    "3.4": "Ventas Ferias",
    "3.5": "Otros Ingresos",
    "3.6": "Ventas Delivery",
}


def _filtros(q, mes, canal, cuenta, search, fecha_desde, fecha_hasta):
    if mes:
        q = q.where(Ingreso.mes_devengo == mes)
    if canal:
        q = q.where(Ingreso.canal == canal)
    if cuenta:
        q = q.where(Ingreso.cuenta == cuenta)
    if search:
        like = f"%{search.upper()}%"
        q = q.where(
            func.upper(Ingreso.descripcion).like(like) |
            func.upper(func.coalesce(Ingreso.cliente, "")).like(like)
        )
    if fecha_desde:
        q = q.where(Ingreso.fecha >= fecha_desde)
    if fecha_hasta:
        q = q.where(Ingreso.fecha <= fecha_hasta)
    return q


@router.get("")
def listar_ingresos(
    mes:         Optional[str] = None,
    canal:       Optional[str] = None,
    cuenta:      Optional[str] = None,
    search:      Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    pagina:      int = Query(1, ge=1),
    por_pagina:  int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    base = select(Ingreso)
    base = _filtros(base, mes, canal, cuenta, search, fecha_desde, fecha_hasta)

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
    items = db.execute(
        base.order_by(Ingreso.fecha.desc(), Ingreso.id.desc())
            .offset((pagina - 1) * por_pagina)
            .limit(por_pagina)
    ).scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": r.id, "fecha": str(r.fecha), "mes_devengo": r.mes_devengo,
                "cliente": r.cliente, "descripcion": r.descripcion,
                "monto_total": r.monto_total, "tipo_doc": r.tipo_doc,
                "iva": r.iva, "monto_neto": r.monto_neto,
                "cuenta": r.cuenta, "nombre_cuenta": r.nombre_cuenta, "canal": r.canal,
            }
            for r in items
        ],
        "pagina": pagina, "por_pagina": por_pagina,
    }


@router.get("/resumen/canal")
def resumen_por_canal(
    mes:         Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = select(
        Ingreso.canal,
        func.count(Ingreso.id).label("n_tx"),
        func.sum(Ingreso.monto_neto).label("monto_neto"),
    ).group_by(Ingreso.canal).order_by(Ingreso.canal)
    q = _filtros(q, mes, None, None, None, fecha_desde, fecha_hasta)
    rows = db.execute(q).all()
    return [
        {"canal": r.canal, "nombre": CANAL_NOMBRES.get(r.canal or "", r.canal or ""),
         "n_tx": r.n_tx, "monto_neto": r.monto_neto or 0}
        for r in rows
    ]


@router.get("/resumen/mes")
def resumen_por_mes(
    canal: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = select(
        Ingreso.mes_devengo,
        func.sum(Ingreso.monto_neto).label("monto_neto"),
    ).group_by(Ingreso.mes_devengo).order_by(Ingreso.mes_devengo)
    if canal:
        q = q.where(Ingreso.canal == canal)
    rows = db.execute(q).all()
    return [{"mes": r.mes_devengo, "monto_neto": r.monto_neto or 0} for r in rows]


@router.get("/filtros/opciones")
def opciones_filtros(db: Session = Depends(get_db)):
    meses = db.execute(
        select(Ingreso.mes_devengo).distinct().order_by(Ingreso.mes_devengo)
    ).scalars().all()
    canales = db.execute(
        select(Ingreso.canal).distinct().order_by(Ingreso.canal)
    ).scalars().all()
    return {
        "meses": list(meses),
        "canales": [{"value": c, "label": f"{c} — {CANAL_NOMBRES.get(c or '', c or '')}"} for c in canales if c],
        "tipo_doc": ["B", "F", "NC", "ND"],
    }
