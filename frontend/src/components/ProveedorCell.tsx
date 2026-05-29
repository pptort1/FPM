import { useState, useEffect, useRef } from "react";
import { Pencil, Check, X } from "lucide-react";
import api from "../apiInstance";

interface Props {
  proveedor: string | null;
  rut: string | null;
}

export default function ProveedorCell({ proveedor, rut }: Props) {
  const [nombre, setNombre]     = useState<string | null>(proveedor);
  const [editando, setEditando] = useState(false);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Si solo hay RUT (sin nombre legible), buscar en maestro
  const soloRut = !proveedor || /^\d{1,2}[\d.]+-[\dkK]$/.test(proveedor.trim()) || proveedor === rut;

  useEffect(() => {
    if (soloRut && rut && !nombre) {
      api.get(`/proveedores/${encodeURIComponent(rut)}`)
        .then(r => { if (r.data.nombre) setNombre(r.data.nombre); })
        .catch(() => {});
    }
  }, [rut]);

  useEffect(() => {
    if (editando) {
      setInput(nombre ?? "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editando]);

  const guardar = async () => {
    if (!rut || !input.trim()) { setEditando(false); return; }
    setLoading(true);
    try {
      await api.put(`/proveedores/${encodeURIComponent(rut)}`, { nombre: input.trim() });
      setNombre(input.trim());
      setEditando(false);
    } finally {
      setLoading(false);
    }
  };

  if (editando) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") guardar(); if (e.key === "Escape") setEditando(false); }}
          className="border border-blue-300 rounded px-2 py-0.5 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Nombre proveedor…"
        />
        <button onClick={guardar} disabled={loading}
          className="text-emerald-600 hover:text-emerald-800 disabled:opacity-40">
          <Check size={13} />
        </button>
        <button onClick={() => setEditando(false)} className="text-gray-400 hover:text-gray-600">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      {nombre ? (
        <span className="text-xs text-gray-600 truncate max-w-xs" title={nombre}>{nombre}</span>
      ) : rut ? (
        <button
          onClick={e => { e.stopPropagation(); setEditando(true); }}
          className="text-xs text-orange-500 hover:text-orange-700 flex items-center gap-1 italic">
          <Pencil size={11} /> Identificar RUT {rut}
        </button>
      ) : (
        <span className="text-gray-300 text-xs">—</span>
      )}
      {nombre && rut && (
        <button
          onClick={e => { e.stopPropagation(); setEditando(true); }}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition-opacity ml-1">
          <Pencil size={11} />
        </button>
      )}
    </div>
  );
}
