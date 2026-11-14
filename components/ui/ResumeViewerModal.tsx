"use client";

import React from "react";
import { X, Download, FileText, Mail, Phone, MapPin, Sparkles } from "lucide-react";
import { CandidateSearchResponseItem } from "@/app/api/candidates/search/route";

interface ResumeViewerModalProps {
  candidate: CandidateSearchResponseItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ResumeViewerModal({ candidate, isOpen, onClose }: ResumeViewerModalProps) {
  if (!isOpen || !candidate) return null;

  const pdfUrl = candidate.resumeFileUrl || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{candidate.fullName}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 font-semibold">
                  {candidate.matchScore}% Match
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Currículum Vitae — Recibido el {new Date(candidate.receivedAt).toLocaleDateString("es-AR")}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition flex items-center space-x-1.5 border border-slate-200 dark:border-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Descargar</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Main Document Viewer */}
          <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 overflow-hidden flex flex-col">
            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0`}
                className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                title={`CV - ${candidate.fullName}`}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                <FileText className="w-12 h-12 text-slate-400 dark:text-slate-600" />
                <p className="text-slate-700 dark:text-slate-300 font-medium">Contenido del Currículum</p>
                <div className="w-full max-w-xl text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-800 dark:text-slate-300 max-h-96 overflow-y-auto whitespace-pre-wrap shadow-sm">
                  {candidate.summary || "Texto del CV extraído disponible en el perfil."}
                </div>
              </div>
            )}
          </div>

          {/* Quick Info Sidebar */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 overflow-y-auto space-y-4 text-xs">
            {/* AI Summary */}
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 p-3 space-y-1.5">
              <span className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center space-x-1 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Evaluación de IA</span>
              </span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                {candidate.justification}
              </p>
            </div>

            {/* Contact info */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Contacto
              </span>
              {candidate.contactEmail && (
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{candidate.contactEmail}</span>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{candidate.phone}</span>
                </div>
              )}
              {candidate.location && (
                <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{candidate.location}</span>
                </div>
              )}
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Habilidades
              </span>
              <div className="flex flex-wrap gap-1">
                {candidate.skills.map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700 font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
