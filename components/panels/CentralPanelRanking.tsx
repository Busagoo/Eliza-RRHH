"use client";

import React from "react";
import {
  Sparkles,
  FileText,
  Calendar,
  MapPin,
  Briefcase,
  Languages,
  CheckCircle,
  Award,
  ChevronRight,
} from "lucide-react";
import { CandidateSearchResponseItem } from "@/app/api/candidates/search/route";

interface CentralPanelRankingProps {
  candidates: CandidateSearchResponseItem[];
  activeQuery?: string;
  loading?: boolean;
  onOpenResume: (candidate: CandidateSearchResponseItem) => void;
  onOpenDetails: (candidate: CandidateSearchResponseItem) => void;
}

export function CentralPanelRanking({
  candidates,
  activeQuery,
  loading = false,
  onOpenResume,
  onOpenDetails,
}: CentralPanelRankingProps) {
  const formatReceivedDate = (dateVal: Date | string) => {
    try {
      const d = new Date(dateVal);
      const isHistorical = d.getFullYear() <= 2024;
      const formatted = d.toLocaleDateString("es-AR", {
        month: "short",
        year: "numeric",
      });
      return {
        label: `Enviado en ${formatted}`,
        isHistorical,
      };
    } catch {
      return { label: "Fecha no disponible", isHistorical: false };
    }
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 85) {
      return {
        badge: "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40",
      };
    }
    if (score >= 70) {
      return {
        badge: "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/40",
      };
    }
    if (score >= 55) {
      return {
        badge: "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40",
      };
    }
    return {
      badge: "bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
    };
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/40">
        <div className="flex items-center space-x-2">
          <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Ranking ATS
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          {activeQuery && (
            <span className="max-w-[180px] sm:max-w-[260px] truncate text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
              "{activeQuery}"
            </span>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
            {candidates.length} candidatos
          </span>
        </div>
      </div>

      {/* Content Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3">
            <div className="w-10 h-10 border-2 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-medium text-slate-800 dark:text-slate-300">
              Buscando vectores y evaluando perfiles con IA...
            </p>
            <p className="text-[11px] text-slate-500">
              Re-evaluando base de currículums en Supabase
            </p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-8 bg-white dark:bg-transparent">
            <Briefcase className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
            <p className="text-slate-800 dark:text-slate-300 font-semibold">No hay candidatos procesados aún</p>
            <p className="text-slate-500 max-w-sm mx-auto text-[11px] leading-relaxed">
              Cuando recibas un correo con un currículum adjunto en tu Gmail, aparecerá automáticamente aquí evaluado por la IA.
            </p>
          </div>
        ) : (
          candidates.map((candidate, index) => {
            const { label: dateLabel, isHistorical } = formatReceivedDate(candidate.receivedAt);
            const scoreStyles = getScoreColorClass(candidate.matchScore);

            return (
              <div
                key={candidate.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/70 transition-all duration-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700/80 relative overflow-hidden group"
              >
                {/* Ranking order badge */}
                <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800/60 rounded-bl-lg text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  #{index + 1}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  {/* Candidate Identity */}
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h3
                        className="font-bold text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-300 transition cursor-pointer"
                        onClick={() => onOpenDetails(candidate)}
                      >
                        {candidate.fullName}
                      </h3>

                      {candidate.seniority && (
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-700">
                          {candidate.seniority}
                        </span>
                      )}

                      {/* Historical Date Badge */}
                      <span
                        className={`text-[10px] inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-mono ${
                          isHistorical
                            ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <Calendar className="w-2.5 h-2.5 mr-1" />
                        <span>{dateLabel}</span>
                      </span>
                    </div>

                    {/* Metadata line */}
                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      <span className="inline-flex items-center">
                        <Briefcase className="w-3 h-3 mr-1 text-slate-400" />
                        {candidate.experienceYears} años de experiencia
                      </span>
                      {candidate.location && (
                        <span className="inline-flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                          {candidate.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Match Percentage Pill */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between">
                    <div
                      className={`px-3 py-1 rounded-lg border font-bold text-xs flex items-center space-x-1.5 shadow-sm ${scoreStyles.badge}`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{candidate.matchScore}% Match</span>
                    </div>
                  </div>
                </div>

                {/* AI Justification Box */}
                <div className="rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 p-2.5 mb-3 text-xs">
                  <div className="flex items-center space-x-1.5 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] mb-1">
                    <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    <span>Evaluación de IA:</span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    {candidate.justification}
                  </p>

                  {/* Strengths tags */}
                  {candidate.keyStrengths && candidate.keyStrengths.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-900/30">
                      {candidate.keyStrengths.map((str, i) => (
                        <span
                          key={i}
                          className="text-[10px] inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/40"
                        >
                          <CheckCircle className="w-2.5 h-2.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                          {str}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skills & Languages */}
                <div className="space-y-2 mb-3">
                  {/* Skills tags */}
                  {candidate.skills && candidate.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.slice(0, 8).map((skill, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Languages */}
                  {Array.isArray(candidate.languages) && candidate.languages.length > 0 && (
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <Languages className="w-3 h-3 text-slate-400" />
                      <span>
                        {candidate.languages
                          .map((l: any) => `${l.language || l}: ${l.level || "OK"}`)
                          .join(" • ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
                  <button
                    onClick={() => onOpenDetails(candidate)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center space-x-1"
                  >
                    <span>Ver Perfil Detallado</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onOpenResume(candidate)}
                      className="text-xs px-3 py-1.5 rounded-md bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 font-medium transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Ver CV (PDF)</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
