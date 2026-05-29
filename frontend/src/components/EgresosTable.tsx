import { useState, useMemo } from "react";
import { Transaccion } from "../api";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

const CC_BADGE: Record<string, string> = {
  CC1:"bg-green-100 text-green-700", CC2:"bg-blue-100 text-blue-700",
  CC3:"bg-purple-100 text-purple-700", CC4:"bg-orange-100 text-orange-700",
  CC5:"bg-cyan-100 text-cyan-700", CC6:"bg-pink-100 text-pink-700",
  CC7:"bg-yellow-100 text-yellow-700", CC8:"bg-red-100 text-red-700",
  CC9:"bg-gray-100 text-gray-700",
};

type SortKey = "fecha_pago" | "mes_devengo" | "monto_total" | "monto_neto" | "cc" | "forma_pago";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} className="opacity-30" />;
  return dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

interface Props {
  items: Transaccion[];
  total: number;
  pagina: number;
  porPagina: number;
  onPagina: (p: number) => void;
  loading: boolean;
}

export default function EgresosTable({ items, total, pagina, porPagina, onPagina, loading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("fecha_pago");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = typeof va === "number" ? va - (vb as number) : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const Th = ({ label, sk }: { label: string; sk: SortKey }) => (
    <th onClick={() => toggleSort(sk)}
      className="px-4 py-3 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-1 justify-end">
        {label}<SortIcon active={sortKey === sk} dir={sortDir} />
      </div>
    </th>
  );
  const ThLeft = ({ label, sk }: { label: string; sk: SortKey }) => (
    <th onClick={() => toggleSort(sk)}
      className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-1">
        {label}<SortIcon active={sortKey === sk} dir={sortDir} />
      </div>
    </th>
  );

  const totalPaginas = Math.ceil(total / porPagina);
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
              <ThLeft label="Fecha"   sk="fecha_pago" />
              <ThLeft label="Mes"     sk="mes_devengo" />
              <th className="text-left px-4 py-3 font-medium">Descripción</th>
              <th className="text-left px-4 py-3 font-medium">Proveedor</th>
              <Th label="Monto"       sk="monto_total" />
              <Th label="Neto"        sk="monto_neto" />
              <th className="text-center px-4 py-3 font-medium">Doc</th>
              <ThLeft label="Pago"    sk="forma_pago" />
              <ThLeft label="CC"      sk="cc" />
              <th className="text-left px-4 py-3 font-medium">Cuenta</th>
            </tr>
          </thead>
          <tbody className={loading ? "opacity-50" : ""}>
            {sorted.length === 0 && !loading && (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">Sin resultados</td></tr>
            )}
            {sorted.map((tx, i) => (
              <tr key={tx.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 !== 0 ? "bg-gray-50/30" : ""}`}>
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{tx.fecha_pago}</td>
                <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{tx.mes_devengo}</td>
                <td className="px-4 py-2.5 max-w-xs">
                  <div className="truncate text-gray-800" title={tx.descripcion}>{tx.descripcion}</div>
                </td>
                <td className="px-4 py-2.5 max-w-xs">
                  <div className="truncate text-gray-500 text-xs" title={tx.proveedor ?? ""}>{tx.proveedor ?? "—"}</div>
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700 whitespace-nowrap">{fmt(tx.monto_total)}</td>
                <td className="px-4 py-2.5 text-right text-gray-500 whitespace-nowrap text-xs">{fmt(tx.monto_neto)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${tx.tipo_doc === "F" ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-500"}`}>
                    {tx.tipo_doc}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${tx.forma_pago === "Credito" ? "bg-purple-50 text-purple-600" : "bg-green-50 text-green-600"}`}>
                    {tx.forma_pago}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${CC_BADGE[tx.cc] ?? "bg-gray-100 text-gray-600"}`}>{tx.cc}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{tx.nombre_cuenta ?? tx.cuenta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
        <span>{total > 0 ? `${desde}–${hasta} de ${total.toLocaleString("es-CL")} transacciones` : "0 resultados"}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onPagina(pagina - 1)} disabled={pagina <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft size={16} />
          </button>
          <span className="px-2">{pagina} / {totalPaginas || 1}</span>
          <button onClick={() => onPagina(pagina + 1)} disabled={pagina >= totalPaginas}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
