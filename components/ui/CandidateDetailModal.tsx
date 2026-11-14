"use client";

import React from "react";
import {
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { CandidateSearchResponseItem } from "@/app/api/candidates/search/route";

interface CandidateDetailModalProps {
  candidate: CandidateSearchResponseItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenResume?: (candidate: CandidateSearchResponseItem) => void;
}

export function CandidateDetailModal({
  candidate,
  isOpen,
  onClose,
  onOpenResume,
}: CandidateDetailModalProps) {
  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50 dark:bg-slate-950/60">
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <h2 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">{candidate.fullName}</h2>
              {candidate.seniority && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 font-semibold">
                  {candidate.seniority}
                </span>
              )}
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 font-bold">
                {candidate.matchScore}% Match
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              {candidate.contactEmail && (
                <span className="inline-flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {candidate.contactEmail}
                </span>
              )}
              {candidate.phone && (
                <span className="inline-flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {candidate.phone}
                </span>
              )}
              {candidate.location && (
                <span className="inline-flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {candidate.location}
                </span>
              )}
              <span className="inline-flex items-center font-mono">
                <Calendar className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Registrado el {new Date(candidate.receivedAt).toLocaleDateString("es-AR")}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-slate-700 dark:text-slate-300">
          {/* AI Justification */}
          <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 p-4 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Análisis de Ajuste con el Puesto</span>
            </div>
            <p className="text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
              {candidate.justification}
            </p>
            {candidate.keyStrengths && candidate.keyStrengths.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-indigo-200 dark:border-indigo-900/40">
                {candidate.keyStrengths.map((str, i) => (
                  <span
                    key={i}
                    className="text-[11px] inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60"
                  >
                    <CheckCircle className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                    {str}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Professional Summary */}
          {candidate.summary && (
            <div className="space-y-1.5">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                Resumen Profesional
              </h4>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                {candidate.summary}
              </p>
            </div>
          )}

          {/* Technical Skills */}
          <div className="space-y-1.5">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
              Stack Tecnológico y Competencias
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.map((skill, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Work History */}
          {candidate.workHistory && candidate.workHistory.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                <span>Experiencia Laboral</span>
              </h4>
              <div className="space-y-2.5">
                {candidate.workHistory.map((work: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {work.role || "Cargo no especificado"}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {work.duration || ""}
                      </span>
                    </div>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">
                      {work.company || "Empresa"}
                    </span>
                    {Array.isArray(work.highlights) && work.highlights.length > 0 && (
                      <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px] pl-1 pt-1">
                        {work.highlights.map((h: string, j: number) => (
                          <li key={j}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {candidate.education && candidate.education.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                <span>Educación y Formación</span>
              </h4>
              <div className="space-y-2">
                {candidate.education.map((edu: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {edu.degree || "Título obtenido"}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">{edu.institution}</span>
                    </div>
                    {edu.year && (
                      <span className="text-[11px] text-slate-400 font-mono">{edu.year}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2 bg-slate-50 dark:bg-slate-950/60">
          {onOpenResume && (
            <button
              onClick={() => {
                onClose();
                onOpenResume(candidate);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm"
            >
              Abrir CV Adjunto (PDF)
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
