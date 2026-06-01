from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import date, timedelta

from ..database import get_db
from ..models import Ingreso
from ..config import settings
from ..bsale_client import BsaleClient

router = APIRouter(prefix="/api/bsale", tags=["bsale"])


def _get_client() -> BsaleClient:
    if not settings.BSALE_TOKEN:
        raise HTTPException(503, "BSALE_TOKEN no configurado en el servidor")
    return BsaleClient(settings.BSALE_TOKEN)


@router.get("/tipos")
def listar_tipos():
    """Lista los tipos de documento configurados en Bsale (para validar el mapeo)."""
    client = _get_client()
    try:
        tipos = client.get_document_types()
        return [{"id": t["id"], "name": t.get("name"), "abbreviation": t.get("abbreviation")} for t in tipos]
    except Exception as e:
        raise HTTPException(502, f"Error conectando a Bsale: {e}")


@router.post("/sync")
def sync_bsale(
    fecha_desde: date = Query(default=None),
    fecha_hasta: date = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Sincroniza documentos de venta desde Bsale.
    Por defecto sincroniza los últimos 90 días.
    Deduplica por bsale_id — reejecutar no genera duplicados.
    """
    if fecha_hasta is None:
        fecha_hasta = date.today()
    if fecha_desde is None:
        fecha_desde = fecha_hasta - timedelta(days=90)

    client = _get_client()

    # IDs ya en DB
    ids_existentes: set[str] = set(
        r[0] for r in db.execute(
            select(Ingreso.bsale_id).where(Ingreso.bsale_id.isnot(None))
        ).all()
    )

    stats = {"agregados": 0, "duplicados": 0, "errores": 0}
    nuevos: list[Ingreso] = []

    try:
        for doc in client.iter_documents(fecha_desde, fecha_hasta):
            bsale_id = str(doc["id"])
            if bsale_id in ids_existentes:
                stats["duplicados"] += 1
                continue
            try:
                norm = BsaleClient.normalizar_documento(doc)
                if norm["tipo_doc"] == "GD":   # Guía de despacho: no es venta
                    stats["duplicados"] += 1
                    continue
                nuevos.append(Ingreso(
                    bsale_id      = bsale_id,
                    fecha         = norm["fecha"],
                    mes_devengo   = norm["mes_devengo"],
                    cliente       = norm["cliente"],
                    descripcion   = norm["descripcion"],
                    monto_total   = norm["monto_total"],
                    tipo_doc      = norm["tipo_doc"],
                    iva           = norm["iva"],
                    monto_neto    = norm["monto_neto"],
                    cuenta        = norm["cuenta"],
                    nombre_cuenta = norm["nombre_cuenta"],
                    canal         = norm["canal"],
                ))
                ids_existentes.add(bsale_id)
                stats["agregados"] += 1
            except Exception:
                stats["errores"] += 1

    except Exception as e:
        raise HTTPException(502, f"Error al consultar Bsale: {e}")

    if nuevos:
        db.add_all(nuevos)
        db.commit()

    return {
        **stats,
        "fecha_desde": str(fecha_desde),
        "fecha_hasta": str(fecha_hasta),
    }


@router.get("/estado")
def estado_bsale():
    """Verifica si el token de Bsale está configurado y la conexión funciona."""
    if not settings.BSALE_TOKEN:
        return {"configurado": False, "mensaje": "BSALE_TOKEN no configurado"}
    try:
        client = _get_client()
        tipos = client.get_document_types()
        return {
            "configurado": True,
            "tipos_documento": len(tipos),
            "mensaje": "Conexión exitosa",
        }
    except Exception as e:
        return {"configurado": True, "mensaje": f"Error: {e}"}
