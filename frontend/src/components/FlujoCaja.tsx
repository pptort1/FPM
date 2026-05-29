import { useEffect, useState } from "react";
import { flujoApi, FlujoCaja } from "../api";

const fmt = (n: number) => n === 0 ? "—" : "$" + Math.round(n).toLocaleString("es-CL");
const fmtPct = (n: number) => n === 0 ? "—" : `${n.toFixed(1)}%`;

const CC_COLOR: Record<string, string> = {
  CC1: "bg-green-50", CC2: "bg-blue-50", CC3: "bg-purple-50",
  CC4: "bg-orange-50", CC5: "bg-cyan-50", CC6: "bg-pink-50",
  CC7: "bg-yellow-50", CC8: "bg-red-50", CC9: "bg-gray-50",
};

function Cell({ v, bold, red, green }: { v: number; bold?: boolean; red?: boolean; green?: boolean }) {
  const color = v === 0 ? "text-gray-300" : red ? "text-red-600" : green ? "text-emerald-600" : "text-gray-800";
  return (
    <td className={`px-2 py-1.5 text-right text-xs whitespace-nowrap ${color} ${bold ? "font-semibold" : ""}`}>
      {fmt(v)}
    </td>
  );
}

export default function FlujoCajaView() {
  const [data, setData] = useState<FlujoCaja | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    flujoApi.get().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Cargando flujo de caja…</div>;
  if (!data) return <div className="text-center py-20 text-red-400">Error cargando datos</div>;

  const { meses, ingresos, costos, margen, margen_pct } = data;

  const toggle = (cc: string) => setExpandidos(prev => {
    const s = new Set(prev);
    s.has(cc) ? s.delete(cc) : s.add(cc);
    return s;
  });

  const MESES_LABEL: Record<string, string> = {
    "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun",
    "07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic",
  };
  const mesLabel = (m: string) => `${MESES_LABEL[m.slice(5)] ?? m.slice(5)} ${m.slice(2,4)}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="font-semibold text-gray-800">Flujo de Caja — Monto Neto sin IVA | Base Mes Devengo</h2>
        <p className="text-xs text-gray-400 mt-0.5">Click en un CC para expandir subcuentas</p>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm min-w-max">
          <thead>
            <tr className="bg-gray-800 text-white text-xs">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-gray-800 z-10 min-w-52">CC / Cuenta</th>
              {meses.map(m => (
                <th key={m} className="px-2 py-2 text-right font-medium whitespace-nowrap">{mesLabel(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ── INGRESOS ────────────────────────────────── */}
            <tr className="bg-emerald-700 text-white">
              <td className="px-3 py-2 font-bold text-xs uppercase sticky left-0 bg-emerald-700" colSpan={meses.length + 1}>
                INGRESOS
              </td>
            </tr>
            {ingresos.filas.map(fila => (
              <tr key={fila.codigo} className="border-b border-gray-100 hover:bg-emerald-50/50">
                <td className="px-3 py-1.5 text-xs text-gray-600 sticky left-0 bg-white border-r border-gray-100">
                  <span className="text-gray-400 mr-2">{fila.codigo}</span>{fila.nombre}
                </td>
                {meses.map(m => <Cell key={m} v={fila.valores[m] ?? 0} green />)}
              </tr>
            ))}
            <tr className="bg-emerald-50 border-b-2 border-emerald-200">
              <td className="px-3 py-2 font-bold text-xs text-emerald-800 sticky left-0 bg-emerald-50">TOTAL INGRESOS</td>
              {meses.map(m => <Cell key={m} v={ingresos.total[m] ?? 0} bold green />)}
            </tr>

            {/* ── EGRESOS por CC ──────────────────────────── */}
            <tr className="bg-red-700 text-white">
              <td className="px-3 py-2 font-bold text-xs uppercase sticky left-0 bg-red-700" colSpan={meses.length + 1}>
                COSTOS Y GASTOS
              </td>
            </tr>
            {costos.secciones.map(sec => (
              <>
                <tr
                  key={sec.cc}
                  className={`border-b border-gray-200 cursor-pointer hover:brightness-95 ${CC_COLOR[sec.cc] ?? "bg-gray-50"}`}
                  onClick={() => toggle(sec.cc)}
                >
                  <td className={`px-3 py-2 font-semibold text-xs sticky left-0 ${CC_COLOR[sec.cc] ?? "bg-gray-50"} border-r border-gray-200`}>
                    <span className="mr-1 text-gray-400">{expandidos.has(sec.cc) ? "▼" : "▶"}</span>
                    <span className="font-bold mr-1">{sec.cc}</span>{sec.nombre}
                  </td>
                  {meses.map(m => <Cell key={m} v={sec.total[m] ?? 0} bold red />)}
                </tr>
                {expandidos.has(sec.cc) && sec.filas.map(fila => (
                  <tr key={fila.codigo} className="border-b border-gray-100 hover:bg-red-50/30">
                    <td className="px-3 py-1 text-xs text-gray-500 pl-8 sticky left-0 bg-white border-r border-gray-100">
                      <span className="text-gray-300 mr-2">{fila.codigo}</span>{fila.nombre}
                    </td>
                    {meses.map(m => <Cell key={m} v={fila.valores[m] ?? 0} red />)}
                  </tr>
                ))}
              </>
            ))}
            <tr className="bg-red-50 border-b-2 border-red-200">
              <td className="px-3 py-2 font-bold text-xs text-red-800 sticky left-0 bg-red-50">TOTAL COSTOS</td>
              {meses.map(m => <Cell key={m} v={costos.total[m] ?? 0} bold red />)}
            </tr>

            {/* ── MARGEN ──────────────────────────────────── */}
            <tr className="bg-gray-800 text-white border-t-2 border-gray-600">
              <td className="px-3 py-2.5 font-bold text-xs sticky left-0 bg-gray-800">MARGEN $</td>
              {meses.map(m => {
                const v = margen[m] ?? 0;
                return (
                  <td key={m} className={`px-2 py-2.5 text-right text-xs font-bold whitespace-nowrap ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmt(v)}
                  </td>
                );
              })}
            </tr>
            <tr className="bg-gray-700 text-white">
              <td className="px-3 py-2 font-bold text-xs sticky left-0 bg-gray-700">MARGEN %</td>
              {meses.map(m => {
                const v = margen_pct[m] ?? 0;
                return (
                  <td key={m} className={`px-2 py-2 text-right text-xs font-semibold whitespace-nowrap ${v >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmtPct(v)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
