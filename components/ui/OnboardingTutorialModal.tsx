"use client";

import React, { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Inbox,
  Search,
  Award,
  FolderPlus,
  Play,
  Pause,
  FileText,
  Tag,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface OnboardingTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StepData {
  stepNumber: number;
  badge: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  highlights: {
    icon: React.ReactNode;
    title: string;
    description: string;
  }[];
  tip?: string;
}

export function OnboardingTutorialModal({ isOpen, onClose }: OnboardingTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps: StepData[] = [
    {
      stepNumber: 1,
      badge: "Paso 1 de 4",
      title: "Bandeja de Entrada y Control de IA",
      subtitle: "Panel Izquierdo: Gestión de correos y ahorro de tokens",
      icon: <Inbox className="w-6 h-6 text-indigo-500" />,
      highlights: [
        {
          icon: <Inbox className="w-4 h-4 text-indigo-500" />,
          title: "Ingesta Rápida en Segundos",
          description:
            "ELIZA se sincroniza con tu Gmail y acumula los correos entrantes a máxima velocidad, sin gastar tokens.",
        },
        {
          icon: <Pause className="w-4 h-4 text-amber-500" />,
          title: "Control de Pausa / Auto-IA",
          description:
            "Usa el botón [Pausar IA] para acumular correos sin consumo, o [Auto-IA] para que la IA procese todo continuamente en segundo plano.",
        },
        {
          icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
          title: "Análisis por Lote o Individual",
          description:
            "Puedes analizar un lote de 3 correos con [Analizar lote], o tocar [⚡ Analizar] en un correo específico que te interese.",
        },
        {
          icon: <FileText className="w-4 h-4 text-slate-500" />,
          title: "Pestaña 'Por analizar' y Papelera",
          description:
            "Filtra fácilmente entre CVs procesados, correos por analizar y la Papelera (donde puedes recuperar correos descartados).",
        },
      ],
      tip: "Consejo: Deja la IA en pausa mientras descargas tu bandeja, y analiza solo cuando tengas acumulados los correos que buscas.",
    },
    {
      stepNumber: 2,
      badge: "Paso 2 de 4",
      title: "Búsqueda y Requerimientos con IA",
      subtitle: "Panel Derecho: Describe el candidato ideal en lenguaje natural",
      icon: <Search className="w-6 h-6 text-purple-500" />,
      highlights: [
        {
          icon: <Search className="w-4 h-4 text-purple-500" />,
          title: "Descripción del Puesto",
          description:
            "Escribe lo que necesitas como si hablaras con un colega (ej. 'Especialista en Tesorería y Finanzas con manejo de SAP').",
        },
        {
          icon: <Sparkles className="w-4 h-4 text-indigo-500" />,
          title: "Plantillas Rápidas",
          description:
            "Haz clic en botones como 'Frontend Web', 'Backend & APIs' o 'Fullstack' para cargar requerimientos estándar en un clic.",
        },
        {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          title: "Filtros de Experiencia y Seniority",
          description:
            "Ajusta los años de experiencia mínima y el nivel deseado (Junior, Semi-Senior, Senior, Lead).",
        },
      ],
      tip: "Toca 'Analizar y Filtrar Candidatos' solo cuando hayas definido tu búsqueda para optimizar tokens y ver los resultados ordenados.",
    },
    {
      stepNumber: 3,
      badge: "Paso 3 de 4",
      title: "Ranking Inteligente y Calificación ATS",
      subtitle: "Panel Central: Coincidencias realistas y visualización de CV",
      icon: <Award className="w-6 h-6 text-emerald-500" />,
      highlights: [
        {
          icon: <Award className="w-4 h-4 text-emerald-500" />,
          title: "% Match Calibrado y Realista",
          description:
            "La IA evalúa con rigor: no otorga porcentajes altos a candidatos que no posean las aptitudes técnicas requeridas.",
        },
        {
          icon: <Sparkles className="w-4 h-4 text-indigo-500" />,
          title: "Evaluación Técnica Justificada",
          description:
            "Cada candidato incluye una síntesis que detalla fortalezas, años reales de experiencia y qué requisitos faltan para el puesto.",
        },
        {
          icon: <FileText className="w-4 h-4 text-sky-500" />,
          title: "Visor de CV en Alta Definición",
          description:
            "Haz clic en [Ver CV (PDF)] para inspeccionar o descargar el documento original (PDF, DOCX o imagen) transmitido al instante desde Gmail.",
        },
      ],
      tip: "El almacenamiento de CVs en la base de datos es de 0 bytes, por lo que nunca saturarás el límite del servidor.",
    },
    {
      stepNumber: 4,
      badge: "Paso 4 de 4",
      title: "Carpetas, Etiquetas y Notas Internas",
      subtitle: "Organización avanzada para equipos de reclutamiento",
      icon: <FolderPlus className="w-6 h-6 text-indigo-500" />,
      highlights: [
        {
          icon: <FolderPlus className="w-4 h-4 text-indigo-500" />,
          title: "Carpetas de Búsquedas Laborales",
          description:
            "Crea carpetas como 'Especialista Frontend' o 'Finanzas 2026' para agrupar postulantes y evitar que se mezclen.",
        },
        {
          icon: <Tag className="w-4 h-4 text-amber-500" />,
          title: "Etiquetas Personalizadas",
          description:
            "Marca a cada persona con etiquetas como 'Entrevistado', 'Buen perfil', 'Por llamar' o 'Completo'. Cada cuenta tiene sus propias etiquetas.",
        },
        {
          icon: <MessageSquare className="w-4 h-4 text-rose-500" />,
          title: "Notas y Comentarios Privados",
          description:
            "Agrega observaciones directas sobre cómo fue la entrevista, expectativas salariales o comentarios del equipo de selección.",
        },
        {
          icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
          title: "Seguridad y Multiusuario",
          description:
            "Cada cuenta vinculada a Gmail trabaja de manera 100% aislada: nadie puede ver los correos ni carpetas de otros usuarios.",
        },
      ],
      tip: "Puedes volver a abrir este tutorial en cualquier momento desde el botón 'Tutorial' en la barra superior.",
    },
  ];

  const current = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("ats_tutorial_completed", "true");
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem("ats_tutorial_completed", "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col transition-colors">
        {/* Progress Bar Header */}
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Modal Top Bar */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
              {current.badge}
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Guía interactiva de ELIZA ATS
            </span>
          </div>

          <button
            onClick={handleSkip}
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition flex items-center space-x-1"
            title="Omitir el tutorial y comenzar a usar la aplicación"
          >
            <span>Omitir tutorial</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[70vh] space-y-5">
          {/* Step Header */}
          <div className="flex items-start space-x-3.5">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex-shrink-0">
              {current.icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {current.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {current.subtitle}
              </p>
            </div>
          </div>

          {/* Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {current.highlights.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1 hover:border-indigo-300 dark:hover:border-indigo-800/60 transition"
              >
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded bg-white dark:bg-slate-900 shadow-2xs">
                    {item.icon}
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {item.title}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Practical Tip */}
          {current.tip && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start space-x-2 text-xs">
              <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                {current.tip}
              </p>
            </div>
          )}
        </div>

        {/* Step Navigation Dots & Actions Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between">
          {/* Step Dots */}
          <div className="flex items-center space-x-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentStep
                    ? "w-6 bg-indigo-600 dark:bg-indigo-500"
                    : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                }`}
                title={`Ir al paso ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition flex items-center space-x-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm flex items-center space-x-1"
            >
              <span>{currentStep === steps.length - 1 ? "Comenzar a usar ELIZA" : "Siguiente"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
