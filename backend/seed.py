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
from app.models import Transaccion

EXCEL = Path(__file__).parent / "data" / "egresos_2025_FINAL.xlsx"


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
    Base.metadata.create_all(bind=engine)

    wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
    ws = wb["EGRESOS 2025"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    records = []
    for r in rows:
        fecha = _to_date(r[0])
        if fecha is None:
            continue
        records.append(Transaccion(
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
        ))

    with SessionLocal() as db:
        db.query(Transaccion).delete()
        db.bulk_save_objects(records)
        db.commit()

    print(f"Importadas {len(records)} transacciones.")


if __name__ == "__main__":
    main()
