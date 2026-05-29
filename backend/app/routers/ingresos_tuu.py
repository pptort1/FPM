"""
ingresos_tuu.py — Importa ventas desde el reporte Excel/CSV de TUU (PTU.csv.xlsx).
Cada fila es una transacción individual. Dedup por Número único.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, date
import io, csv, openpyxl

from ..database import get_db
from ..models import Ingreso

router = APIRouter(prefix="/api/ingresos", tags=["ingresos"])

TIPO_DOC_MAP = {
    "BOLETA AFECTA":   "B",
    "FACTURA AFECTA":  "F",
    "NOTA DE CREDITO": "NC",
    "NOTA DE CRÉDITO": "NC",
}


def _tipo_doc(raw: str) -> str:
    r = raw.upper().strip()
    for k, v in TIPO_DOC_MAP.items():
        if k in r:
            return v
    return "B"


def _parse_fecha(v: str) -> date | None:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(v.strip(), fmt).date()
        except Exception:
            pass
    return None


def _get_rows_and_header(ws) -> tuple[list, list[str]]:
    """
    Detecta si el Excel es formato nativo (columnas separadas)
    o formato CSV-en-Excel (todo en columna 0).
    Devuelve (header_list, data_rows_as_lists).
    """
    all_rows = list(ws.iter_rows(min_row=1, values_only=True))
    if not all_rows:
        return [], []

    first = all_rows[0]
    # Formato nativo: la primera fila tiene múltiples celdas con valores
    non_none = sum(1 for v in first if v is not None)
    if non_none > 2:
        header = [str(h or "").strip() for h in first]
        data = [[str(v) if v is not None else "" for v in r] for r in all_rows[1:]]
        return header, data

    # Formato CSV-en-Excel: todo en columna 0
    raw_lines = [str(r[0] or "") for r in all_rows]
    parsed = [next(csv.reader([line])) for line in raw_lines if line.strip()]
    if not parsed:
        return [], []
    header_raw = parsed[0]
    header = []
    for h in header_raw:
        try:
            h = h.encode("latin-1").decode("utf-8")
        except Exception:
            pass
        header.append(h.strip())
    data = parsed[1:]
    return header, data


def parsear_tuu(file_bytes: bytes) -> list[dict]:
    """
    Lee el Excel de TUU — soporta formato nativo xlsx y formato CSV-en-Excel.
    Devuelve lista de transacciones normalizadas.
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active
    header, data = _get_rows_and_header(ws)
    wb.close()

    if not header:
        return []

    def idx(name: str) -> int:
        for i, h in enumerate(header):
            if name.lower() in h.lower():
                return i
        return -1

    i_id      = idx("número único")
    i_fecha   = idx("fecha transacción")
    i_tipo_mv = idx("tipo venta")
    i_tipo_tx = idx("tipo transacción")
    i_bruto   = idx("monto transacción")
    i_neto    = idx("monto neto")
    i_iva     = idx("iva")
    i_tipo_d  = idx("tipo de documento")
    i_nombre  = idx("nombre cliente")
    i_apell   = idx("apellido cliente")

    txs = []
    for row in data:
        if not row or (i_fecha >= 0 and not row[i_fecha]):
            continue
        tipo_mv = row[i_tipo_mv].strip().lower() if i_tipo_mv >= 0 else "venta"
        if tipo_mv not in ("venta", "devolucion", "devolución"):
            continue

        raw_id  = str(row[i_id]).strip() if i_id >= 0 else ""
        tuu_id  = f"TUU-{raw_id}" if raw_id and raw_id != "None" else None
        fecha   = _parse_fecha(str(row[i_fecha])) if i_fecha >= 0 else None
        if not fecha:
            continue

        es_dev  = "devol" in tipo_mv
        signo   = -1 if es_dev else 1
        try:
            bruto = signo * int(float(str(row[i_bruto] or 0).replace(",", "") or 0))
            neto  = signo * int(float(str(row[i_neto]  or 0).replace(",", "") or 0))
            iva   = signo * int(float(str(row[i_iva]   or 0).replace(",", "") or 0))
        except Exception:
            continue

        tipo_tx  = str(row[i_tipo_tx]).strip() if i_tipo_tx >= 0 else ""
        tipo_doc = _tipo_doc(str(row[i_tipo_d])) if i_tipo_d >= 0 else "B"
        if es_dev:
            tipo_doc = "NC"

        nombre_cl = " ".join(filter(None, [
            str(row[i_nombre] or "").strip() if i_nombre >= 0 else "",
            str(row[i_apell]  or "").strip() if i_apell  >= 0 else "",
        ])) or None

        txs.append({
            "tuu_id":      tuu_id,
            "fecha":       fecha,
            "mes":         f"{fecha.year}-{fecha.month:02d}",
            "cliente":     nombre_cl,
            "descripcion": f"TUU {tipo_tx}" if tipo_tx else "TUU Venta",
            "bruto":       bruto,
            "neto":        neto,
            "iva":         iva,
            "tipo_doc":    tipo_doc,
        })

    return txs


# ── Endpoint ──────────────────────────────────────────────────────────────

@router.post("/importar-tuu")
def importar_tuu(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Solo se aceptan archivos .xlsx (exportado desde TUU)")

    contenido = file.file.read()
    try:
        txs = parsear_tuu(contenido)
    except Exception as e:
        raise HTTPException(400, f"Error al parsear: {e}")

    # IDs ya en DB (por bsale_id que usamos también para TUU)
    ids_db: set[str] = set(
        r[0] for r in db.execute(
            select(Ingreso.bsale_id).where(Ingreso.bsale_id.isnot(None))
        ).all()
    )

    agregados = duplicados = errores = 0
    nuevos = []

    for tx in txs:
        if tx["tuu_id"] and tx["tuu_id"] in ids_db:
            duplicados += 1
            continue
        try:
            nuevos.append(Ingreso(
                bsale_id      = tx["tuu_id"],
                fecha         = tx["fecha"],
                mes_devengo   = tx["mes"],
                cliente       = tx["cliente"],
                descripcion   = tx["descripcion"],
                monto_total   = tx["bruto"],
                tipo_doc      = tx["tipo_doc"],
                iva           = tx["iva"],
                monto_neto    = tx["neto"],
                cuenta        = "3.2",
                nombre_cuenta = "Ventas B2C Personas",
                canal         = "CH2",
            ))
            if tx["tuu_id"]:
                ids_db.add(tx["tuu_id"])
            agregados += 1
        except Exception:
            errores += 1

    if nuevos:
        db.add_all(nuevos)
        db.commit()

    return {
        "agregados": agregados,
        "duplicados": duplicados,
        "errores": errores,
        "archivo": file.filename,
    }
