import { useEffect, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { egresosApi, FiltrosEgresos, ListaEgresos, ResumenCC, FiltrosOpciones } from "./api";
import EgresosTable from "./components/EgresosTable";
import ResumenCards from "./components/ResumenCards";

const DEBOUNCE_MS = 400;
const POR_PAGINA = 50;

export default function App() {
  const [lista, setLista] = useState<ListaEgresos | null>(null);
  const [resumen, setResumen] = useState<ResumenCC[]>([]);
  const [opciones, setOpciones] = useState<FiltrosOpciones | null>(null);
  const [loading, setLoading] = useState(false);

  const [filtros, setFiltros] = useState<FiltrosEgresos>({ pagina: 1, por_pagina: POR_PAGINA });
  const [searchInput, setSearchInput] = useState("");

  // Cargar opciones de filtro una sola vez
  useEffect(() => {
    egresosApi.opciones().then(setOpciones);
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => ({ ...f, search: searchInput || undefined, pagina: 1 }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Cargar datos cuando cambian filtros
  useEffect(() => {
    setLoading(true);
    Promise.all([
      egresosApi.listar(filtros),
      egresosApi.resumenCC({ mes: filtros.mes, fecha_desde: filtros.fecha_desde, fecha_hasta: filtros.fecha_hasta }),
    ])
      .then(([l, r]) => {
        setLista(l);
        setResumen(r);
      })
      .finally(() => setLoading(false));
  }, [filtros]);

  const set = useCallback((key: keyof FiltrosEgresos, value: string | undefined) => {
    setFiltros((f) => ({ ...f, [key]: value || undefined, pagina: 1 }));
  }, []);

  const limpiarFiltros = () => {
    setFiltros({ pagina: 1, por_pagina: POR_PAGINA });
    setSearchInput("");
  };

  const hayFiltros = !!(filtros.mes || filtros.cc || filtros.forma_pago || filtros.search || filtros.fecha_desde || filtros.fecha_hasta);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">FPM Finanzas</h1>
            <p className="text-xs text-gray-400">Egresos 2025 – 2026</p>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
        {/* Resumen por CC */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <ResumenCards
            data={resumen}
            ccActivo={filtros.cc}
            onClickCC={(cc) => set("cc", cc)}
          />
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar descripción o proveedor…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Mes */}
            <select
              value={filtros.mes ?? ""}
              onChange={(e) => set("mes", e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los meses</option>
              {opciones?.meses.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* CC */}
            <select
              value={filtros.cc ?? ""}
              onChange={(e) => set("cc", e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los CC</option>
              {opciones?.ccs.map((cc) => (
                <option key={cc.value} value={cc.value}>{cc.label}</option>
              ))}
            </select>

            {/* Forma de Pago */}
            <select
              value={filtros.forma_pago ?? ""}
              onChange={(e) => set("forma_pago", e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Débito + Crédito</option>
              {opciones?.forma_pago.map((fp) => (
                <option key={fp} value={fp}>{fp}</option>
              ))}
            </select>

            {/* Fecha desde/hasta */}
            <input
              type="month"
              value={filtros.fecha_desde ? filtros.fecha_desde.slice(0, 7) : ""}
              onChange={(e) => set("fecha_desde", e.target.value ? e.target.value + "-01" : undefined)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Desde"
            />
            <input
              type="month"
              value={filtros.fecha_hasta ? filtros.fecha_hasta.slice(0, 7) : ""}
              onChange={(e) => {
                if (!e.target.value) { set("fecha_hasta", undefined); return; }
                const [y, m] = e.target.value.split("-").map(Number);
                const lastDay = new Date(y, m, 0).getDate();
                set("fecha_hasta", `${e.target.value}-${lastDay}`);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Hasta"
            />

            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <X size={14} /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <EgresosTable
          items={lista?.items ?? []}
          total={lista?.total ?? 0}
          pagina={filtros.pagina ?? 1}
          porPagina={POR_PAGINA}
          onPagina={(p) => setFiltros((f) => ({ ...f, pagina: p }))}
          loading={loading}
        />
      </main>
    </div>
  );
}
