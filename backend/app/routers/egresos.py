from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from typing import Optional
from ..database import get_db
from ..models import Transaccion
from ..schemas import TransaccionOut, ResumenCC, ResumenMes, ListaEgresos, CC_NOMBRES

router = APIRouter(prefix="/api/egresos", tags=["egresos"])


def _filtros(q, mes, cc, forma_pago, cuenta, search, fecha_desde, fecha_hasta, estado=None):
    if mes:
        q = q.where(Transaccion.mes_devengo == mes)
    if cc:
        q = q.where(Transaccion.cc == cc)
    if forma_pago:
        q = q.where(Transaccion.forma_pago == forma_pago)
    if cuenta:
        q = q.where(Transaccion.cuenta == cuenta)
    if search:
        like = f"%{search.upper()}%"
        q = q.where(
            func.upper(Transaccion.descripcion).like(like) |
            func.upper(func.coalesce(Transaccion.proveedor, "")).like(like)
        )
    if fecha_desde:
        q = q.where(Transaccion.fecha_pago >= fecha_desde)
    if fecha_hasta:
        q = q.where(Transaccion.fecha_pago <= fecha_hasta)
    if estado:
        q = q.where(Transaccion.estado == estado)
    return q


@router.get("", response_model=ListaEgresos)
def listar_egresos(
    mes:         Optional[str] = None,
    cc:          Optional[str] = None,
    forma_pago:  Optional[str] = None,
    cuenta:      Optional[str] = None,
    search:      Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    estado:      Optional[str] = None,
    pagina:      int = Query(1, ge=1),
    por_pagina:  int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    base = select(Transaccion)
    base = _filtros(base, mes, cc, forma_pago, cuenta, search, fecha_desde, fecha_hasta, estado)

    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()

    items = db.execute(
        base.order_by(Transaccion.fecha_pago.desc(), Transaccion.id.desc())
            .offset((pagina - 1) * por_pagina)
            .limit(por_pagina)
    ).scalars().all()

    return ListaEgresos(total=total, items=items, pagina=pagina, por_pagina=por_pagina)


@router.get("/resumen/cc", response_model=list[ResumenCC])
def resumen_por_cc(
    mes:         Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = select(
        Transaccion.cc,
        func.count(Transaccion.id).label("n_tx"),
        func.sum(Transaccion.monto_total).label("monto_neto"),
    ).group_by(Transaccion.cc).order_by(Transaccion.cc)
    q = _filtros(q, mes, None, None, None, None, fecha_desde, fecha_hasta)
    rows = db.execute(q).all()
    return [
        ResumenCC(cc=r.cc, nombre=CC_NOMBRES.get(r.cc, r.cc),
                  n_tx=r.n_tx, monto_neto=r.monto_neto or 0)
        for r in rows
    ]


@router.get("/resumen/mes", response_model=list[ResumenMes])
def resumen_por_mes(
    cc:  Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = select(
        Transaccion.mes_devengo,
        func.sum(Transaccion.monto_total).label("monto_neto"),
    ).group_by(Transaccion.mes_devengo).order_by(Transaccion.mes_devengo)
    if cc:
        q = q.where(Transaccion.cc == cc)
    rows = db.execute(q).all()
    return [ResumenMes(mes=r.mes_devengo, monto_neto=r.monto_neto or 0) for r in rows]


@router.get("/filtros/opciones")
def opciones_filtros(db: Session = Depends(get_db)):
    meses = db.execute(
        select(Transaccion.mes_devengo).distinct().order_by(Transaccion.mes_devengo)
    ).scalars().all()
    ccs = db.execute(
        select(Transaccion.cc).distinct().order_by(Transaccion.cc)
    ).scalars().all()
    return {
        "meses": list(meses),
        "ccs": [{"value": cc, "label": f"{cc} — {CC_NOMBRES.get(cc, cc)}"} for cc in ccs],
        "forma_pago": ["Debito", "Credito"],
    }
