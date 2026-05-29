"""
seed.py — Importa egresos_2025_2026_FINAL.xlsx a la base de datos.
Uso: python seed.py
"""
import sys
from pathlib import Path
from datetime import date, datetime
import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
from app.database import engine, SessionLocal, Base
from app.models import Transaccion, Ingreso, Usuario
from app.auth import hash_password
from app.config import settings

EXCEL_EGRESOS  = Path(__file__).parent / "data" / "egresos_2025_FINAL.xlsx"
EXCEL_PLAN     = Path(__file__).parent / "data" / "plan_cuentas.xlsx"


def _to_date(v) -> date | None:
    if v is None:
        return None
    if isinstance(v, date):
        return v if not isinstance(v, datetime) else v.date()
    if isinstance(v, datetime):
        return v.date()
    try:
        return datetime.strptime(str(v), "%d/%m/%Y").date()
    except Exception:
        return None


def main():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # ── Egresos ──────────────────────────────────────────────────────────────
    wb = openpyxl.load_workbook(EXCEL_EGRESOS, read_only=True, data_only=True)
    ws = wb["EGRESOS 2025"]
    egr_rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    egresos = []
    for r in egr_rows:
        fecha = _to_date(r[0])
        if fecha is None:
            continue
        egresos.append(Transaccion(
            fecha_pago    = fecha,
            mes_devengo   = str(r[1] or "")[:7],
            descripcion   = str(r[2] or ""),
            proveedor     = str(r[3]) if r[3] else None,
            monto_total   = int(r[4] or 0),
            tipo_doc      = str(r[5] or "S"),
            forma_pago    = str(r[6] or "Debito"),
            nombre_cuenta = str(r[7]) if r[7] else None,
            iva           = int(r[8] or 0),
            monto_neto    = int(r[9] or 0),
            cuenta        = str(r[10] or ""),
            cc            = str(r[11] or ""),
            archivo_origen= None,
            estado        = "validado",
            confianza     = 100,
        ))

    # ── Ingresos ─────────────────────────────────────────────────────────────
    wb2 = openpyxl.load_workbook(EXCEL_PLAN, read_only=True, data_only=True)
    ws2 = wb2["1. INGRESOS"]
    ing_rows = list(ws2.iter_rows(min_row=2, values_only=True))
    wb2.close()

    ingresos = []
    for r in ing_rows:
        fecha = _to_date(r[0])
        if fecha is None:
            continue
        ingresos.append(Ingreso(
            fecha         = fecha,
            mes_devengo   = str(r[1] or "")[:7],
            cliente       = str(r[2]) if r[2] else None,
            descripcion   = str(r[3] or ""),
            monto_total   = int(r[4] or 0),
            tipo_doc      = str(r[5] or "B"),
            iva           = int(r[6] or 0),
            monto_neto    = int(r[7] or 0),
            cuenta        = str(r[8] or ""),
            nombre_cuenta = str(r[9]) if r[9] else None,
            canal         = str(r[10]) if r[10] else None,
        ))

    with SessionLocal() as db:
        db.query(Transaccion).delete()
        db.query(Ingreso).delete()
        db.bulk_save_objects(egresos)
        db.bulk_save_objects(ingresos)
        db.commit()

    # ── Usuario admin ─────────────────────────────────────────────────────────
    admin = Usuario(
        username="admin",
        password_hash=hash_password(settings.ADMIN_PASSWORD),
        nombre="Administrador",
        activo=True,
    )
    db.add(admin)
    db.commit()

    print(f"Egresos importados:  {len(egresos)}")
    print(f"Ingresos importados: {len(ingresos)}")
    print(f"Usuario admin creado (password desde ADMIN_PASSWORD)")


if __name__ == "__main__":
    main()
