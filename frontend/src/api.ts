import axios from "axios";

const api = axios.create({ baseURL: "/api" });

export interface Transaccion {
  id: number;
  fecha_pago: string;
  mes_devengo: string;
  descripcion: string;
  proveedor: string | null;
  monto_total: number;
  tipo_doc: string;
  forma_pago: string;
  nombre_cuenta: string | null;
  iva: number;
  monto_neto: number;
  cuenta: string;
  cc: string;
  archivo_origen: string | null;
}

export interface ListaEgresos {
  total: number;
  items: Transaccion[];
  pagina: number;
  por_pagina: number;
}

export interface ResumenCC {
  cc: string;
  nombre: string;
  n_tx: number;
  monto_neto: number;
}

export interface ResumenMes {
  mes: string;
  monto_neto: number;
}

export interface FiltrosOpciones {
  meses: string[];
  ccs: { value: string; label: string }[];
  forma_pago: string[];
}

export interface FiltrosEgresos {
  mes?: string;
  cc?: string;
  forma_pago?: string;
  cuenta?: string;
  search?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  pagina?: number;
  por_pagina?: number;
}

export const egresosApi = {
  listar: (filtros: FiltrosEgresos) =>
    api.get<ListaEgresos>("/egresos", { params: filtros }).then((r) => r.data),

  resumenCC: (params?: { mes?: string; fecha_desde?: string; fecha_hasta?: string }) =>
    api.get<ResumenCC[]>("/egresos/resumen/cc", { params }).then((r) => r.data),

  resumenMes: (params?: { cc?: string }) =>
    api.get<ResumenMes[]>("/egresos/resumen/mes", { params }).then((r) => r.data),

  opciones: () =>
    api.get<FiltrosOpciones>("/egresos/filtros/opciones").then((r) => r.data),
};
