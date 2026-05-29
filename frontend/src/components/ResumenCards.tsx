import { ResumenCC } from "../api";

const CC_COLORS: Record<string, string> = {
  CC1: "bg-green-50 border-green-200 text-green-800",
  CC2: "bg-blue-50 border-blue-200 text-blue-800",
  CC3: "bg-purple-50 border-purple-200 text-purple-800",
  CC4: "bg-orange-50 border-orange-200 text-orange-800",
  CC5: "bg-cyan-50 border-cyan-200 text-cyan-800",
  CC6: "bg-pink-50 border-pink-200 text-pink-800",
  CC7: "bg-yellow-50 border-yellow-200 text-yellow-800",
  CC8: "bg-red-50 border-red-200 text-red-800",
  CC9: "bg-gray-50 border-gray-200 text-gray-800",
};

const fmt = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-CL");

interface Props {
  data: ResumenCC[];
  onClickCC?: (cc: string) => void;
  ccActivo?: string;
}

export default function ResumenCards({ data, onClickCC, ccActivo }: Props) {
  const total = data.reduce((s, r) => s + r.monto_neto, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Total neto clasificado
        </h2>
        <span className="text-2xl font-bold text-gray-900">{fmt(total)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {data.map((r) => (
          <button
            key={r.cc}
            onClick={() => onClickCC?.(ccActivo === r.cc ? "" : r.cc)}
            className={`border rounded-lg p-2 text-left transition-all ${CC_COLORS[r.cc] ?? "bg-gray-50 border-gray-200"} ${
              ccActivo === r.cc ? "ring-2 ring-offset-1 ring-gray-400" : "hover:opacity-80"
            }`}
          >
            <div className="text-xs font-bold">{r.cc}</div>
            <div className="text-xs truncate leading-tight">{r.nombre}</div>
            <div className="text-sm font-semibold mt-1">{fmt(r.monto_neto)}</div>
            <div className="text-xs opacity-60">{r.n_tx} tx</div>
          </button>
        ))}
      </div>
    </div>
  );
}
