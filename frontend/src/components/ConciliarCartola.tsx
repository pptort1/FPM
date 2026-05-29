import { useState, useRef, useCallback } from "react";
import { GitMerge, X, CheckCircle, Check } from "lucide-react";
import api from "../apiInstance";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fmtDiff = (d: number) => (d > 0 ? "+" : "") + fmt(d);

const PLAN_OPTIONS = [
  {cuenta:"1.1.1",nombre:"Ingredientes",cc:"CC1"},{cuenta:"1.1.2",nombre:"Packaging",cc:"CC1"},
  {cuenta:"1.1.3",nombre:"Equip. Cocina",cc:"CC1"},{cuenta:"1.2.1",nombre:"Sueldos",cc:"CC2"},
  {cuenta:"1.2.2",nombre:"Honorarios",cc:"CC2"},{cuenta:"1.2.3",nombre:"Asesoría Contable",cc:"CC2"},
  {cuenta:"1.2.4",nombre:"Uniformes",cc:"CC2"},{cuenta:"1.3.1",nombre:"Arriendo",cc:"CC3"},
  {cuenta:"1.3.2",nombre:"Agua",cc:"CC3"},{cuenta:"1.3.3",nombre:"Luz",cc:"CC3"},
  {cuenta:"1.3.4",nombre:"Gas",cc:"CC3"},{cuenta:"1.3.5",nombre:"Telecom",cc:"CC3"},
  {cuenta:"1.3.6",nombre:"Mantenciones",cc:"CC3"},{cuenta:"1.3.7",nombre:"Fumigaciones",cc:"CC3"},
  {cuenta:"1.3.8",nombre:"Limpieza",cc:"CC3"},{cuenta:"1.3.9",nombre:"Seguridad",cc:"CC3"},
  {cuenta:"1.3.10",nombre:"Equip. Local",cc:"CC3"},{cuenta:"1.4.1",nombre:"Inv. Carro",cc:"CC4"},
  {cuenta:"1.4.2",nombre:"Mant. Carro",cc:"CC4"},{cuenta:"1.4.5",nombre:"Sueldos Carro",cc:"CC4"},
  {cuenta:"1.5.1",nombre:"Plataformas",cc:"CC5"},{cuenta:"1.6.1",nombre:"RRSS",cc:"CC6"},
  {cuenta:"1.6.2",nombre:"Audiovisual",cc:"CC6"},{cuenta:"1.6.3",nombre:"Ferias",cc:"CC6"},
  {cuenta:"1.7.1",nombre:"Despachos B2B",cc:"CC7"},{cuenta:"1.7.2",nombre:"Despachos B2C",cc:"CC7"},
  {cuenta:"1.7.3",nombre:"Transporte",cc:"CC7"},{cuenta:"1.8.1",nombre:"Comisión POS",cc:"CC8"},
  {cuenta:"1.8.2",nombre:"Comisión Delivery",cc:"CC8"},{cuenta:"1.9.1",nombre:"IVA F29",cc:"CC9"},
  {cuenta:"1.9.4",nombre:"Patente",cc:"CC9"},{cuenta:"1.9.5",nombre:"Gastos Bancarios",cc:"CC9"},
];

interface Fila {
  estado_concilia: string;
  fecha: string; monto_banco: number; descripcion: string;
  tx_id?: number; monto_registrado?: number; diff?: number; desc_registrada?: string;
  cuenta?: string; cc?: string; nombre_cuenta?: string;
  tipo_doc?: string; forma_pago?: string; iva?: number; monto_neto?: number;
  mes_devengo?: string; proveedor?: string; rut?: string;
  confianza?: number; estado_import?: string; firma?: string;
  seleccionado: boolean;
}

interface Preview {
  archivo: string;
  stats: { ya_registrado:number; match_banco:number; nuevo:number; excluidos:number; ingresos:number };
  filas: Fila[];
}

const CC_BADGE: Record<string,string> = {
  CC1:"bg-green-100 text-green-700", CC2:"bg-blue-100 text-blue-700",
  CC3:"bg-purple-100 text-purple-700", CC4:"bg-orange-100 text-orange-700",
  CC5:"bg-cyan-100 text-cyan-700", CC6:"bg-pink-100 text-pink-700",
  CC7:"bg-yellow-100 text-yellow-700", CC8:"bg-red-100 text-red-700",
  CC9:"bg-gray-100 text-gray-700",
};

interface Props { onConciliado: () => void; }

export default function ConciliarCartola({ onConciliado }: Props) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [preview, setPreview]   = useState<Preview | null>(null);
  const [filas, setFilas]       = useState<Fila[]>([]);
  const [error, setError]       = useState<string|null>(null);
  const [resultado, setResultado] = useState<{actualizados:number;nuevos:number}|null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setPreview(null); setFilas([]); setError(null); setResultado(null); };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true); setError(null); reset();
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post<Preview>("/cartolas/conciliar/preview", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(res.data);
      setFilas(res.data.filas);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al procesar");
    } finally { setLoading(false); }
  }, []);

  const toggle = (i: number) => setFilas(p => p.map((f,idx) => idx===i ? {...f,seleccionado:!f.seleccionado} : f));

  const asignarCuenta = (i: number, cuentaVal: string) => {
    const opt = PLAN_OPTIONS.find(o => o.cuenta === cuentaVal);
    if (!opt) return;
    const iva = filas[i].tipo_doc === "F" ? Math.round((filas[i].monto_banco * 19) / 119) : 0;
    setFilas(p => p.map((f,idx) => idx===i ? {
      ...f, cuenta:opt.cuenta, cc:opt.cc, nombre_cuenta:opt.nombre,
      estado_import:"nuevo", seleccionado:true,
      iva, monto_neto: f.monto_banco - iva,
    } : f));
  };

  const confirmar = async () => {
    const acciones = filas.filter(f => f.seleccionado);
    if (!acciones.length) return;
    setGuardando(true);
    try {
      const res = await api.post("/cartolas/conciliar/confirmar", { acciones });
      setResultado(res.data);
      onConciliado();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al confirmar");
    } finally { setGuardando(false); }
  };

  const nSel = filas.filter(f => f.seleccionado).length;

  const ESTADO_INFO: Record<string, {label:string; cls:string; desc:string}> = {
    ya_registrado: { label:"Ya registrado", cls:"bg-gray-100 text-gray-500", desc:"Coincidencia exacta — no se toca" },
    match_banco:   { label:"Match ~banco",  cls:"bg-yellow-100 text-yellow-700", desc:"Monto banco gana si aceptás" },
    nuevo:         { label:"Nuevo",         cls:"bg-emerald-100 text-emerald-700", desc:"No está registrado" },
    sin_clasificar:{ label:"Sin clasificar",cls:"bg-orange-100 text-orange-700", desc:"Clasificar antes de importar" },
  };

  return (
    <>
      <button onClick={() => { setOpen(true); reset(); }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
        <GitMerge size={15} /> Conciliar cartola
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
            <div>
              <h2 className="font-semibold text-gray-800">
                {preview ? `Conciliación — ${preview.archivo}` : "Conciliar cartola bancaria"}
              </h2>
              {preview && (
                <div className="flex gap-4 mt-1 text-xs">
                  <span className="text-gray-400">✓ {preview.stats.ya_registrado} ya registrados</span>
                  <span className="text-yellow-600 font-medium">~ {preview.stats.match_banco} match banco</span>
                  <span className="text-emerald-600 font-medium">+ {preview.stats.nuevo} nuevos</span>
                  <span className="text-gray-300">{preview.stats.excluidos} excluidos</span>
                </div>
              )}
            </div>
            <button onClick={() => setOpen(false)}><X size={22} className="text-gray-400"/></button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            {!preview && !loading && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div
                  onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => inputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 rounded-2xl p-16 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 max-w-lg w-full">
                  <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <GitMerge size={40} className="mx-auto text-indigo-300 mb-4"/>
                  <p className="text-gray-600 font-medium">Arrastrá la cartola o click para seleccionar</p>
                  <p className="text-xs text-gray-400 mt-2">Compara contra los egresos registrados</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="animate-spin w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"/>
                  <p className="text-sm text-indigo-600 font-medium">Conciliando transacciones…</p>
                </div>
              </div>
            )}

            {error && <div className="m-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}

            {preview && !resultado && (
              <>
                <div className="px-6 py-2 border-b bg-gray-50 shrink-0 flex items-center gap-4 text-xs">
                  <span className="text-gray-500">Banco gana en todos los match aproximados. Desseleccioná si no querés aplicar alguno.</span>
                  <span className="ml-auto text-gray-600 font-medium">{nSel} acciones seleccionadas</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 border-b text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 w-8"></th>
                        <th className="text-left px-3 py-2">Estado</th>
                        <th className="text-left px-3 py-2">Fecha</th>
                        <th className="text-left px-3 py-2 w-72">Descripción banco</th>
                        <th className="text-right px-3 py-2">Monto banco</th>
                        <th className="text-right px-3 py-2">Registrado</th>
                        <th className="text-right px-3 py-2">Diferencia</th>
                        <th className="text-left px-3 py-2">Cuenta</th>
                        <th className="text-center px-3 py-2">CC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((fila, i) => {
                        const st = ESTADO_INFO[fila.estado_import ?? fila.estado_concilia] ?? ESTADO_INFO[fila.estado_concilia];
                        const editable = fila.estado_concilia !== "ya_registrado";
                        const esNuevo  = fila.estado_concilia === "nuevo";
                        return (
                          <tr key={i}
                            onClick={() => editable && toggle(i)}
                            className={`border-b border-gray-100 ${editable?"cursor-pointer hover:bg-indigo-50/20":"opacity-40"}
                              ${fila.seleccionado && editable ? "bg-indigo-50/30":""}`}>
                            <td className="px-4 py-2.5 text-center">
                              {editable && (
                                <input type="checkbox" checked={fila.seleccionado}
                                  onChange={() => toggle(i)} onClick={e => e.stopPropagation()}
                                  className="rounded cursor-pointer"/>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st?.cls}`} title={st?.desc}>
                                {st?.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fila.fecha}</td>
                            <td className="px-3 py-2.5 max-w-xs">
                              <div className="truncate text-gray-800" title={fila.descripcion}>{fila.descripcion}</div>
                              {fila.desc_registrada && fila.desc_registrada !== fila.descripcion && (
                                <div className="truncate text-xs text-gray-400 italic" title={fila.desc_registrada}>
                                  ← {fila.desc_registrada}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-800 whitespace-nowrap">
                              {fmt(fila.monto_banco)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-gray-400 whitespace-nowrap">
                              {fila.monto_registrado ? fmt(fila.monto_registrado) : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">
                              {fila.diff != null && fila.diff !== 0 ? (
                                <span className={fila.diff > 0 ? "text-red-500" : "text-emerald-600"}>
                                  {fmtDiff(fila.diff)}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                              {esNuevo ? (
                                <select value={fila.cuenta ?? ""} onChange={e => asignarCuenta(i, e.target.value)}
                                  className={`text-xs border rounded px-1.5 py-1 w-48 focus:outline-none ${
                                    fila.cuenta ? "border-gray-200 text-gray-700" : "border-orange-300 text-orange-600 bg-orange-50"
                                  }`}>
                                  <option value="">— Sin clasificar —</option>
                                  {PLAN_OPTIONS.map(o => (
                                    <option key={o.cuenta} value={o.cuenta}>{o.cuenta} {o.nombre} ({o.cc})</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs text-gray-500">{fila.nombre_cuenta ?? "—"}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {fila.cc && (
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${CC_BADGE[fila.cc]??"bg-gray-100"}`}>
                                  {fila.cc}
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

            {resultado && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <CheckCircle size={48} className="mx-auto text-indigo-500"/>
                  <p className="text-xl font-semibold text-gray-800">Conciliación completada</p>
                  <div className="flex gap-6 justify-center text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{resultado.actualizados}</div>
                      <div className="text-gray-500">actualizados (banco ganó)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{resultado.nuevos}</div>
                      <div className="text-gray-500">nuevos agregados</div>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center mt-4">
                    <button onClick={reset} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">
                      Conciliar otra cartola
                    </button>
                    <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {preview && !resultado && (
            <div className="px-6 py-4 border-t bg-white shrink-0 flex items-center justify-between">
              <button onClick={reset} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                ← Subir otra
              </button>
              <button onClick={confirmar} disabled={nSel===0||guardando}
                className="px-6 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40">
                {guardando ? "Aplicando…" : `Aplicar ${nSel} acciones`}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
