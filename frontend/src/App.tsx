import { useEffect, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { egresosApi, ingresosApi, FiltrosEgresos, ListaEgresos, ResumenCC, FiltrosOpciones,
         ListaIngresos, ResumenCanal, FiltrosIngresosOpciones } from "./api";
import EgresosTable, { SortKey } from "./components/EgresosTable";
import IngresosTable, { SortKeyI } from "./components/IngresosTable";
import ResumenCards from "./components/ResumenCards";
import FlujoCajaView from "./components/FlujoCaja";
import SubirCartola from "./components/SubirCartola";
import SyncBsale from "./components/SyncBsale";
import SubirVentasBsale from "./components/SubirVentasBsale";
import EgresoManual from "./components/EgresoManual";
import ConciliarCartola from "./components/ConciliarCartola";

const DEBOUNCE_MS = 400;
const POR_PAGINA = 50;
type Tab = "egresos" | "ingresos" | "flujo";

// ── Egresos view ────────────────────────────────────────────────────────────

function EgresosView() {
  const [lista, setLista] = useState<ListaEgresos | null>(null);
  const [resumen, setResumen] = useState<ResumenCC[]>([]);
  const [opciones, setOpciones] = useState<FiltrosOpciones | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosEgresos>({ pagina: 1, por_pagina: POR_PAGINA });
  const [searchInput, setSearchInput] = useState("");
  const [sortKey, setSortKey]   = useState<SortKey>("fecha_pago");
  const [sortDir, setSortDir]   = useState<"asc"|"desc">("desc");

  useEffect(() => { egresosApi.opciones().then(setOpciones); }, []);

  useEffect(() => {
    const t = setTimeout(() => setFiltros(f => ({ ...f, search: searchInput || undefined, pagina: 1 })), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    Promise.all([egresosApi.listar({...filtros, sort_by: sortKey, sort_dir: sortDir}), egresosApi.resumenCC({ mes: filtros.mes })])
      .then(([l, r]) => { setLista(l); setResumen(r); })
      .finally(() => setLoading(false));
  }, [filtros, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
    setFiltros(f => ({ ...f, pagina: 1 }));
  };

  const set = useCallback((key: keyof FiltrosEgresos, value: string | undefined) =>
    setFiltros(f => ({ ...f, [key]: value || undefined, pagina: 1 })), []);

  const limpiar = () => { setFiltros({ pagina: 1, por_pagina: POR_PAGINA }); setSearchInput(""); };
  const hayFiltros = !!(filtros.mes || filtros.cc || filtros.forma_pago || filtros.search || (filtros as any).estado);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <ResumenCards data={resumen} ccActivo={filtros.cc} onClickCC={cc => set("cc", cc)} />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <SubirCartola onSubido={() => setFiltros(f => ({ ...f, pagina: 1 }))} />
          <EgresoManual onGuardado={() => setFiltros(f => ({ ...f, pagina: 1 }))} />
          <ConciliarCartola onConciliado={() => setFiltros(f => ({ ...f, pagina: 1 }))} />
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar descripción o proveedor…" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filtros.mes ?? ""} onChange={e => set("mes", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los meses</option>
            {opciones?.meses?.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filtros.cc ?? ""} onChange={e => set("cc", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los CC</option>
            {opciones?.ccs?.map(cc => <option key={cc.value} value={cc.value}>{cc.label}</option>)}
          </select>
          <select value={filtros.forma_pago ?? ""} onChange={e => set("forma_pago", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas las formas</option>
            {["Debito","Credito","Efectivo"].map(fp => <option key={fp} value={fp}>{fp}</option>)}
          </select>
          <select value={(filtros as any).estado ?? ""} onChange={e => set("estado" as any, e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            <option value="validado">Validado</option>
            <option value="pendiente">Pendiente</option>
            <option value="revision">En revisión</option>
          </select>
          {hayFiltros && (
            <button onClick={limpiar} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              <X size={14} /> Limpiar
            </button>
          )}
        </div>
      </div>
      <EgresosTable items={lista?.items ?? []} total={lista?.total ?? 0}
        pagina={filtros.pagina ?? 1} porPagina={POR_PAGINA}
        onPagina={p => setFiltros(f => ({ ...f, pagina: p }))} loading={loading}
        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
    </div>
  );
}

// ── Ingresos view ───────────────────────────────────────────────────────────

const CANAL_COLORS: Record<string, string> = {
  CH1: "bg-blue-50 border-blue-200 text-blue-800",
  CH2: "bg-green-50 border-green-200 text-green-800",
  CH3: "bg-orange-50 border-orange-200 text-orange-800",
  CH4: "bg-purple-50 border-purple-200 text-purple-800",
  CH5: "bg-pink-50 border-pink-200 text-pink-800",
};

function IngresosView() {
  const [lista, setLista] = useState<ListaIngresos | null>(null);
  const [resumen, setResumen] = useState<ResumenCanal[]>([]);
  const [opciones, setOpciones] = useState<FiltrosIngresosOpciones | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState<any>({ pagina: 1, por_pagina: POR_PAGINA });
  const [searchInput, setSearchInput] = useState("");
  const [sortKey, setSortKey]   = useState<SortKeyI>("fecha");
  const [sortDir, setSortDir]   = useState<"asc"|"desc">("desc");

  useEffect(() => { ingresosApi.opciones().then(setOpciones); }, []);

  useEffect(() => {
    const t = setTimeout(() => setFiltros((f: any) => ({ ...f, search: searchInput || undefined, pagina: 1 })), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    Promise.all([ingresosApi.listar({...filtros, sort_by: sortKey, sort_dir: sortDir}), ingresosApi.resumenCanal({ mes: filtros.mes })])
      .then(([l, r]) => { setLista(l); setResumen(r); })
      .finally(() => setLoading(false));
  }, [filtros, sortKey, sortDir]);

  const handleSortI = (k: SortKeyI) => {
    if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
    setFiltros((f: any) => ({ ...f, pagina: 1 }));
  };

  const set = (key: string, value: string | undefined) =>
    setFiltros((f: any) => ({ ...f, [key]: value || undefined, pagina: 1 }));

  const limpiar = () => { setFiltros({ pagina: 1, por_pagina: POR_PAGINA }); setSearchInput(""); };
  const total = resumen.reduce((s, r) => s + r.monto_neto, 0);

  return (
    <div className="space-y-4">
      {/* Resumen por canal */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total ingresos netos</h2>
          <span className="text-2xl font-bold text-gray-900">${Math.round(total).toLocaleString("es-CL")}</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ingresos por canal</span>
          <SubirVentasBsale onSubido={() => setFiltros((f: any) => ({ ...f, pagina: 1 }))} />
          <SyncBsale onSyncado={() => setFiltros((f: any) => ({ ...f, pagina: 1 }))} />
        </div>
        <div className="flex flex-wrap gap-2">
          {resumen.map(r => (
            <button key={r.canal}
              onClick={() => set("canal", filtros.canal === r.canal ? "" : r.canal)}
              className={`border rounded-lg p-2 text-left transition-all ${CANAL_COLORS[r.canal] ?? "bg-gray-50 border-gray-200"} ${filtros.canal === r.canal ? "ring-2 ring-offset-1 ring-gray-400" : "hover:opacity-80"}`}>
              <div className="text-xs font-bold">{r.canal}</div>
              <div className="text-xs">{r.nombre}</div>
              <div className="text-sm font-semibold mt-1">${Math.round(r.monto_neto).toLocaleString("es-CL")}</div>
              <div className="text-xs opacity-60">{r.n_tx} tx</div>
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar cliente o descripción…" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filtros.mes ?? ""} onChange={e => set("mes", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los meses</option>
            {opciones?.meses?.map((m: string) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filtros.canal ?? ""} onChange={e => set("canal", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los canales</option>
            {opciones?.canales?.map((c: any) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {(filtros.mes || filtros.canal || filtros.search) && (
            <button onClick={limpiar} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <X size={14} /> Limpiar
            </button>
          )}
        </div>
      </div>

      <IngresosTable items={lista?.items ?? []} total={lista?.total ?? 0}
        pagina={filtros.pagina ?? 1} porPagina={POR_PAGINA}
        onPagina={p => setFiltros((f: any) => ({ ...f, pagina: p }))} loading={loading}
        sortKey={sortKey} sortDir={sortDir} onSort={handleSortI} />
    </div>
  );
}

// ── App shell ───────────────────────────────────────────────────────────────

export default function App({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("egresos");

  const tabs: { id: Tab; label: string }[] = [
    { id: "egresos", label: "Egresos" },
    { id: "ingresos", label: "Ingresos" },
    { id: "flujo", label: "Flujo de Caja" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">FPM Finanzas</h1>
            <p className="text-xs text-gray-400">Fait Par Marie · 2025–2026</p>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}>
                  {t.label}
                </button>
              ))}
            </nav>
            <button onClick={onLogout}
              className="ml-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {tab === "egresos" && <EgresosView />}
        {tab === "ingresos" && <IngresosView />}
        {tab === "flujo" && <FlujoCajaView />}
      </main>
    </div>
  );
}
