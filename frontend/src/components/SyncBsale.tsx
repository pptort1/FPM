import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle, X } from "lucide-react";
import axios from "axios";

const BASE = import.meta.env.VITE_API_URL ?? "";

interface Resultado {
  agregados: number;
  duplicados: number;
  errores: number;
  fecha_desde: string;
  fecha_hasta: string;
}

interface Props {
  onSyncado: () => void;
}

export default function SyncBsale({ onSyncado }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(1); // primer día del mes actual
    d.setMonth(d.getMonth() - 2); // 2 meses atrás
    return d.toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const res = await axios.post<Resultado>(
        `${BASE}/api/bsale/sync?fecha_desde=${desde}&fecha_hasta=${hasta}`
      );
      setResultado(res.data);
      onSyncado();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al sincronizar con Bsale");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setResultado(null); setError(null); }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
      >
        <RefreshCw size={15} /> Sync Bsale
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-semibold text-gray-800">Sincronizar desde Bsale</h2>
                <p className="text-xs text-gray-400 mt-0.5">Importa documentos de venta (boletas, facturas, NC)</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {!resultado && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                      <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                      <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    Los documentos ya importados se omiten automáticamente (deduplicación por ID Bsale).
                  </p>
                </>
              )}

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {resultado && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle size={20} />
                    <span className="font-semibold">Sync completado</span>
                  </div>
                  <p className="text-xs text-gray-400">{resultado.fecha_desde} → {resultado.fecha_hasta}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Nuevos",     val: resultado.agregados,  color: "bg-emerald-50 text-emerald-800" },
                      { label: "Existentes", val: resultado.duplicados, color: "bg-gray-50 text-gray-600" },
                      { label: "Errores",    val: resultado.errores,    color: resultado.errores > 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-400" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className={`rounded-lg px-4 py-3 ${color}`}>
                        <div className="text-2xl font-bold">{val}</div>
                        <div className="text-xs mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setResultado(null)}
                    className="w-full py-2 text-sm text-emerald-600 hover:text-emerald-800">
                    Sync otro período
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cerrar
              </button>
              {!resultado && (
                <button onClick={handleSync} disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {loading ? <><RefreshCw size={14} className="animate-spin" /> Sincronizando…</> : "Sincronizar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
