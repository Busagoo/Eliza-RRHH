"use client";

import React, { useState, useEffect } from "react";
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
  Folder,
  FolderPlus,
  Tag,
  MessageSquare,
  Plus,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { CandidateSearchResponseItem } from "@/app/api/candidates/search/route";

export interface JobFolderItem {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  candidateCount: number;
}

interface CentralPanelRankingProps {
  candidates: CandidateSearchResponseItem[];
  activeQuery?: string;
  loading?: boolean;
  onOpenResume: (candidate: CandidateSearchResponseItem) => void;
  onOpenDetails: (candidate: CandidateSearchResponseItem, initialTab?: "overview" | "notes") => void;
  onUpdateCandidate?: (updated: CandidateSearchResponseItem) => void;
}

const PRESET_TAGS = [
  { name: "Verificado", color: "#10b981" },
  { name: "Entrevistado", color: "#6366f1" },
  { name: "Buen perfil", color: "#f59e0b" },
  { name: "Por llamar", color: "#06b6d4" },
  { name: "Descartado", color: "#ef4444" },
];

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#06b6d4", // Cyan
  "#ec4899", // Pink
];

export function CentralPanelRanking({
  candidates,
  activeQuery,
  loading = false,
  onOpenResume,
  onOpenDetails,
  onUpdateCandidate,
}: CentralPanelRankingProps) {
  // Folders State
  const [folders, setFolders] = useState<JobFolderItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(PRESET_COLORS[0]);
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Active Dropdowns per candidate
  const [activeTagDropdownId, setActiveTagDropdownId] = useState<string | null>(null);
  const [activeFolderDropdownId, setActiveFolderDropdownId] = useState<string | null>(null);
  const [customTagInput, setCustomTagInput] = useState("");

  // Fetch folders on mount
  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await fetch("/api/folders");
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.warn("Could not load folders:", err);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setCreatingFolder(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          description: newFolderDesc.trim() || undefined,
          color: newFolderColor,
        }),
      });

      if (res.ok) {
        setNewFolderName("");
        setNewFolderDesc("");
        setIsFolderModalOpen(false);
        await fetchFolders();
      }
    } catch (err) {
      console.error("Error creating folder:", err);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta carpeta de búsqueda?")) return;

    try {
      const res = await fetch(`/api/folders?id=${folderId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
        }
        await fetchFolders();
      }
    } catch (err) {
      console.error("Error deleting folder:", err);
    }
  };

  const handleToggleTag = async (
    candidate: CandidateSearchResponseItem,
    tagName: string,
    tagColor: string = "#10b981"
  ) => {
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagName, tagColor }),
      });

      if (res.ok) {
        const data = await res.json();
        let updatedTags = candidate.tags ? [...candidate.tags] : [];
        if (data.action === "removed") {
          updatedTags = updatedTags.filter((t) => t.tagName !== tagName);
        } else if (data.tag) {
          updatedTags.push({
            id: data.tag.id,
            tagName: data.tag.tagName,
            tagColor: data.tag.tagColor || tagColor,
          });
        }

        const updated = { ...candidate, tags: updatedTags };
        if (onUpdateCandidate) onUpdateCandidate(updated);
      }
    } catch (err) {
      console.error("Error toggling tag:", err);
    }
  };

  const handleToggleCandidateFolder = async (
    candidate: CandidateSearchResponseItem,
    folder: JobFolderItem
  ) => {
    const isAssigned = candidate.folders?.some((f) => f.id === folder.id);

    try {
      if (isAssigned) {
        const res = await fetch(
          `/api/folders/candidates?folderId=${folder.id}&candidateId=${candidate.id}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          const updatedFolders = (candidate.folders || []).filter((f) => f.id !== folder.id);
          const updated = { ...candidate, folders: updatedFolders };
          if (onUpdateCandidate) onUpdateCandidate(updated);
          await fetchFolders();
        }
      } else {
        const res = await fetch("/api/folders/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId: folder.id, candidateId: candidate.id }),
        });
        if (res.ok) {
          const updatedFolders = [
            ...(candidate.folders || []),
            { id: folder.id, name: folder.name, color: folder.color },
          ];
          const updated = { ...candidate, folders: updatedFolders };
          if (onUpdateCandidate) onUpdateCandidate(updated);
          await fetchFolders();
        }
      }
    } catch (err) {
      console.error("Error toggling candidate folder:", err);
    }
  };

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
    if (score >= 40) {
      return {
        badge: "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40",
      };
    }
    return {
      badge: "bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700",
    };
  };

  // Filter candidates by folder if selected
  const filteredCandidates = selectedFolderId
    ? candidates.filter((c) => c.folders?.some((f) => f.id === selectedFolderId))
    : candidates;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/40">
        <div className="flex items-center space-x-2">
          <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Ranking ATS
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          {activeQuery && (
            <span className="max-w-[160px] sm:max-w-[240px] truncate text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
              "{activeQuery}"
            </span>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
            {filteredCandidates.length} candidatos
          </span>
        </div>
      </div>

      {/* Carpetas de Búsqueda Toolbar */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/20 flex items-center space-x-2 overflow-x-auto scrollbar-none text-xs">
        <button
          onClick={() => setSelectedFolderId(null)}
          className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center space-x-1.5 ${
            selectedFolderId === null
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          <span>Todas las búsquedas</span>
          <span className="opacity-75 font-mono text-[10px]">({candidates.length})</span>
        </button>

        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          return (
            <div
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center space-x-1.5 cursor-pointer border ${
                isSelected
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: folder.color || "#6366f1" }}
              />
              <span className="truncate max-w-[120px]">{folder.name}</span>
              <span className="opacity-70 font-mono text-[10px]">({folder.candidateCount})</span>
              <button
                onClick={(e) => handleDeleteFolder(folder.id, e)}
                className="ml-1 opacity-40 hover:opacity-100 hover:text-rose-500 transition"
                title="Eliminar carpeta"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => setIsFolderModalOpen(true)}
          className="flex-shrink-0 px-2 py-1 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 text-[11px] flex items-center space-x-1 transition"
        >
          <FolderPlus className="w-3 h-3" />
          <span>+ Carpeta</span>
        </button>
      </div>

      {/* Content Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3">
            <div className="w-10 h-10 border-2 border-indigo-600 dark:border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-medium text-slate-800 dark:text-slate-300">
              Evaluando perfiles con IA y vectores semánticos...
            </p>
            <p className="text-[11px] text-slate-500">
              Calibrando afinidad de habilidades y experiencia
            </p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-8 bg-white dark:bg-transparent">
            <Briefcase className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
            <p className="text-slate-800 dark:text-slate-300 font-semibold">
              {selectedFolderId
                ? "No hay candidatos asignados a esta carpeta de búsqueda"
                : activeQuery
                ? "No se encontraron candidatos que coincidan con la búsqueda"
                : "Listo para buscar y evaluar candidatos"}
            </p>
            <p className="text-slate-500 max-w-sm mx-auto text-[11px] leading-relaxed">
              {selectedFolderId
                ? "Puedes asignar candidatos a esta carpeta usando el botón '+ Carpeta' en cada tarjeta de candidato."
                : activeQuery
                ? "Prueba ajustando los filtros o utilizando términos más generales en el panel derecho."
                : "Escribe los requerimientos del puesto en el panel derecho y presiona 'Analizar y Filtrar Candidatos' para clasificar los perfiles sin consumir tokens automáticamente."}
            </p>
          </div>
        ) : (
          filteredCandidates.map((candidate, index) => {
            const { label: dateLabel, isHistorical } = formatReceivedDate(candidate.receivedAt);
            const scoreStyles = getScoreColorClass(candidate.matchScore);

            const isTagDropdownOpen = activeTagDropdownId === candidate.id;
            const isFolderDropdownOpen = activeFolderDropdownId === candidate.id;

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

                    {/* Custom Candidate Tags & Folders */}
                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                      {/* Assigned Folders */}
                      {candidate.folders && candidate.folders.map((f) => (
                        <span
                          key={f.id}
                          className="text-[10px] px-2 py-0.5 rounded font-medium inline-flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: f.color }}
                          />
                          <span>{f.name}</span>
                        </span>
                      ))}

                      {/* Assigned Tags */}
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
                          <span>{t.tagName}</span>
                          <button
                            onClick={() => handleToggleTag(candidate, t.tagName, t.tagColor)}
                            className="opacity-60 hover:opacity-100 ml-0.5 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      {/* Tag Dropdown Trigger */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setActiveTagDropdownId(isTagDropdownOpen ? null : candidate.id);
                            setActiveFolderDropdownId(null);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 transition inline-flex items-center space-x-1"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span>+ Etiqueta</span>
                        </button>

                        {isTagDropdownOpen && (
                          <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-2 z-30 space-y-1.5 text-xs">
                            <span className="text-[10px] font-semibold text-slate-400 block px-1 uppercase tracking-wider">
                              Etiquetas Rápidas
                            </span>
                            <div className="space-y-1">
                              {PRESET_TAGS.map((pt) => {
                                const isTagged = candidate.tags?.some((t) => t.tagName === pt.name);
                                return (
                                  <button
                                    key={pt.name}
                                    onClick={() => handleToggleTag(candidate, pt.name, pt.color)}
                                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-[11px]"
                                  >
                                    <div className="flex items-center space-x-1.5">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: pt.color }}
                                      />
                                      <span>{pt.name}</span>
                                    </div>
                                    {isTagged && <Check className="w-3 h-3 text-indigo-600" />}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-1">
                              <input
                                type="text"
                                placeholder="Nueva etiqueta..."
                                value={customTagInput}
                                onChange={(e) => setCustomTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && customTagInput.trim()) {
                                    handleToggleTag(candidate, customTagInput.trim(), "#6366f1");
                                    setCustomTagInput("");
                                    setActiveTagDropdownId(null);
                                  }
                                }}
                                className="w-full text-[11px] px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Folder Dropdown Trigger */}
                      <div className="relative">
                        <button
                          onClick={() => {
                            setActiveFolderDropdownId(isFolderDropdownOpen ? null : candidate.id);
                            setActiveTagDropdownId(null);
                          }}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 transition inline-flex items-center space-x-1"
                        >
                          <Folder className="w-2.5 h-2.5" />
                          <span>+ Carpeta</span>
                        </button>

                        {isFolderDropdownOpen && (
                          <div className="absolute left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-2 z-30 space-y-1.5 text-xs">
                            <span className="text-[10px] font-semibold text-slate-400 block px-1 uppercase tracking-wider">
                              Asignar a Carpeta
                            </span>
                            {folders.length === 0 ? (
                              <p className="text-[11px] text-slate-400 p-1">No hay carpetas creadas aún.</p>
                            ) : (
                              folders.map((f) => {
                                const isAssigned = candidate.folders?.some((cf) => cf.id === f.id);
                                return (
                                  <button
                                    key={f.id}
                                    onClick={() => handleToggleCandidateFolder(candidate, f)}
                                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-[11px]"
                                  >
                                    <div className="flex items-center space-x-1.5 truncate">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: f.color }}
                                      />
                                      <span className="truncate">{f.name}</span>
                                    </div>
                                    {isAssigned && <Check className="w-3 h-3 text-indigo-600" />}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
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
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => onOpenDetails(candidate, "overview")}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center space-x-1"
                    >
                      <span>Ver Perfil</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => onOpenDetails(candidate, "notes")}
                      className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium flex items-center space-x-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Notas ({candidate.notesCount || 0})</span>
                    </button>
                  </div>

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

      {/* Modal: Nueva Carpeta de Búsqueda */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <FolderPlus className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Nueva Carpeta de Búsqueda
                </h3>
              </div>
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de la Búsqueda o Posición *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Especialista Frontend React, Analista SAP..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Requisitos clave, rango de experiencia o departamento..."
                  value={newFolderDesc}
                  onChange={(e) => setNewFolderDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Color Identificador
                </label>
                <div className="flex items-center space-x-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewFolderColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full transition transform ${
                        newFolderColor === color ? "ring-2 ring-offset-2 ring-indigo-500 scale-110" : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {creatingFolder ? "Creando..." : "Crear Carpeta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
