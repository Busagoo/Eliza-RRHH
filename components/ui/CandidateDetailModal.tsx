"use client";

import React, { useState, useEffect } from "react";
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
  MessageSquare,
  Send,
  Trash2,
  Tag,
  Folder,
  Loader2,
} from "lucide-react";
import { CandidateSearchResponseItem } from "@/app/api/candidates/search/route";

interface CandidateNoteItem {
  id: string;
  authorEmail: string;
  content: string;
  createdAt: string;
}

interface CandidateDetailModalProps {
  candidate: CandidateSearchResponseItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenResume?: (candidate: CandidateSearchResponseItem) => void;
  initialTab?: "overview" | "notes";
  onUpdateCandidate?: (updated: CandidateSearchResponseItem) => void;
}

export function CandidateDetailModal({
  candidate,
  isOpen,
  onClose,
  onOpenResume,
  initialTab = "overview",
  onUpdateCandidate,
}: CandidateDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "notes">(initialTab);
  const [notes, setNotes] = useState<CandidateNoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, candidate?.id]);

  useEffect(() => {
    if (isOpen && candidate?.id) {
      fetchNotes(candidate.id);
    }
  }, [isOpen, candidate?.id]);

  const fetchNotes = async (candidateId: string) => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (err) {
      console.warn("Could not load notes:", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !newNoteContent.trim()) return;

    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedNotes = [data.note, ...notes];
        setNotes(updatedNotes);
        setNewNoteContent("");

        if (onUpdateCandidate) {
          onUpdateCandidate({
            ...candidate,
            notesCount: updatedNotes.length,
          });
        }
      }
    } catch (err) {
      console.error("Error creating note:", err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!candidate) return;
    try {
      const res = await fetch(
        `/api/candidates/${candidate.id}/notes?noteId=${noteId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        const updatedNotes = notes.filter((n) => n.id !== noteId);
        setNotes(updatedNotes);

        if (onUpdateCandidate) {
          onUpdateCandidate({
            ...candidate,
            notesCount: updatedNotes.length,
          });
        }
      }
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  if (!isOpen || !candidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50 dark:bg-slate-950/60">
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <h2 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                {candidate.fullName}
              </h2>
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

            {/* Badges for Folders & Tags */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {candidate.folders && candidate.folders.map((f) => (
                <span
                  key={f.id}
                  className="text-[10px] px-2 py-0.5 rounded font-medium inline-flex items-center space-x-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  <Folder className="w-2.5 h-2.5" />
                  <span>{f.name}</span>
                </span>
              ))}

              {candidate.tags && candidate.tags.map((t) => (
                <span
                  key={t.id}
                  style={{
                    backgroundColor: `${t.tagColor}15`,
                    borderColor: `${t.tagColor}40`,
                    color: t.tagColor,
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border font-semibold inline-flex items-center space-x-1"
                >
                  <Tag className="w-2.5 h-2.5" />
                  <span>{t.tagName}</span>
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 pt-2 text-xs">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === "overview"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Perfil y Experiencia</span>
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === "notes"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Comentarios y Notas ({notes.length})</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-slate-700 dark:text-slate-300">
          {activeTab === "overview" && (
            <>
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
                          <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                            {edu.institution}
                          </span>
                        </div>
                        {edu.year && (
                          <span className="text-[11px] text-slate-400 font-mono">{edu.year}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "notes" && (
            <div className="space-y-4">
              {/* Form to add note */}
              <form
                onSubmit={handleAddNote}
                className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5"
              >
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Agregar Nota o Evaluación del Candidato
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Entrevistado el 15/11, excelente desenvolvimiento en comunicación. Le falta práctica en SAP..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-indigo-500 resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingNote || !newNoteContent.trim()}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>{submittingNote ? "Guardando..." : "Guardar Nota"}</span>
                  </button>
                </div>
              </form>

              {/* Notes List */}
              <div className="space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                  Historial de Notas ({notes.length})
                </h4>

                {loadingNotes ? (
                  <div className="py-8 text-center text-slate-400 flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cargando comentarios...</span>
                  </div>
                ) : notes.length === 0 ? (
                  <p className="text-slate-400 text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    No hay comentarios ni notas registradas aún para este candidato.
                  </p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          {note.authorEmail}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span>{new Date(note.createdAt).toLocaleString("es-AR")}</span>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-slate-400 hover:text-rose-500 transition"
                            title="Eliminar nota"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="text-[11px] text-slate-400">
            {candidate.notesCount || notes.length} notas guardadas
          </div>
          <div className="flex items-center space-x-2">
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
    </div>
  );
}
