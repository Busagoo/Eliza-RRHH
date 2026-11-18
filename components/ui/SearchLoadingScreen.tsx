"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Brain, Search, CheckCircle2, Lightbulb, ShieldCheck, Layers } from "lucide-react";

interface SearchLoadingScreenProps {
  activeQuery?: string;
}

const STAGES = [
  {
    title: "Vectorizando requerimientos del puesto",
    desc: "Generando embedding semántico denso de 1536 dimensiones con IA...",
    icon: Sparkles,
  },
  {
    title: "Búsqueda vectorial en base de datos",
    desc: "Consultando similitud de coseno con pgvector en PostgreSQL...",
    icon: Search,
  },
  {
    title: "Evaluación de perfiles y trayectoria",
    desc: "Analizando experiencia laboral, herramientas clave y competencias...",
    icon: Brain,
  },
  {
    title: "Calibración ATS y control de dominio",
    desc: "Penalizando discrepancias de rubro para garantizar un match 100% realista...",
    icon: ShieldCheck,
  },
  {
    title: "Ordenando ranking y redactando dictamen",
    desc: "Calculando porcentajes de ajuste final y fortalezas destacadas...",
    icon: Layers,
  },
];

const RECRUITING_TIPS = [
  {
    title: "Calibración Estricta ATS",
    text: "Los candidatos con experiencia en rubros no relacionados (como operarios en búsquedas financieras o IT) son penalizados para no distorsionar tu ranking.",
  },
  {
    title: "Búsqueda Semántica Vectorial",
    text: "El sistema no se limita a coincidencia exacta de palabras: comprende conceptos, sinónimos y afinidad tecnológica en todo el currículum.",
  },
  {
    title: "Organización Inmediata",
    text: "Una vez completado el análisis, puedes clasificar candidatos en Carpetas de búsqueda y asignar etiquetas personalizadas.",
  },
  {
    title: "Protección de Tokens",
    text: "Solo se evalúan candidatos cuando tú inicias una búsqueda activa, optimizando el consumo y la velocidad de respuesta.",
  },
];

export function SearchLoadingScreen({ activeQuery }: SearchLoadingScreenProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [progress, setProgress] = useState(12);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(1);

  // Timer for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Stage progression logic
  useEffect(() => {
    const stageInterval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev < STAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1800);

    return () => clearInterval(stageInterval);
  }, []);

  // Smooth progress bar simulation
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 92) {
          const increment = Math.max(2, Math.floor((95 - prev) * 0.15));
          return Math.min(94, prev + increment);
        }
        return prev;
      });
    }, 400);

    return () => clearInterval(progressInterval);
  }, []);

  // Rotating tips
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % RECRUITING_TIPS.length);
    }, 3500);

    return () => clearInterval(tipInterval);
  }, []);

  const activeStage = STAGES[currentStageIndex];
  const activeTip = RECRUITING_TIPS[currentTipIndex];

  return (
    <div className="py-12 px-4 max-w-xl mx-auto flex flex-col items-center text-center animate-fadeIn">
      {/* Animated Radar / Pulsing Glow Visual */}
      <div className="relative mb-6">
        {/* Outer glowing pulsing rings */}
        <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-blue-500/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute -inset-1 bg-indigo-500/30 rounded-full animate-ping opacity-25" />

        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white shadow-xl shadow-indigo-500/25 flex items-center justify-center border border-indigo-400/30">
          <Brain className="w-10 h-10 animate-bounce duration-1000" />
        </div>
      </div>

      {/* Main Title & Search Query Badge */}
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
        Analizando y Calibrando Candidatos
      </h3>

      {activeQuery && (
        <div className="mb-4 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-mono max-w-md truncate shadow-sm">
          <Search className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">&quot;{activeQuery}&quot;</span>
        </div>
      )}

      {/* Dynamic Animated Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mb-2 overflow-hidden p-0.5 border border-slate-200/80 dark:border-slate-700/60">
        <div
          className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="w-full flex justify-between text-[11px] text-slate-400 font-mono mb-6 px-1">
        <span>Paso {currentStageIndex + 1} de {STAGES.length}</span>
        <span>{elapsedSeconds}s transcurridos</span>
      </div>

      {/* Active Stage Card */}
      <div className="w-full bg-white dark:bg-slate-900/90 border border-indigo-100 dark:border-indigo-950/80 rounded-xl p-4 shadow-sm mb-6 text-left transition-all duration-300">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 flex-shrink-0">
            <activeStage.icon className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5 flex items-center space-x-1.5">
              <span>{activeStage.title}</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {activeStage.desc}
            </p>
          </div>
        </div>

        {/* Pipeline checklist preview */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
          {STAGES.map((s, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            return (
              <div
                key={idx}
                className={`flex items-center space-x-1.5 ${
                  isCompleted
                    ? "text-emerald-600 dark:text-emerald-400 font-medium"
                    : isCurrent
                    ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-slate-400 dark:text-slate-600"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                ) : isCurrent ? (
                  <div className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-700 flex-shrink-0" />
                )}
                <span className="truncate">{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rotating Recruiting Insights Box */}
      <div className="w-full bg-gradient-to-r from-amber-500/5 via-indigo-500/5 to-purple-500/5 border border-amber-500/20 dark:border-amber-400/10 rounded-xl p-3.5 text-left relative overflow-hidden">
        <div className="flex items-start space-x-2.5">
          <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 block mb-0.5">
              Tip ATS: {activeTip.title}
            </span>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal transition-opacity duration-300">
              {activeTip.text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
