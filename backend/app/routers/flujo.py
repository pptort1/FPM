from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from ..database import get_db
from ..models import Ingreso, Transaccion

router = APIRouter(prefix="/api/flujo", tags=["flujo"])

INGRESOS_ROWS = [
    ("3.1", "Ventas HoReCa"),
    ("3.2", "Ventas B2C Personas"),
    ("3.6", "Ventas Delivery Apps"),
    ("3.3", "Ventas Carrito"),
    ("3.4", "Ventas Ferias"),
    ("3.5", "Otros Ingresos"),
]

EGRESOS_ROWS = [
    ("CC1", None, "Costos Producto", [
        ("1.1.1","Ingredientes"), ("1.1.2","Packaging"), ("1.1.3","Equipamiento Cocina"),
    ]),
    ("CC2", None, "Sueldos y RRHH", [
        ("1.2.1","Sueldos"), ("1.2.2","Honorarios"), ("1.2.3","Asesoría Contable"),
        ("1.2.4","Uniformes"), ("1.2.5","Préstamos Personal"),
    ]),
    ("CC3", None, "Infraestructura", [
        ("1.3.1","Arriendo"), ("1.3.2","Agua"), ("1.3.3","Luz"), ("1.3.4","Gas"),
        ("1.3.5","Telecomunicaciones"), ("1.3.6","Mantenciones"), ("1.3.7","Fumigaciones"),
        ("1.3.8","Limpieza y Aseo"), ("1.3.9","Seguridad"), ("1.3.10","Equipamiento Local"),
    ]),
    ("CC4", None, "Carrito", [
        ("1.4.1","Inversión Carro"), ("1.4.2","Mantención Carro"), ("1.4.5","Sueldos Carro"),
    ]),
    ("CC5", None, "Plataformas Digitales", [
        ("1.5.1","SAAS"), ("1.5.2","Variables SAAS"),
    ]),
    ("CC6", None, "Marketing", [
        ("1.6.1","RRSS"), ("1.6.2","Producción Audiovisual"), ("1.6.3","Ferias y Eventos"),
    ]),
    ("CC7", None, "Logística", [
        ("1.7.1","Despachos B2B"), ("1.7.2","Despachos B2C"), ("1.7.3","Transporte Personas"),
    ]),
    ("CC8", None, "Comisiones", [
        ("1.8.1","Comisión POS"), ("1.8.2","Comisión Delivery"), ("1.8.3","Comisión Digital"),
    ]),
    ("CC9", None, "Impuestos y Bancario", [
        ("1.9.1","IVA F29"), ("1.9.4","Patente"), ("1.9.5","Gastos Bancarios"),
    ]),
]


@router.get("")
def flujo_caja(db: Session = Depends(get_db)):
    # Meses disponibles (unión ingresos + egresos)
    meses_ing = db.execute(
        select(Ingreso.mes_devengo).distinct()
    ).scalars().all()
    meses_egr = db.execute(
        select(Transaccion.mes_devengo).distinct()
    ).scalars().all()
    meses = sorted(set(list(meses_ing) + list(meses_egr)))

    # Pivot ingresos: cuenta → mes → neto
    ing_pivot: dict[str, dict[str, int]] = {}
    for row in db.execute(
        select(Ingreso.cuenta, Ingreso.mes_devengo, func.sum(Ingreso.monto_neto))
        .group_by(Ingreso.cuenta, Ingreso.mes_devengo)
    ).all():
        ing_pivot.setdefault(row[0], {})[row[1]] = int(row[2] or 0)

    # Pivot egresos: cuenta → mes → neto
    egr_pivot: dict[str, dict[str, int]] = {}
    egr_cc_pivot: dict[str, dict[str, int]] = {}
    for row in db.execute(
        select(Transaccion.cuenta, Transaccion.cc, Transaccion.mes_devengo,
               func.sum(Transaccion.monto_neto))
        .group_by(Transaccion.cuenta, Transaccion.cc, Transaccion.mes_devengo)
    ).all():
        cuenta, cc, mes, val = row[0], row[1], row[2], int(row[3] or 0)
        egr_pivot.setdefault(cuenta, {})[mes] = val
        egr_cc_pivot.setdefault(cc, {})
        egr_cc_pivot[cc][mes] = egr_cc_pivot[cc].get(mes, 0) + val

    # Construir respuesta
    def vals(pivot, key):
        return {m: pivot.get(key, {}).get(m, 0) for m in meses}

    # Sección ingresos
    ing_rows = []
    total_ing = {m: 0 for m in meses}
    for cuenta, nombre in INGRESOS_ROWS:
        v = vals(ing_pivot, cuenta)
        ing_rows.append({"codigo": cuenta, "nombre": nombre, "valores": v})
        for m in meses:
            total_ing[m] += v[m]

    # Sección egresos por CC
    egr_secciones = []
    total_egr = {m: 0 for m in meses}
    for cc, _, nombre_cc, subcuentas in EGRESOS_ROWS:
        cc_total = {m: 0 for m in meses}
        sub_rows = []
        for cuenta, nombre_cuenta in subcuentas:
            v = vals(egr_pivot, cuenta)
            sub_rows.append({"codigo": cuenta, "nombre": nombre_cuenta, "valores": v})
            for m in meses:
                cc_total[m] += v[m]
        egr_secciones.append({"cc": cc, "nombre": nombre_cc, "filas": sub_rows, "total": cc_total})
        for m in meses:
            total_egr[m] += cc_total[m]

    margen = {m: total_ing[m] - total_egr[m] for m in meses}
    total_ing_sum = sum(total_ing.values())
    margen_pct = {
        m: round(margen[m] / total_ing[m] * 100, 1) if total_ing[m] else 0
        for m in meses
    }

    return {
        "meses": meses,
        "ingresos": {"filas": ing_rows, "total": total_ing},
        "costos": {"secciones": egr_secciones, "total": total_egr},
        "margen": margen,
        "margen_pct": margen_pct,
    }
