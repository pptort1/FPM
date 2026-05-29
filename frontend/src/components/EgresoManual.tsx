import { useState } from "react";
import { X, Download, PlusCircle } from "lucide-react";
import api from "../apiInstance";

const BASE = import.meta.env.VITE_API_URL ?? "";

const PLAN_OPTIONS = [
  { cuenta:"1.1.1",nombre:"Ingredientes",cc:"CC1" },
  { cuenta:"1.1.2",nombre:"Packaging",cc:"CC1" },
  { cuenta:"1.1.3",nombre:"Equipamiento Cocina",cc:"CC1" },
  { cuenta:"1.2.1",nombre:"Sueldos",cc:"CC2" },
  { cuenta:"1.2.2",nombre:"Honorarios",cc:"CC2" },
  { cuenta:"1.2.3",nombre:"Asesoría Contable",cc:"CC2" },
  { cuenta:"1.2.4",nombre:"Uniformes",cc:"CC2" },
  { cuenta:"1.3.1",nombre:"Arriendo",cc:"CC3" },
  { cuenta:"1.3.2",nombre:"Agua",cc:"CC3" },
  { cuenta:"1.3.3",nombre:"Luz",cc:"CC3" },
  { cuenta:"1.3.4",nombre:"Gas",cc:"CC3" },
  { cuenta:"1.3.5",nombre:"Telecomunicaciones",cc:"CC3" },
  { cuenta:"1.3.6",nombre:"Mantenciones",cc:"CC3" },
  { cuenta:"1.3.7",nombre:"Fumigaciones",cc:"CC3" },
  { cuenta:"1.3.8",nombre:"Limpieza y Aseo",cc:"CC3" },
  { cuenta:"1.3.9",nombre:"Seguridad",cc:"CC3" },
  { cuenta:"1.3.10",nombre:"Equipamiento Local",cc:"CC3" },
  { cuenta:"1.4.1",nombre:"Inversión Carro",cc:"CC4" },
  { cuenta:"1.4.2",nombre:"Mantención Carro",cc:"CC4" },
  { cuenta:"1.4.5",nombre:"Sueldos Carro",cc:"CC4" },
  { cuenta:"1.5.1",nombre:"Plataformas Digitales",cc:"CC5" },
  { cuenta:"1.6.1",nombre:"RRSS",cc:"CC6" },
  { cuenta:"1.6.2",nombre:"Producción Audiovisual",cc:"CC6" },
  { cuenta:"1.6.3",nombre:"Ferias y Eventos",cc:"CC6" },
  { cuenta:"1.7.1",nombre:"Despachos B2B",cc:"CC7" },
  { cuenta:"1.7.2",nombre:"Despachos B2C",cc:"CC7" },
  { cuenta:"1.7.3",nombre:"Transporte Personas",cc:"CC7" },
  { cuenta:"1.8.1",nombre:"Comisión POS",cc:"CC8" },
  { cuenta:"1.8.2",nombre:"Comisión Delivery",cc:"CC8" },
  { cuenta:"1.9.1",nombre:"IVA F29",cc:"CC9" },
  { cuenta:"1.9.4",nombre:"Patente Comercial",cc:"CC9" },
  { cuenta:"1.9.5",nombre:"Gastos Bancarios",cc:"CC9" },
];

interface Props { onGuardado: () => void; }

const hoy = () => new Date().toISOString().slice(0, 10);
const mesDe = (f: string) => f.slice(0, 7);

export default function EgresoManual({ onGuardado }: Props) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [ok, setOk]           = useState(false);
  const [error, setError]     = useState("");

  const [form, setForm] = useState({
    fecha_pago:  hoy(),
    mes_devengo: mesDe(hoy()),
    descripcion: "",
    proveedor:   "",
    monto_total: "",
    tipo_doc:    "F",
    forma_pago:  "Debito",
    cuenta:      "",
  });

  const set = (k: string, v: string) => {
    setForm(f => ({
      ...f, [k]: v,
      ...(k === "fecha_pago" ? { mes_devengo: mesDe(v) } : {}),
    }));
  };

  const cc = PLAN_OPTIONS.find(o => o.cuenta === form.cuenta)?.cc ?? "";
  const nombreCta = PLAN_OPTIONS.find(o => o.cuenta === form.cuenta)?.nombre ?? "";

  const guardar = async () => {
    if (!form.fecha_pago || !form.descripcion || !form.monto_total) {
      setError("Fecha, descripción y monto son obligatorios"); return;
    }
    setLoading(true); setError("");
    try {
      await api.post("/egresos/manual", {
        ...form,
        monto_total: parseInt(form.monto_total.replace(/\D/g, "")),
      });
      setOk(true); onGuardado();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOk(false); setError("");
    setForm({ fecha_pago:hoy(), mes_devengo:mesDe(hoy()),
              descripcion:"", proveedor:"", monto_total:"",
              tipo_doc:"F", forma_pago:"Debito", cuenta:"" });
  };

  const descargarPlantilla = () => {
    const token = localStorage.getItem("fpm_token");
    const url = `${BASE}/api/egresos/plantilla`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(b => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = "plantilla_egresos.xlsx";
        a.click();
      });
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={descargarPlantilla}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
          <Download size={14} /> Plantilla Excel
        </button>
        <button onClick={() => { setOpen(true); reset(); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
          <PlusCircle size={14} /> Egreso manual
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Registrar egreso manual</h2>
              <button onClick={() => setOpen(false)}><X size={20} className="text-gray-400"/></button>
            </div>

            {ok ? (
              <div className="px-6 py-10 text-center space-y-4">
                <p className="text-emerald-600 font-semibold text-lg">✓ Egreso registrado</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={reset} className="px-4 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50">
                    Agregar otro
                  </button>
                  <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg">
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Fecha del egreso *</label>
                    <input type="date" value={form.fecha_pago}
                      onChange={e => set("fecha_pago", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Mes que corresponde *</label>
                    <input type="month" value={form.mes_devengo}
                      onChange={e => set("mes_devengo", e.target.value)} className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Descripción *</label>
                  <input type="text" value={form.descripcion} placeholder="Ej: Arriendo local mayo 2025"
                    onChange={e => set("descripcion", e.target.value)} className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Proveedor</label>
                  <input type="text" value={form.proveedor} placeholder="Nombre del proveedor"
                    onChange={e => set("proveedor", e.target.value)} className={inputCls} />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className={labelCls}>Monto total *</label>
                    <input type="text" value={form.monto_total} placeholder="500000"
                      onChange={e => set("monto_total", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Tipo doc</label>
                    <select value={form.tipo_doc} onChange={e => set("tipo_doc", e.target.value)} className={inputCls}>
                      <option value="F">F — Factura</option>
                      <option value="S">S — Bol. Honorarios</option>
                      <option value="B">B — Boleta</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Forma pago</label>
                    <select value={form.forma_pago} onChange={e => set("forma_pago", e.target.value)} className={inputCls}>
                      <option value="Debito">Débito (CC)</option>
                      <option value="Credito">Crédito (TC)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Cuenta contable</label>
                  <select value={form.cuenta} onChange={e => set("cuenta", e.target.value)} className={inputCls}>
                    <option value="">— Sin clasificar —</option>
                    {PLAN_OPTIONS.map(o => (
                      <option key={o.cuenta} value={o.cuenta}>
                        {o.cuenta} — {o.nombre} ({o.cc})
                      </option>
                    ))}
                  </select>
                  {cc && (
                    <p className="text-xs text-gray-400 mt-1">{cc} · {nombreCta}</p>
                  )}
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button onClick={guardar} disabled={loading}
                    className="px-5 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
                    {loading ? "Guardando…" : "Guardar egreso"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
