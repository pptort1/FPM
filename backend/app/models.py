from sqlalchemy import Integer, String, Date, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id:       Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str]  = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    nombre:   Mapped[str | None] = mapped_column(String(100))
    activo:   Mapped[bool] = mapped_column(Boolean, default=True)

class Ingreso(Base):
    __tablename__ = "ingresos"

    id:            Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    fecha:         Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    mes_devengo:   Mapped[str]  = mapped_column(String(7), nullable=False, index=True)
    cliente:       Mapped[str | None] = mapped_column(String(300))
    descripcion:   Mapped[str]  = mapped_column(String(500), nullable=False)
    monto_total:   Mapped[int]  = mapped_column(Integer, nullable=False)
    tipo_doc:      Mapped[str]  = mapped_column(String(2), nullable=False)   # B/F/NC/ND
    iva:           Mapped[int]  = mapped_column(Integer, nullable=False, default=0)
    monto_neto:    Mapped[int]  = mapped_column(Integer, nullable=False)
    cuenta:        Mapped[str]  = mapped_column(String(10), nullable=False, index=True)
    nombre_cuenta: Mapped[str | None] = mapped_column(String(100))
    canal:         Mapped[str | None] = mapped_column(String(5), index=True)
    # Bsale sync
    bsale_id:      Mapped[str | None] = mapped_column(String(20), unique=True)

class Transaccion(Base):
    __tablename__ = "transacciones"

    id:            Mapped[int]  = mapped_column(Integer, primary_key=True, autoincrement=True)
    fecha_pago:    Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    mes_devengo:   Mapped[str]  = mapped_column(String(7), nullable=False, index=True)
    descripcion:   Mapped[str]  = mapped_column(String(500), nullable=False)
    proveedor:     Mapped[str | None] = mapped_column(String(300))
    monto_total:   Mapped[int]  = mapped_column(Integer, nullable=False)
    tipo_doc:      Mapped[str]  = mapped_column(String(1), nullable=False)
    forma_pago:    Mapped[str]  = mapped_column(String(20), nullable=False)
    nombre_cuenta: Mapped[str | None] = mapped_column(String(100))
    iva:           Mapped[int]  = mapped_column(Integer, nullable=False, default=0)
    monto_neto:    Mapped[int]  = mapped_column(Integer, nullable=False)
    cuenta:        Mapped[str]  = mapped_column(String(10), nullable=False, index=True)
    cc:            Mapped[str]  = mapped_column(String(5), nullable=False, index=True)
    archivo_origen: Mapped[str | None] = mapped_column(String(200))
    # Campos de cartola
    estado:        Mapped[str]  = mapped_column(String(20), nullable=False, default="validado", index=True)
    firma_dedup:   Mapped[str | None] = mapped_column(String(32), unique=True)
    rut:           Mapped[str | None] = mapped_column(String(20))
    confianza:     Mapped[int]  = mapped_column(Integer, nullable=False, default=100)
