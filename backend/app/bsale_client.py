"""
bsale_client.py — Cliente REST para la API de Bsale.
Documentación: https://developers.bsale.io/reference
"""
import requests
from datetime import date, datetime
from typing import Generator

BASE_URL = "https://api.bsale.io/v1"
PAGE_SIZE = 50

# Mapeo tipo de documento Bsale → (tipo_doc_fpm, cuenta, canal)
# Ajustar según los tipos reales configurados en la cuenta FPM
DOC_TYPE_MAP: dict[int, tuple[str, str, str]] = {
    # id_bsale: (tipo_doc, cuenta, canal)
    # Los IDs reales se obtienen de GET /v1/document_types.json
    # Valores por defecto comunes en Bsale Chile:
    2:  ("B",  "3.2", "CH2"),   # Boleta  → B2C
    3:  ("F",  "3.1", "CH1"),   # Factura → HoReCa
    4:  ("NC", "3.2", "CH2"),   # Nota de crédito boleta
    5:  ("NC", "3.1", "CH1"),   # Nota de crédito factura
    6:  ("ND", "3.1", "CH1"),   # Nota de débito
}

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

        doc_type_id = doc.get("documentTypeId") or doc.get("document_type", {}).get("id")
        tipo_doc, cuenta, canal = DOC_TYPE_MAP.get(
            doc_type_id, ("B", "3.5", "CH2")   # fallback
        )

        # NC y ND tienen montos positivos en Bsale → los convertimos a negativos
        signo = -1 if tipo_doc in ("NC", "ND") else 1

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

        doc_type_name = doc.get("document_type", {}).get("name", tipo_doc)
        numero = doc.get("number", "")
        descripcion = f"{doc_type_name} {numero}".strip() if numero else doc_type_name

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
