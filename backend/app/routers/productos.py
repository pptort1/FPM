from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select
import io, openpyxl

from ..database import get_db
from ..models import Producto

router = APIRouter(prefix="/api/productos", tags=["productos"])


@router.get("")
def listar_productos(db: Session = Depends(get_db)):
    rows = db.execute(select(Producto).where(Producto.activo == True)
                      .order_by(Producto.nombre, Producto.variante)).scalars().all()
    return [{"sku": p.sku, "nombre": p.nombre, "variante": p.variante,
             "precio_final": p.precio_final} for p in rows]


@router.post("/importar")
def importar_sku(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contenido = file.file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)
    rows = list(wb.active.iter_rows(min_row=2, values_only=True))
    wb.close()

    actualizados = nuevos = 0
    for r in rows:
        if not r[0]: continue
        sku = str(r[0]).strip()
        existing = db.get(Producto, sku)
        if existing:
            existing.nombre       = str(r[1] or "").strip()
            existing.variante     = str(r[2]).strip() if r[2] else None
            existing.precio_final = int(r[3] or 0)
            actualizados += 1
        else:
            db.add(Producto(sku=sku, nombre=str(r[1] or "").strip(),
                            variante=str(r[2]).strip() if r[2] else None,
                            precio_final=int(r[3] or 0)))
            nuevos += 1

    db.commit()
    return {"nuevos": nuevos, "actualizados": actualizados, "total": nuevos + actualizados}
