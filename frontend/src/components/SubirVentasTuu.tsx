import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, X } from "lucide-react";
import api from "../apiInstance";

interface Resultado { archivo: string; agregados: number; duplicados: number; errores: number; }
interface Props { onSubido: () => void; }

export default function SubirVentasTuu({ onSubido }: Props) {
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true); setError(null); setResultado(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post<Resultado>("/ingresos/importar-tuu", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResultado(res.data);
      onSubido();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al procesar el archivo");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button onClick={() => { setOpen(true); setResultado(null); setError(null); }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        <Upload size={15} /> Subir ventas TUU
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="font-semibold text-gray-800">Importar ventas TUU</h2>
                <p className="text-xs text-gray-400 mt-0.5">Reporte PTU.csv.xlsx exportado desde TUU</p>
              </div>
              <button onClick={() => setOpen(false)}><X size={20} className="text-gray-400"/></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {!resultado && (
                <div
                  onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    loading ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
                  }`}>
                  <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  {loading ? (
                    <div className="space-y-2">
                      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"/>
                      <p className="text-sm text-blue-600 font-medium">Procesando ventas…</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload size={32} className="mx-auto text-gray-400"/>
                      <p className="text-sm text-gray-600 font-medium">Arrastrá el Excel o click para seleccionar</p>
                      <p className="text-xs text-gray-400">Archivo PTU exportado desde TUU (.xlsx)</p>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0"/>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {resultado && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-700">
                    <CheckCircle size={20}/>
                    <span className="font-semibold">{resultado.archivo}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label:"Ventas nuevas",   val:resultado.agregados,  color:"bg-blue-50 text-blue-800" },
                      { label:"Ya importadas",   val:resultado.duplicados, color:"bg-gray-50 text-gray-600" },
                      { label:"Errores",         val:resultado.errores,    color:resultado.errores>0?"bg-red-50 text-red-700":"bg-gray-50 text-gray-400" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className={`rounded-lg px-4 py-3 ${color}`}>
                        <div className="text-2xl font-bold">{val}</div>
                        <div className="text-xs mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setResultado(null)}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-800">
                    Subir otro archivo
                  </button>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
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
