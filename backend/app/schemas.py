from pydantic import BaseModel
from datetime import date

CC_NOMBRES = {
    "CC1": "Costos Producto",
    "CC2": "Sueldos",
    "CC3": "Infraestructura",
    "CC4": "Carrito",
    "CC5": "Plataformas Digitales",
    "CC6": "Marketing",
    "CC7": "Logistica",
    "CC8": "Comisiones",
    "CC9": "Impuestos y Bancario",
}

class TransaccionOut(BaseModel):
    id:            int
    fecha_pago:    date
    mes_devengo:   str
    descripcion:   str
    proveedor:     str | None
    monto_total:   int
    tipo_doc:      str
    forma_pago:    str
    nombre_cuenta: str | None
    iva:           int
    monto_neto:    int
    cuenta:        str
    cc:            str
    archivo_origen: str | None
    rut:            str | None = None
    estado:         str | None = None

    model_config = {"from_attributes": True}

class ResumenCC(BaseModel):
    cc:          str
    nombre:      str
    n_tx:        int
    monto_neto:  int

class ResumenMes(BaseModel):
    mes:         str
    monto_neto:  int

class ListaEgresos(BaseModel):
    total:        int
    items:        list[TransaccionOut]
    pagina:       int
    por_pagina:   int
