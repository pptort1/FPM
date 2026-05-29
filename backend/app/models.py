from sqlalchemy import Integer, String, Date, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class Transaccion(Base):
    __tablename__ = "transacciones"

    id:            Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    fecha_pago:    Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    mes_devengo:   Mapped[str]  = mapped_column(String(7), nullable=False, index=True)
    descripcion:   Mapped[str]  = mapped_column(String(500), nullable=False)
    proveedor:     Mapped[str | None] = mapped_column(String(300))
    monto_total:   Mapped[int]  = mapped_column(Integer, nullable=False)
    tipo_doc:      Mapped[str]  = mapped_column(String(1), nullable=False)   # F / S
    forma_pago:    Mapped[str]  = mapped_column(String(20), nullable=False)  # Debito / Credito
    nombre_cuenta: Mapped[str | None] = mapped_column(String(100))
    iva:           Mapped[int]  = mapped_column(Integer, nullable=False, default=0)
    monto_neto:    Mapped[int]  = mapped_column(Integer, nullable=False)
    cuenta:        Mapped[str]  = mapped_column(String(10), nullable=False, index=True)
    cc:            Mapped[str]  = mapped_column(String(5), nullable=False, index=True)
    archivo_origen: Mapped[str | None] = mapped_column(String(200))
