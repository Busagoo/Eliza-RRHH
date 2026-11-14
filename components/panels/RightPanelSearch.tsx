"use client";

import React, { useState } from "react";
import {
  Sparkles,
  SlidersHorizontal,
  Zap,
} from "lucide-react";

export interface SearchFilters {
  seniority?: string;
  minExperience?: number;
  includeHistorical: boolean;
}

interface RightPanelSearchProps {
  onExecuteSearch: (query: string, filters: SearchFilters) => Promise<void>;
  loading?: boolean;
}

export function RightPanelSearch({
  onExecuteSearch,
  loading = false,
}: RightPanelSearchProps) {
  const [query, setQuery] = useState(
    "Desarrollador con experiencia técnica sólida, proactivo y buen nivel de comunicación"
  );
  const [seniority, setSeniority] = useState<string>("ALL");
  const [minExperience, setMinExperience] = useState<number>(2);
  const [includeHistorical, setIncludeHistorical] = useState<boolean>(true);

  const presets = [
    {
      label: "Fullstack React + Node",
      query: "Desarrollador Fullstack con React, Node.js, TypeScript y base de datos relacional",
      seniority: "Semi-Senior",
      exp: 3,
    },
    {
      label: "Frontend Web",
      query: "Desarrollador Frontend con React, Tailwind, diseño responsive y JavaScript",
      seniority: "Junior",
      exp: 1,
    },
    {
      label: "Backend & APIs",
      query: "Especialista Backend en Python, Node.js, microservicios y arquitectura de base de datos",
      seniority: "Senior",
      exp: 4,
    },
    {
      label: "Liderazgo / Tech Lead",
      query: "Líder Técnico con experiencia en diseño de sistemas escalables y gestión de equipo",
      seniority: "Lead",
      exp: 6,
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    onExecuteSearch(query.trim(), {
      seniority: seniority === "ALL" ? undefined : seniority,
      minExperience: minExperience > 0 ? minExperience : undefined,
      includeHistorical,
    });
  };

  const applyPreset = (preset: (typeof presets)[0]) => {
    setQuery(preset.query);
    setSeniority(preset.seniority);
    setMinExperience(preset.exp);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/60 border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/40">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Requerimientos RRHH
          </span>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
          IA Reranker
        </span>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Recruiter prompt textarea */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Criterios de Búsqueda del Puesto
          </label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Describe lo que buscas. La IA vectorizará el perfil y ordenará a los candidatos por coincidencia real.
          </p>
          <div className="relative">
            <textarea
              rows={4}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Desarrollador con inglés avanzado, experiencia en React y backend..."
              className="w-full text-xs p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400 text-slate-900 dark:text-slate-100 leading-relaxed resize-none shadow-sm"
            />
          </div>
        </div>

        {/* Preset chips */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center space-x-1">
            <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" />
            <span>Plantillas Rápidas:</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 transition text-left shadow-sm"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Section */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/30 p-3 space-y-3 shadow-sm">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Filtros Estructurados</span>
          </div>

          {/* Seniority Selector */}
          <div>
            <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Seniority Mínimo</label>
            <select
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="ALL">Cualquiera / Sin restricción</option>
              <option value="Junior">Junior</option>
              <option value="Semi-Senior">Semi-Senior</option>
              <option value="Senior">Senior</option>
              <option value="Lead">Lead / Staff</option>
            </select>
          </div>

          {/* Min Years of Experience */}
          <div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              <span>Experiencia Mínima</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{minExperience} años</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={minExperience}
              onChange={(e) => setMinExperience(Number(e.target.value))}
              className="w-full accent-indigo-600 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Historical Checkbox Toggle */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <label className="flex items-start space-x-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeHistorical}
                onChange={(e) => setIncludeHistorical(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 accent-indigo-600"
              />
              <div>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block">
                  Incluir todos los históricos
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                  Explora currículums recibidos con anterioridad en tu bandeja.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analizando y Filtrando...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
              <span>Analizar y Filtrar Candidatos</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
