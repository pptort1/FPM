import { useState, useRef } from "react";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import axios from "axios";

const BASE = import.meta.env.VITE_API_URL ?? "";

interface Resultado {
  archivo: string;
  total_leidos: number;
  agregados: number;
  duplicados: number;
  excluidos: number;
  ingresos: number;
  revision: number;
}

interface Props {
  onSubido: () => void;  // callback para refrescar la tabla
}

export default function SubirCartola({ onSubido }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setResultado(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await axios.post<Resultado>(`${BASE}/api/cartolas/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResultado(res.data);
      onSubido();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al procesar el archivo");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setResultado(null); setError(null); }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Upload size={15} /> Subir cartola
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">Subir cartola Santander</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Zona de drop */}
              {!resultado && (
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    loading ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  {loading ? (
                    <div className="space-y-2">
                      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                      <p className="text-sm text-blue-600 font-medium">Procesando…</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload size={32} className="mx-auto text-gray-400" />
                      <p className="text-sm text-gray-600 font-medium">Arrastrá el Excel o click para seleccionar</p>
                      <p className="text-xs text-gray-400">Cartola cuenta corriente Santander (.xlsx)</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Resultado */}
              {resultado && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle size={20} />
                    <span className="font-semibold">Procesado: {resultado.archivo}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Total leídos",  val: resultado.total_leidos,  color: "bg-gray-50  text-gray-800" },
                      { label: "Agregados",      val: resultado.agregados,     color: "bg-emerald-50 text-emerald-800" },
                      { label: "Duplicados",     val: resultado.duplicados,    color: "bg-yellow-50 text-yellow-800" },
                      { label: "Excluidos",      val: resultado.excluidos,     color: "bg-gray-50  text-gray-500" },
                      { label: "Ingresos detect.",val: resultado.ingresos,     color: "bg-blue-50  text-blue-800" },
                      { label: "Para revisión",  val: resultado.revision,      color: "bg-orange-50 text-orange-800" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className={`rounded-lg px-4 py-3 ${color}`}>
                        <div className="text-2xl font-bold">{val}</div>
                        <div className="text-xs mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {resultado.revision > 0 && (
                    <p className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                      ⚠ {resultado.revision} movimientos quedaron sin clasificar — buscalos en egresos filtrando por estado "revisión".
                    </p>
                  )}

                  <button
                    onClick={() => { setResultado(null); }}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Subir otra cartola
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
