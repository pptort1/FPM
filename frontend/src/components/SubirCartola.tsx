import { useState, useRef, useCallback } from "react";
import { Upload, X, CheckCircle } from "lucide-react";
import api from "../apiInstance";

const PLAN_OPTIONS: { cuenta: string; nombre: string; cc: string }[] = [
  { cuenta:"1.1.1", nombre:"Ingredientes",           cc:"CC1" },
  { cuenta:"1.1.2", nombre:"Packaging",              cc:"CC1" },
  { cuenta:"1.1.3", nombre:"Equipamiento Cocina",    cc:"CC1" },
  { cuenta:"1.2.1", nombre:"Sueldos",                cc:"CC2" },
  { cuenta:"1.2.2", nombre:"Honorarios",             cc:"CC2" },
  { cuenta:"1.2.3", nombre:"Asesoría Contable",      cc:"CC2" },
  { cuenta:"1.2.4", nombre:"Uniformes",              cc:"CC2" },
  { cuenta:"1.3.1", nombre:"Arriendo",               cc:"CC3" },
  { cuenta:"1.3.2", nombre:"Agua",                   cc:"CC3" },
  { cuenta:"1.3.3", nombre:"Luz",                    cc:"CC3" },
  { cuenta:"1.3.4", nombre:"Gas",                    cc:"CC3" },
  { cuenta:"1.3.5", nombre:"Telecomunicaciones",     cc:"CC3" },
  { cuenta:"1.3.6", nombre:"Mantenciones",           cc:"CC3" },
  { cuenta:"1.3.7", nombre:"Fumigaciones",           cc:"CC3" },
  { cuenta:"1.3.8", nombre:"Limpieza y Aseo",        cc:"CC3" },
  { cuenta:"1.3.9", nombre:"Seguridad",              cc:"CC3" },
  { cuenta:"1.3.10",nombre:"Equipamiento Local",     cc:"CC3" },
  { cuenta:"1.4.1", nombre:"Inversión Carro",        cc:"CC4" },
  { cuenta:"1.4.2", nombre:"Mantención Carro",       cc:"CC4" },
  { cuenta:"1.4.5", nombre:"Sueldos Carro",          cc:"CC4" },
  { cuenta:"1.5.1", nombre:"Plataformas Digitales",  cc:"CC5" },
  { cuenta:"1.6.1", nombre:"RRSS",                   cc:"CC6" },
  { cuenta:"1.6.2", nombre:"Producción Audiovisual", cc:"CC6" },
  { cuenta:"1.6.3", nombre:"Ferias y Eventos",       cc:"CC6" },
  { cuenta:"1.7.1", nombre:"Despachos B2B",          cc:"CC7" },
  { cuenta:"1.7.2", nombre:"Despachos B2C",          cc:"CC7" },
  { cuenta:"1.7.3", nombre:"Transporte Personas",    cc:"CC7" },
  { cuenta:"1.8.1", nombre:"Comisión POS",           cc:"CC8" },
  { cuenta:"1.8.2", nombre:"Comisión Delivery",      cc:"CC8" },
  { cuenta:"1.9.1", nombre:"IVA F29",                cc:"CC9" },
  { cuenta:"1.9.4", nombre:"Patente Comercial",      cc:"CC9" },
  { cuenta:"1.9.5", nombre:"Gastos Bancarios",       cc:"CC9" },
];

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  nuevo:          { label: "Nuevo",          cls: "bg-emerald-100 text-emerald-700" },
  sin_clasificar: { label: "Sin clasificar", cls: "bg-orange-100 text-orange-700" },
  duplicado:      { label: "Duplicado",       cls: "bg-gray-100 text-gray-500" },
  excluido:       { label: "Excluido",        cls: "bg-gray-100 text-gray-400" },
  ingreso:        { label: "Ingreso",         cls: "bg-blue-100 text-blue-600" },
};

const CC_BADGE: Record<string, string> = {
  CC1:"bg-green-100 text-green-700", CC2:"bg-blue-100 text-blue-700",
  CC3:"bg-purple-100 text-purple-700", CC4:"bg-orange-100 text-orange-700",
  CC5:"bg-cyan-100 text-cyan-700", CC6:"bg-pink-100 text-pink-700",
  CC7:"bg-yellow-100 text-yellow-700", CC8:"bg-red-100 text-red-700",
  CC9:"bg-gray-100 text-gray-700",
};

interface Fila {
  tipo_mov: string; fecha: string; mes_devengo?: string;
  monto: number; descripcion: string; proveedor?: string; rut?: string;
  cuenta?: string; cc?: string; nombre_cuenta?: string; tipo_doc?: string;
  forma_pago?: string; iva?: number; monto_neto?: number;
  confianza?: number; estado_import: string; firma?: string;
  seleccionado: boolean;
  archivo_origen?: string;
}

interface Preview {
  archivo: string;
  stats: { nuevos: number; duplicados: number; excluidos: number; ingresos: number };
  filas: Fila[];
}

interface Props { onSubido: () => void; }

export default function SubirCartola({ onSubido }: Props) {
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [preview, setPreview]     = useState<Preview | null>(null);
  const [filas, setFilas]         = useState<Fila[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [guardado, setGuardado]   = useState<number | null>(null);
  const [soloNuevos, setSoloNuevos] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null); setFilas([]); setError(null);
    setGuardado(null); setSoloNuevos(true);
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true); setError(null); reset();
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post<Preview>("/cartolas/preview", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(res.data);
      setFilas(res.data.filas);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al procesar el archivo");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFila = (i: number) => {
    setFilas(prev => prev.map((f, idx) =>
      idx === i ? { ...f, seleccionado: !f.seleccionado } : f
    ));
  };

  const asignarCuenta = (i: number, cuentaVal: string) => {
    if (!cuentaVal) return;
    const opt = PLAN_OPTIONS.find(o => o.cuenta === cuentaVal);
    if (!opt) return;
    setFilas(prev => prev.map((f, idx) =>
      idx === i ? {
        ...f,
        cuenta: opt.cuenta,
        cc: opt.cc,
        nombre_cuenta: opt.nombre,
        estado_import: "nuevo",
        seleccionado: true,
        confianza: 80,
        // recalcular IVA según tipo_doc (F = con IVA, S = sin IVA)
        iva: f.tipo_doc === "F" ? Math.round(f.monto * 19 / 119) : 0,
        monto_neto: f.tipo_doc === "F" ? f.monto - Math.round(f.monto * 19 / 119) : f.monto,
      } : f
    ));
  };

  const toggleAll = (val: boolean) => {
    setFilas(prev => prev.map(f =>
      (f.estado_import === "nuevo" || f.estado_import === "sin_clasificar")
        ? { ...f, seleccionado: val } : f
    ));
  };

  const handleConfirmar = async () => {
    const seleccionadas = filas.filter(f => f.seleccionado && f.tipo_mov === "egreso");
    if (!seleccionadas.length) return;
    setGuardando(true);
    try {
      const body = {
        filas: seleccionadas.map(f => ({
          fecha:         f.fecha,
          mes_devengo:   f.mes_devengo ?? "",
          descripcion:   f.descripcion,
          proveedor:     f.proveedor ?? null,
          rut:           f.rut ?? null,
          monto_total:   f.monto,
          tipo_doc:      f.tipo_doc ?? "S",
          forma_pago:    f.forma_pago ?? "Debito",
          nombre_cuenta: f.nombre_cuenta ?? null,
          iva:           f.iva ?? 0,
          monto_neto:    f.monto_neto ?? f.monto,
          cuenta:        f.cuenta ?? "",
          cc:            f.cc ?? "",
          archivo_origen: preview?.archivo ?? null,
          firma:         f.firma ?? null,
          confianza:     f.confianza ?? 0,
        })),
      };
      const res = await api.post<{ agregados: number }>("/cartolas/confirmar", body);
      setGuardado(res.data.agregados);
      onSubido();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  const filasVista = soloNuevos
    ? filas.filter(f => f.estado_import === "nuevo" || f.estado_import === "sin_clasificar")
    : filas;
  const nSeleccionados = filas.filter(f => f.seleccionado && f.tipo_mov === "egreso").length;
  const nNuevos = filas.filter(f => f.estado_import === "nuevo" || f.estado_import === "sin_clasificar").length;

  return (
    <>
      <button onClick={() => { setOpen(true); reset(); }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        <Upload size={15} /> Subir cartola
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
            <div>
              <h2 className="font-semibold text-gray-800">
                {preview ? `Revisión — ${preview.archivo}` : "Subir cartola Santander"}
              </h2>
              {preview && (
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="text-emerald-600 font-medium">{preview.stats.nuevos} nuevos</span>
                  <span className="text-gray-400">{preview.stats.duplicados} duplicados</span>
                  <span className="text-gray-400">{preview.stats.excluidos} excluidos</span>
                  <span className="text-blue-500">{preview.stats.ingresos} ingresos</span>
                </div>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
              <X size={22} />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Zona de drop inicial */}
            {!preview && !loading && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div
                  onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => inputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors max-w-lg w-full">
                  <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <Upload size={40} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 font-medium">Arrastrá el Excel o click para seleccionar</p>
                  <p className="text-xs text-gray-400 mt-2">Cartola cuenta corriente Santander (.xlsx)</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="animate-spin w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                  <p className="text-sm text-blue-600 font-medium">Clasificando transacciones…</p>
                </div>
              </div>
            )}

            {error && (
              <div className="m-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
            )}

            {/* Tabla de preview */}
            {preview && !guardado && (
              <>
                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 shrink-0 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={soloNuevos} onChange={e => setSoloNuevos(e.target.checked)}
                      className="rounded" />
                    Solo nuevos ({nNuevos})
                  </label>
                  <button onClick={() => toggleAll(true)}
                    className="text-xs text-blue-600 hover:underline">Seleccionar todos</button>
                  <button onClick={() => toggleAll(false)}
                    className="text-xs text-gray-500 hover:underline">Deseleccionar todos</button>
                  <span className="ml-auto text-xs text-gray-500">
                    {nSeleccionados} seleccionados para importar
                  </span>
                </div>

                {/* Tabla */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 w-8"></th>
                        <th className="text-left px-3 py-2">Estado</th>
                        <th className="text-left px-3 py-2">Fecha</th>
                        <th className="text-left px-3 py-2 w-80">Descripción</th>
                        <th className="text-right px-3 py-2">Monto</th>
                        <th className="text-left px-3 py-2">Cuenta</th>
                        <th className="text-center px-3 py-2">CC</th>
                        <th className="text-center px-3 py-2">Conf.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasVista.map((fila, i) => {
                        const realIdx = filas.indexOf(fila);
                        const badge = ESTADO_BADGE[fila.estado_import] ?? { label: fila.estado_import, cls: "bg-gray-100 text-gray-600" };
                        const editable = fila.estado_import === "nuevo" || fila.estado_import === "sin_clasificar";
                        return (
                          <tr key={i}
                            onClick={() => editable && toggleFila(realIdx)}
                            className={`border-b border-gray-100 ${editable ? "cursor-pointer hover:bg-blue-50/30" : "opacity-50"}
                              ${fila.seleccionado ? "bg-emerald-50/40" : ""}`}>
                            <td className="px-4 py-2.5 text-center">
                              {editable && (
                                <input type="checkbox" checked={fila.seleccionado}
                                  onChange={() => toggleFila(realIdx)}
                                  onClick={e => e.stopPropagation()}
                                  className="rounded cursor-pointer" />
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{fila.fecha}</td>
                            <td className="px-3 py-2.5 max-w-xs">
                              <div className="truncate text-gray-800" title={fila.descripcion}>{fila.descripcion}</div>
                              {fila.proveedor && fila.proveedor !== fila.descripcion && (
                                <div className="truncate text-xs text-gray-400">{fila.proveedor}</div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-gray-800 whitespace-nowrap">
                              {fmt(fila.monto)}
                            </td>
                            <td className="px-3 py-2.5 text-xs" onClick={e => e.stopPropagation()}>
                              {editable ? (
                                <select
                                  value={fila.cuenta ?? ""}
                                  onChange={e => asignarCuenta(realIdx, e.target.value)}
                                  className={`w-full text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                                    fila.cuenta ? "border-gray-200 text-gray-700" : "border-orange-300 text-orange-600 bg-orange-50"
                                  }`}
                                >
                                  <option value="">— Sin clasificar —</option>
                                  {PLAN_OPTIONS.map(o => (
                                    <option key={o.cuenta} value={o.cuenta}>
                                      {o.cuenta} {o.nombre} ({o.cc})
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-gray-400">
                                  {fila.nombre_cuenta ?? "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {fila.cc && (
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${CC_BADGE[fila.cc] ?? "bg-gray-100"}`}>
                                  {fila.cc}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center text-xs">
                              {fila.confianza !== undefined && fila.confianza > 0 && (
                                <span className={`font-medium ${fila.confianza >= 85 ? "text-emerald-600" : "text-orange-500"}`}>
                                  {fila.confianza}%
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Guardado OK */}
            {guardado !== null && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <CheckCircle size={48} className="mx-auto text-emerald-500" />
                  <p className="text-xl font-semibold text-gray-800">{guardado} transacciones importadas</p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => { reset(); }}
                      className="px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                      Subir otra cartola
                    </button>
                    <button onClick={() => setOpen(false)}
                      className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer con botón confirmar */}
          {preview && !guardado && (
            <div className="px-6 py-4 border-t border-gray-200 bg-white shrink-0 flex items-center justify-between">
              <button onClick={() => reset()}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
                ← Subir otro archivo
              </button>
              <button
                onClick={handleConfirmar}
                disabled={nSeleccionados === 0 || guardando}
                className="px-6 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors">
                {guardando ? "Guardando…" : `Importar ${nSeleccionados} transacciones`}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
