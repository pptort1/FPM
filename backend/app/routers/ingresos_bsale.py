"""
ingresos_bsale.py — Importa ventas desde el Excel de Bsale (reporte de ventas).
Agrupa por documento (una fila por doc), deduplica por bsale_id.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from collections import defaultdict
from datetime import datetime, date
import io, openpyxl

from ..database import get_db
from ..models import Ingreso

router = APIRouter(prefix="/api/ingresos", tags=["ingresos"])

# ── Mapeos ────────────────────────────────────────────────────────────────

TIPO_DOC_MAP = {
    "BOLETA ELECTRÓNICA T":            ("B",  "3.2"),
    "BOLETA ELECTRONICA T":            ("B",  "3.2"),
    "FACTURA ELECTRÓNICA T":           ("F",  "3.1"),
    "FACTURA ELECTRONICA T":           ("F",  "3.1"),
    "NOTA DE CRÉDITO ELECTRÓNICA T":   ("NC", None),
    "NOTA DE CREDITO ELECTRONICA T":   ("NC", None),
}

SUCURSAL_MAP = {
    "GERONIMO": ("CH2", "3.2", "Ventas B2C Personas"),
    "HORECA":   ("CH1", "3.1", "Ventas HoReCa"),
}

LISTA_MAP = {   # complementa cuando la sucursal no resuelve
    "HORECA": ("CH1", "3.1", "Ventas HoReCa"),
}


def _canal_from(sucursal: str, lista: str):
    s = (sucursal or "").upper()
    for k, v in SUCURSAL_MAP.items():
        if k in s:
            return v
    l = (lista or "").upper()
    for k, v in LISTA_MAP.items():
        if k in l:
            return v
    return ("CH2", "3.2", "Ventas B2C Personas")   # fallback


def _parse_fecha(v) -> date | None:
    if isinstance(v, (date, datetime)):
        return v.date() if isinstance(v, datetime) else v
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(v).strip(), fmt).date()
        except Exception:
            pass
    return None


def _tipo_from(tipo_doc_raw: str, es_devolucion: bool):
    raw = (tipo_doc_raw or "").upper().strip()
    for k, (td, _) in TIPO_DOC_MAP.items():
        if k.upper() in raw:
            return td
    return "NC" if es_devolucion else "B"


def parsear_ventas_bsale(file_bytes: bytes) -> list[dict]:
    """
    Lee el Excel de Bsale y devuelve una lista de documentos consolidados
    (un elemento por número de documento).
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    # Agrupar por (tipo_doc_raw, numero)
    grupos: dict[tuple, dict] = defaultdict(lambda: {
        "tipo_mov": None, "tipo_doc_raw": None, "numero": None,
        "fecha": None, "sucursal": None, "lista": None,
        "cliente": None, "rut": None,
        "neto": 0, "iva": 0, "bruto": 0,
    })

    for r in rows:
        tipo_mov    = str(r[0] or "").lower().strip()
        tipo_doc_r  = str(r[1] or "").strip()
        numero      = str(r[2] or "").strip()
        if not numero or tipo_mov not in ("venta", "devolucion"):
            continue

        key = (tipo_doc_r, numero)
        g = grupos[key]
        if g["tipo_mov"] is None:
            g["tipo_mov"]     = tipo_mov
            g["tipo_doc_raw"] = tipo_doc_r
            g["numero"]       = numero
            g["fecha"]        = _parse_fecha(r[3])
            g["sucursal"]     = str(r[6] or "")
            g["lista"]        = str(r[14] or "")
            g["cliente"]      = str(r[8] or "") or None
            g["rut"]          = str(r[9] or "") or None

        try:
            g["neto"]  += float(r[27] or 0)
            g["iva"]   += float(r[28] or 0)
            g["bruto"] += float(r[29] or 0)
        except Exception:
            pass

    return list(grupos.values())


# ── Endpoint ──────────────────────────────────────────────────────────────

@router.post("/importar-bsale")
def importar_bsale(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Solo se aceptan archivos Excel (.xlsx / .xls)")

    contenido = file.file.read()
    try:
        docs = parsear_ventas_bsale(contenido)
    except Exception as e:
        raise HTTPException(400, f"Error al parsear: {e}")

    # IDs ya en DB
    ids_existentes: set[str] = set(
        r[0] for r in db.execute(
            select(Ingreso.bsale_id).where(Ingreso.bsale_id.isnot(None))
        ).all()
    )

    agregados = duplicados = errores = 0
    nuevos = []

    for doc in docs:
        if not doc["fecha"] or not doc["numero"]:
            errores += 1
            continue

        bsale_id = f"{doc['tipo_doc_raw'][:3]}-{doc['numero']}"
        if bsale_id in ids_existentes:
            duplicados += 1
            continue

        es_dev = doc["tipo_mov"] == "devolucion"
        tipo   = _tipo_from(doc["tipo_doc_raw"], es_dev)
        canal, cuenta, nombre_cuenta = _canal_from(doc["sucursal"], doc["lista"])

        # NC: el cuenta puede depender del canal original
        if tipo == "NC":
            canal_nc, cuenta_nc, nombre_nc = _canal_from(doc["sucursal"], doc["lista"])
            canal, cuenta, nombre_cuenta = canal_nc, cuenta_nc, nombre_nc

        signo  = -1 if es_dev else 1
        bruto  = signo * round(doc["bruto"])
        iva    = signo * round(doc["iva"])
        neto   = signo * round(doc["neto"])
        fecha  = doc["fecha"]
        mes    = f"{fecha.year}-{fecha.month:02d}"

        nuevos.append(Ingreso(
            bsale_id      = bsale_id,
            fecha         = fecha,
            mes_devengo   = mes,
            cliente       = doc["cliente"],
            descripcion   = f"{doc['tipo_doc_raw']} N°{doc['numero']}",
            monto_total   = bruto,
            tipo_doc      = tipo,
            iva           = iva,
            monto_neto    = neto,
            cuenta        = cuenta,
            nombre_cuenta = nombre_cuenta,
            canal         = canal,
        ))
        ids_existentes.add(bsale_id)
        agregados += 1

    if nuevos:
        db.add_all(nuevos)
        db.commit()

    return {
        "agregados": agregados,
        "duplicados": duplicados,
        "errores": errores,
        "archivo": file.filename,
    }
