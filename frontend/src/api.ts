import api from "./apiInstance";

export interface Transaccion {
  id: number; fecha_pago: string; mes_devengo: string;
  descripcion: string; proveedor: string | null;
  monto_total: number; tipo_doc: string; forma_pago: string;
  nombre_cuenta: string | null; iva: number; monto_neto: number;
  cuenta: string; cc: string; archivo_origen: string | null;
}
export interface Ingreso {
  id: number; fecha: string; mes_devengo: string;
  cliente: string | null; descripcion: string;
  monto_total: number; tipo_doc: string; iva: number; monto_neto: number;
  cuenta: string; nombre_cuenta: string | null; canal: string | null;
}
export interface ListaEgresos { total: number; items: Transaccion[]; pagina: number; por_pagina: number; }
export interface ListaIngresos { total: number; items: Ingreso[]; pagina: number; por_pagina: number; }
export interface ResumenCC { cc: string; nombre: string; n_tx: number; monto_neto: number; }
export interface ResumenCanal { canal: string; nombre: string; n_tx: number; monto_neto: number; }
export interface FiltrosOpciones { meses: string[]; ccs: { value: string; label: string }[]; forma_pago: string[]; }
export interface FiltrosIngresosOpciones { meses: string[]; canales: { value: string; label: string }[]; tipo_doc: string[]; }

export interface FilaFlujo { codigo: string; nombre: string; valores: Record<string, number>; }
export interface SeccionCC { cc: string; nombre: string; filas: FilaFlujo[]; total: Record<string, number>; }
export interface FlujoCaja {
  meses: string[];
  ingresos: { filas: FilaFlujo[]; total: Record<string, number> };
  costos: { secciones: SeccionCC[]; total: Record<string, number> };
  margen: Record<string, number>;
  margen_pct: Record<string, number>;
}

export const egresosApi = {
  listar: (p: any) => api.get<ListaEgresos>("/egresos", { params: p }).then(r => r.data),
  resumenCC: (p?: any) => api.get<ResumenCC[]>("/egresos/resumen/cc", { params: p }).then(r => r.data),
  opciones: () => api.get<FiltrosOpciones>("/egresos/filtros/opciones").then(r => r.data),
};

export const ingresosApi = {
  listar: (p: any) => api.get<ListaIngresos>("/ingresos", { params: p }).then(r => r.data),
  resumenCanal: (p?: any) => api.get<ResumenCanal[]>("/ingresos/resumen/canal", { params: p }).then(r => r.data),
  opciones: () => api.get<FiltrosIngresosOpciones>("/ingresos/filtros/opciones").then(r => r.data),
};

export const flujoApi = {
  get: () => api.get<FlujoCaja>("/flujo").then(r => r.data),
};
