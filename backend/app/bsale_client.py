"""
bsale_client.py — Cliente REST para la API de Bsale.
Documentación: https://developers.bsale.io/reference
"""
import requests
from datetime import date, datetime
from typing import Generator

BASE_URL = "https://api.bsale.io/v1"
PAGE_SIZE = 50

# Mapeo por NOMBRE del documento (robusto — los IDs numéricos varían por cuenta).
# tipo_doc, signo (+1 suma / -1 resta / 0 descarta), cuenta sugerida, canal
# Según tabla oficial María Ignacia (260530):
#   Boleta/Factura/Bol.Honorarios/Nota Débito → SUMAN (signo +)
#   Nota de Crédito / Factura Anulada → RESTAN (signo -)
#   Guía de Despacho → DESCARTAR (no es venta)
DOC_TYPE_RULES = [
    # (substring en nombre upper, tipo_doc, signo, cuenta, canal)
    ("BOLETA ELEC",        "B",  +1, "3.2", "CH2"),
    ("BOLETA AFECTA",      "B",  +1, "3.2", "CH2"),
    ("FACTURA ELEC",       "F",  +1, "3.1", "CH1"),
    ("FACTURA AFECTA",     "F",  +1, "3.1", "CH1"),
    ("FACTURA EXENTA",     "F",  +1, "3.1", "CH1"),
    ("BOLETA HONORARIO",   "S",  +1, "3.2", "CH2"),
    ("HONORARIO",          "S",  +1, "3.2", "CH2"),
    ("NOTA DE CRED",       "NC", -1, "3.2", "CH2"),
    ("NOTA DE CRÉD",       "NC", -1, "3.2", "CH2"),
    ("NOTA CRED",          "NC", -1, "3.2", "CH2"),
    ("NOTA DE DEB",        "ND", +1, "3.1", "CH1"),   # cargo adicional → SUMA
    ("NOTA DE DÉB",        "ND", +1, "3.1", "CH1"),
    ("GUIA",               "GD",  0, "",    ""),       # descartar
    ("GUÍA",               "GD",  0, "",    ""),
]


def clasificar_doc_bsale(nombre: str) -> tuple[str, int, str, str]:
    """Devuelve (tipo_doc, signo, cuenta, canal). signo 0 = descartar."""
    n = (nombre or "").upper().strip()
    for sub, tipo, signo, cuenta, canal in DOC_TYPE_RULES:
        if sub in n:
            return tipo, signo, cuenta, canal
    # Desconocido: tratar como boleta B2C positiva, no descartar
    return "B", +1, "3.2", "CH2"

NOMBRE_CUENTA = {
    "3.1": "Ventas HoReCa",
    "3.2": "Ventas B2C Personas",
    "3.3": "Ventas Carrito",
    "3.5": "Otros Ingresos",
    "3.6": "Ventas Delivery",
}


class BsaleClient:
    def __init__(self, token: str):
        self.session = requests.Session()
        self.session.headers.update({
            "access_token": token,
            "Content-Type": "application/json",
        })

    def _get(self, endpoint: str, params: dict) -> dict:
        url = f"{BASE_URL}/{endpoint}.json"
        r = self.session.get(url, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def get_document_types(self) -> list[dict]:
        """Lista todos los tipos de documento configurados."""
        data = self._get("document_types", {"state": 1})
        return data.get("items", [])

    def iter_documents(
        self,
        fecha_desde: date,
        fecha_hasta: date,
        state: int = 0,          # 0 = emitidos (válidos)
    ) -> Generator[dict, None, None]:
        """
        Itera todos los documentos en el rango de fechas (con paginación automática).
        Emite: facturas, boletas, NC, ND emitidos.
        """
        ts_desde = int(datetime(fecha_desde.year, fecha_desde.month, fecha_desde.day).timestamp())
        ts_hasta  = int(datetime(fecha_hasta.year, fecha_hasta.month, fecha_hasta.day, 23, 59, 59).timestamp())

        offset = 0
        while True:
            params = {
                "emissiondate_start": ts_desde,
                "emissiondate_end":   ts_hasta,
                "state":              state,
                "expand":             "[document_type,client]",
                "limit":              PAGE_SIZE,
                "offset":             offset,
            }
            data = self._get("documents", params)
            items = data.get("items", [])
            for doc in items:
                yield doc
            if len(items) < PAGE_SIZE:
                break
            offset += PAGE_SIZE

    @staticmethod
    def normalizar_documento(doc: dict) -> dict:
        """
        Convierte un documento Bsale al formato de nuestro modelo Ingreso.
        """
        ts = doc.get("emissionDate", 0)
        fecha = date.fromtimestamp(ts) if ts else date.today()

        doc_type_name = doc.get("document_type", {}).get("name", "")
        tipo_doc, signo, cuenta, canal = clasificar_doc_bsale(doc_type_name)

        total  = signo * int(doc.get("totalAmount",  0) or 0)
        neto   = signo * int(doc.get("netAmount",    0) or 0)
        iva    = signo * int(doc.get("taxAmount",    0) or 0)

        cliente = doc.get("client") or {}
        nombre_cliente = (
            f"{cliente.get('firstName','')} {cliente.get('lastName','')}".strip()
            or cliente.get('company', '')
            or "Sin cliente"
        )
        rut_cliente = cliente.get("rut")

        numero = doc.get("number", "")
        descripcion = f"{doc_type_name} {numero}".strip() if numero else (doc_type_name or "Documento")

        mes = f"{fecha.year}-{fecha.month:02d}"

        return {
            "bsale_id":    str(doc["id"]),
            "fecha":       fecha,
            "mes_devengo": mes,
            "cliente":     nombre_cliente,
            "descripcion": descripcion,
            "monto_total": total,
            "tipo_doc":    tipo_doc,
            "iva":         iva,
            "monto_neto":  neto,
            "cuenta":      cuenta,
            "nombre_cuenta": NOMBRE_CUENTA.get(cuenta, cuenta),
            "canal":       canal,
            "rut":         rut_cliente,
        }
