"""
parser_santander.py — Parser robusto para cartolas Santander (Excel).
- Detecta la fila de cabecera por nombre, no por posición.
- Soporta formatos con/sin N° Documento y Sucursal.
- Extrae RUT en transferencias, separa pasarela en compras.
- Aplica exclusiones: LCA, cuentas propias, pago TC.
"""
import re, hashlib, io
from datetime import date, datetime
import openpyxl

# ── Constantes ─────────────────────────────────────────────────────────────

RUT_PROPIO  = "77129873-7"   # normalizado: sin puntos, guion incluido
RUT_RE      = re.compile(r"\b(\d{1,2})\.(\d{3})\.(\d{3})-([\dkK])\b")

PASARELAS = [
    "MERCADOPAGO *", "MERPAGO*", "MP *", "FLOW *", "TUU*",
    "TOKU *", "GOOGLE *", "OPENAI *", "NP ",
]

EXCLUSIONES_GLOSA = [
    "AMORTIZACION PERIODICA LCA", "AMORTIZACIÓN PERIÓDICA LCA",
    "TRASPASO CON LA CUENTA", "TRASPASO ENTRE CUENTAS",
    "TRASPASO PROPIO", "PERIODICA LCA",
    "REPOSTERIA MARI", "REPOSTERÍA MARI",
    "MONTO CANCELADO",
    "PAGO AUTOMATICO T. DE CREDITO", "PAGO AUTOMÁTICO T. DE CRÉDITO",
    "T. CREDITO", "T. CRÉDITO",
    "TRASPASO INTERNET A T. CR",
]


# ── Helpers ────────────────────────────────────────────────────────────────

def _upper(s) -> str:
    return str(s or "").upper().strip()

def _parse_fecha(v) -> date | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(v).strip(), fmt).date()
        except Exception:
            pass
    return None

def _normalizar_rut(s: str) -> str:
    return re.sub(r"[.\s]", "", s).upper()

def _firma(fecha: date, monto: int, desc: str) -> str:
    desc_norm = re.sub(r"\s+", " ", desc.upper().strip())
    raw = f"{fecha.isoformat()}|{monto}|{desc_norm}"
    return hashlib.sha256(raw.encode()).hexdigest()[:20]

def _es_exclusion(desc: str) -> bool:
    d = _upper(desc)
    if RUT_PROPIO in d.replace(".", "").replace(" ", ""):
        return True
    return any(ex in d for ex in EXCLUSIONES_GLOSA)

def _extraer_rut(desc: str) -> str | None:
    m = RUT_RE.search(desc)
    return m.group() if m else None

def _extraer_comercio(desc: str) -> tuple[str, str | None]:
    """Devuelve (comercio_limpio, pasarela)."""
    d = re.sub(r"^Compra\s+(Nacional\s+|Inter\.\s+NP\s+)?", "", desc,
               flags=re.IGNORECASE).strip()
    pasarela = None
    for p in PASARELAS:
        if _upper(d).startswith(_upper(p)):
            pasarela = p.strip().rstrip("*").strip()
            d = d[len(p):].strip()
            break
    return d, pasarela


# ── Parser principal ───────────────────────────────────────────────────────

def _find_header(rows: list) -> tuple[int, dict]:
    """Devuelve (índice_fila_cabecera, col_map)."""
    for i, row in enumerate(rows):
        upper = [_upper(c) for c in row]
        has_monto = "MONTO" in upper
        has_desc  = any("DESCRIPCI" in c for c in upper)
        has_fecha = "FECHA" in upper
        if has_monto and has_desc and has_fecha:
            col_map: dict[str, int] = {}
            for j, v in enumerate(upper):
                if v == "MONTO":                            col_map["monto"]  = j
                elif "DESCRIPCI" in v:                     col_map["desc"]   = j
                elif v == "FECHA":                         col_map["fecha"]  = j
                elif v in ("C/A", "CARGO/ABONO"):          col_map["ca"]     = j
                elif "N° DOC" in v or "N°DOC" in v or "NRO.DOC" in v:
                                                           col_map["ndoc"]   = j
            return i, col_map
    return -1, {}


def parsear_cartola(file_bytes: bytes, nombre_archivo: str) -> list[dict]:
    """
    Parsea la cartola y devuelve lista de dicts normalizados.
    Cada dict tiene:
      tipo: 'egreso' | 'ingreso' | 'excluido'
      fecha, monto, descripcion_original, firma, rut, comercio, pasarela, ndoc, archivo
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    header_idx, col_map = _find_header(rows)
    if header_idx < 0:
        raise ValueError(
            "No se encontró la cabecera (MONTO + DESCRIPCIÓN + FECHA). "
            "Verificá que el archivo es una cartola Santander en formato Excel."
        )
    if "monto" not in col_map or "desc" not in col_map or "fecha" not in col_map:
        raise ValueError("Columnas incompletas en la cabecera detectada.")

    resultado = []
    for row in rows[header_idx + 1:]:
        if not any(row):
            continue

        ca = _upper(row[col_map.get("ca", -1)] if "ca" in col_map else "")
        if ca not in ("C", "A"):
            continue

        raw_monto = row[col_map["monto"]]
        try:
            monto = int(abs(float(raw_monto or 0)))
        except Exception:
            continue
        if monto == 0:
            continue

        desc  = str(row[col_map["desc"]] or "").strip()
        fecha = _parse_fecha(row[col_map["fecha"]])
        if fecha is None:
            continue

        ndoc = str(row[col_map["ndoc"]] or "").strip() if "ndoc" in col_map else None

        if ca == "C":   # cargo = egreso
            if _es_exclusion(desc):
                tipo = "excluido"
                rut = comercio = pasarela = None
            else:
                tipo    = "egreso"
                rut     = _extraer_rut(desc)
                comercio, pasarela = _extraer_comercio(desc)
        else:           # abono = ingreso
            tipo    = "ingreso"
            rut     = _extraer_rut(desc)
            comercio, pasarela = desc, None

        firma = _firma(fecha, monto, desc) if tipo != "excluido" else None

        resultado.append({
            "tipo":                 tipo,
            "fecha":                fecha,
            "monto":                monto,
            "descripcion_original": desc,
            "rut":                  rut,
            "comercio":             comercio,
            "pasarela":             pasarela,
            "ndoc":                 ndoc,
            "firma":                firma,
            "archivo":              nombre_archivo,
        })

    return resultado
