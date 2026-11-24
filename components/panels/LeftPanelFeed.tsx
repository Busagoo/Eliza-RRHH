"use client";

import React, { useState } from "react";
import {
  Inbox,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Paperclip,
  Trash2,
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

export interface EmailItem {
  id: string;
  gmailMessageId: string;
  sender: string;
  senderEmail?: string | null;
  senderName?: string | null;
  subject: string;
  snippet?: string | null;
  receivedAt: string | Date;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "DISCARDED" | "ERROR";
  isDismissed?: boolean;
  hasAttachment: boolean;
  attachmentFilename?: string | null;
  discardReason?: string | null;
  candidate?: {
    id: string;
    fullName: string;
    seniority?: string | null;
    experienceYears: number;
    skills: string[];
    resumeFileUrl?: string | null;
  } | null;
}

export interface SyncStateData {
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "ERROR";
  totalScanned: number;
  totalResumesFound: number;
  totalDiscarded: number;
  totalErrors: number;
  nextPageToken?: string | null;
  lastError?: string | null;
}

interface LeftPanelFeedProps {
  emails: EmailItem[];
  syncState: SyncStateData;
  loading?: boolean;
  isSyncingBatch?: boolean;
  isAiPaused?: boolean;
  onToggleAiPause?: () => void;
  onSelectCandidate?: (candidateId: string) => void;
  onToggleBackfill?: (action: "start" | "pause" | "reset") => void;
  onProcessPending?: (targetEmailId?: string) => Promise<void>;
  onDismissEmail?: (emailId: string) => Promise<void>;
  onRestoreEmail?: (emailId: string) => Promise<void>;
  onRestoreMultiple?: (emailIds: string[]) => Promise<void>;
  onDismissAllDiscarded?: () => Promise<void>;
  onRestoreAllDismissed?: () => Promise<void>;
  onRefresh?: () => void;
}

export function LeftPanelFeed({
  emails,
  syncState,
  loading = false,
  isSyncingBatch = false,
  isAiPaused = true,
  onToggleAiPause,
  onSelectCandidate,
  onToggleBackfill,
  onProcessPending,
  onDismissEmail,
  onRestoreEmail,
  onRestoreMultiple,
  onDismissAllDiscarded,
  onRestoreAllDismissed,
  onRefresh,
}: LeftPanelFeedProps) {
  const [filterTab, setFilterTab] = useState<"ALL" | "PROCESSED" | "PROCESSING" | "DISCARDED" | "TRASH">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());
  const [cleaning, setCleaning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [processingEmailId, setProcessingEmailId] = useState<string | null>(null);

  const pendingEmailsCount = emails.filter(
    (e) => !e.isDismissed && (e.status === "PENDING" || e.status === "PROCESSING")
  ).length;

  const filteredEmails = emails.filter((mail) => {
    // Papelera vs Active
    if (filterTab === "TRASH") {
      if (!mail.isDismissed) return false;
    } else {
      if (mail.isDismissed) return false;
      if (filterTab === "PROCESSING") {
        if (mail.status !== "PROCESSING" && mail.status !== "PENDING") return false;
      } else if (filterTab !== "ALL" && mail.status !== filterTab) {
        return false;
      }
    }

    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    return (
      mail.subject.toLowerCase().includes(term) ||
      (mail.sender || "").toLowerCase().includes(term) ||
      (mail.snippet || "").toLowerCase().includes(term) ||
      (mail.candidate?.fullName || "").toLowerCase().includes(term)
    );
  });

  const formatDate = (dateStr: string | Date) => {
    try {
      const d = new Date(dateStr);
      const isHistorical = d.getFullYear() <= 2024;
      const formatted = d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: isHistorical ? "numeric" : undefined,
      });
      return { text: formatted, isHistorical };
    } catch {
      return { text: "Reciente", isHistorical: false };
    }
  };

  const handleCleanDiscarded = async () => {
    if (!onDismissAllDiscarded) return;
    setCleaning(true);
    try {
      await onDismissAllDiscarded();
    } finally {
      setCleaning(false);
    }
  };

  const handleRestoreAll = async () => {
    if (!onRestoreAllDismissed) return;
    setRestoring(true);
    try {
      await onRestoreAllDismissed();
      setSelectedTrashIds(new Set());
    } finally {
      setRestoring(false);
    }
  };

  const toggleSelectTrash = (id: string) => {
    setSelectedTrashIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTrash = () => {
    if (selectedTrashIds.size === filteredEmails.length) {
      setSelectedTrashIds(new Set());
    } else {
      setSelectedTrashIds(new Set(filteredEmails.map((e) => e.id)));
    }
  };

  const handleRestoreSelected = async () => {
    if (!onRestoreMultiple || selectedTrashIds.size === 0) return;
    setRestoring(true);
    try {
      await onRestoreMultiple(Array.from(selectedTrashIds));
      setSelectedTrashIds(new Set());
    } finally {
      setRestoring(false);
    }
  };

  const totalScanned = syncState.totalScanned || 0;
  const totalResumes = syncState.totalResumesFound || 0;
  const progressPercent = Math.min(100, Math.round((totalResumes / Math.max(1, totalScanned)) * 100));

  const countDismissed = emails.filter((e) => e.isDismissed).length;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/60 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-hidden transition-colors">
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/40">
        <div className="flex items-center space-x-2">
          {filterTab === "TRASH" ? (
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          ) : (
            <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          )}
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {filterTab === "TRASH" ? "Papelera de Correos" : "Feed de Correos"}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {filterTab === "DISCARDED" && onDismissAllDiscarded && (
            <button
              onClick={handleCleanDiscarded}
              disabled={cleaning}
              className="text-[10px] px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 transition font-medium disabled:opacity-50"
              title="Mover todos los correos no-CV a la papelera"
            >
              {cleaning ? "Moviendo..." : "Mover descartados a papelera"}
            </button>
          )}

          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
            {filteredEmails.length}
          </span>
        </div>
      </div>

      {/* Historical Sync Progress Banner */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 bg-indigo-50/40 dark:bg-gradient-to-b dark:from-indigo-950/20 dark:to-transparent">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center space-x-1.5 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                syncState.status === "RUNNING"
                  ? "bg-amber-400 animate-ping"
                  : syncState.status === "COMPLETED"
                  ? "bg-emerald-500"
                  : "bg-slate-400"
              }`}
            />
            <span className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">
              {syncState.status === "RUNNING"
                ? isSyncingBatch
                  ? "Leyendo correos de Gmail..."
                  : "Sincronizando bandeja..."
                : syncState.status === "COMPLETED"
                ? "Bandeja sincronizada"
                : syncState.status === "PAUSED"
                ? "Sincronización en pausa"
                : "Listo para sincronizar"}
            </span>
            {isSyncingBatch && (
              <RefreshCw className="w-3 h-3 animate-spin text-indigo-500 ml-1" />
            )}
          </div>

          {/* Sync controls */}
          <div className="flex items-center space-x-1">
            {syncState.status === "RUNNING" ? (
              <button
                onClick={() => onToggleBackfill && onToggleBackfill("pause")}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-500 transition"
                title="Pausar sincronización"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onToggleBackfill && onToggleBackfill("start")}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-500 transition"
                title="Iniciar o reanudar sincronización"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onToggleBackfill && onToggleBackfill("reset")}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-500 transition"
              title="Reiniciar sincronización desde el inicio de la bandeja"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic Metric Text */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 font-mono">
          <strong className="text-slate-800 dark:text-slate-200">{totalScanned.toLocaleString()}</strong> mails revisados —{" "}
          <strong className="text-indigo-600 dark:text-indigo-300">{totalResumes.toLocaleString()}</strong> CVs encontrados
        </p>

        {/* Progress Track */}
        <div className="w-full bg-slate-200 dark:bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-300 dark:border-slate-800 relative">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(8, progressPercent)}%` }}
          />
        </div>

        {/* Pending Analysis Quick Action & Pause Control */}
        {pendingEmailsCount > 0 && onProcessPending && (
          <div className="mt-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between gap-1 flex-wrap">
            <span className="text-[11px] font-medium flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              <span className={isAiPaused ? "text-amber-700 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400 font-semibold"}>
                {pendingEmailsCount} {pendingEmailsCount === 1 ? "correo por analizar" : "correos por analizar"}
                {isAiPaused && " (IA en pausa)"}
              </span>
            </span>

            <div className="flex items-center space-x-1.5">
              {/* Toggle Pause / Resume Auto-AI */}
              {onToggleAiPause && (
                <button
                  onClick={onToggleAiPause}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition flex items-center space-x-1 ${
                    isAiPaused
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200"
                      : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200"
                  }`}
                  title={
                    isAiPaused
                      ? "Reanudar análisis automático continuo en segundo plano"
                      : "Pausar análisis de IA para acumular correos más rápido sin gastar tokens"
                  }
                >
                  {isAiPaused ? (
                    <>
                      <Play className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Auto-IA</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      <span>Pausar IA</span>
                    </>
                  )}
                </button>
              )}

              {/* Manual Batch Trigger */}
              <button
                onClick={() => onProcessPending()}
                disabled={isSyncingBatch}
                className="text-[10px] px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shadow-xs flex items-center space-x-1 disabled:opacity-50"
                title="Analizar un lote de 3 correos pendientes ahora"
              >
                {isSyncingBatch ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>Analizando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Analizar lote</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800/80 space-y-2 bg-white dark:bg-slate-900/20">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={
              filterTab === "TRASH"
                ? "Buscar en la papelera..."
                : "Buscar por remitente o asunto..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1 text-[11px] font-medium">
          <button
            onClick={() => setFilterTab("ALL")}
            className={`px-2 py-1 rounded transition ${
              filterTab === "ALL"
                ? "bg-indigo-600 text-white font-semibold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterTab("PROCESSED")}
            className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
              filterTab === "PROCESSED"
                ? "bg-emerald-600 text-white font-semibold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-500"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>CVs</span>
          </button>
          <button
            onClick={() => setFilterTab("PROCESSING")}
            className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
              filterTab === "PROCESSING"
                ? "bg-amber-600 text-white font-semibold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-500"
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Por analizar {pendingEmailsCount > 0 && `(${pendingEmailsCount})`}</span>
          </button>
          <button
            onClick={() => setFilterTab("DISCARDED")}
            className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
              filterTab === "DISCARDED"
                ? "bg-slate-700 text-white font-semibold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <XCircle className="w-3 h-3" />
            <span>No es CV</span>
          </button>
          <button
            onClick={() => setFilterTab("TRASH")}
            className={`px-2 py-1 rounded transition flex items-center space-x-1 ${
              filterTab === "TRASH"
                ? "bg-rose-600 text-white font-semibold shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600"
            }`}
            title="Papelera: correos eliminados u ocultados"
          >
            <Trash2 className="w-3 h-3" />
            <span>Papelera {countDismissed > 0 && `(${countDismissed})`}</span>
          </button>
        </div>
      </div>

      {/* Dedicated Papelera Control Bar (when in TRASH tab) */}
      {filterTab === "TRASH" && (
        <div className="px-3 py-2 bg-rose-50/80 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="select-all-trash"
              checked={filteredEmails.length > 0 && selectedTrashIds.size === filteredEmails.length}
              onChange={handleSelectAllTrash}
              className="w-3.5 h-3.5 rounded text-emerald-600 border-rose-300 dark:border-rose-800 focus:ring-0 cursor-pointer"
            />
            <label
              htmlFor="select-all-trash"
              className="text-[11px] text-rose-900 dark:text-rose-200 font-medium cursor-pointer select-none"
            >
              {selectedTrashIds.size > 0
                ? `${selectedTrashIds.size} de ${filteredEmails.length} seleccionados`
                : "Seleccionar todos"}
            </label>
          </div>

          <div className="flex items-center space-x-1.5">
            {selectedTrashIds.size > 0 && onRestoreMultiple && (
              <button
                onClick={handleRestoreSelected}
                disabled={restoring}
                className="text-[10px] px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition flex items-center space-x-1 shadow-xs disabled:opacity-50"
                title="Volver a mostrar los correos seleccionados en la bandeja"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Volver a mostrar ({selectedTrashIds.size})</span>
              </button>
            )}

            {onRestoreAllDismissed && countDismissed > 0 && (
              <button
                onClick={handleRestoreAll}
                disabled={restoring}
                className="text-[10px] px-2 py-1 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-medium disabled:opacity-50 flex items-center space-x-1 shadow-2xs"
                title="Restaurar toda la papelera a la bandeja principal"
              >
                <RotateCcw className="w-2.5 h-2.5 text-indigo-500" />
                <span>{restoring ? "Restaurando..." : "Restaurar todos"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Email Feed List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/60">
        {loading && emails.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Cargando bandeja de entrada...
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            {filterTab === "TRASH" ? (
              <>
                <Trash2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-500 dark:text-slate-400">La papelera está vacía.</p>
                <p className="text-[11px] text-slate-400">Los correos que descartes u ocultes aparecerán aquí para que puedas recuperarlos.</p>
              </>
            ) : (
              <>
                <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>No hay correos en esta sección.</p>
              </>
            )}
          </div>
        ) : (
          filteredEmails.map((email) => {
            const { text: dateDisplay, isHistorical } = formatDate(email.receivedAt);
            const isClickable = Boolean(email.candidate?.id);
            const isSelected = selectedTrashIds.has(email.id);

            return (
              <div
                key={email.id}
                className={`p-3 transition-colors relative group ${
                  filterTab === "TRASH"
                    ? isSelected
                      ? "bg-rose-50/80 dark:bg-rose-950/40 border-l-2 border-rose-500"
                      : "bg-white/60 dark:bg-slate-900/30 hover:bg-rose-50/40 dark:hover:bg-rose-950/20"
                    : "bg-white dark:bg-transparent hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
                }`}
              >
                {/* Top Row: Sender, Date & Visibility Action */}
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div className="flex items-center space-x-2 truncate">
                    {/* Checkbox only in TRASH mode */}
                    {filterTab === "TRASH" && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectTrash(email.id)}
                        className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 dark:border-slate-700 focus:ring-0 cursor-pointer flex-shrink-0"
                      />
                    )}

                    <span
                      onClick={() => {
                        if (email.candidate?.id && onSelectCandidate) {
                          onSelectCandidate(email.candidate.id);
                        }
                      }}
                      className={`text-xs font-semibold text-slate-900 dark:text-slate-200 truncate ${
                        isClickable ? "cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400" : ""
                      }`}
                    >
                      {email.candidate?.fullName || email.senderName || email.sender}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    <span
                      className={`text-[10px] whitespace-nowrap font-mono px-1.5 py-0.5 rounded ${
                        isHistorical
                          ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-900/50"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                      title={new Date(email.receivedAt).toLocaleString("es-AR")}
                    >
                      {dateDisplay}
                    </span>

                    {/* Button inside TRASH: 'Volver a mostrar' */}
                    {filterTab === "TRASH" && onRestoreEmail && (
                      <button
                        onClick={() => onRestoreEmail(email.id)}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10px] transition shadow-xs"
                        title="Volver a mostrar este correo en la bandeja principal"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        <span>Volver a mostrar</span>
                      </button>
                    )}

                    {/* Button outside TRASH: 'Mover a la papelera' */}
                    {filterTab !== "TRASH" && onDismissEmail && (
                      <button
                        onClick={() => onDismissEmail(email.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1 rounded transition"
                        title="Mover a la papelera (puedes restaurarlo cuando quieras)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subject */}
                <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate font-medium mb-1">
                  {email.subject}
                </p>

                {/* Snippet / preview */}
                {email.snippet && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2 font-normal">
                    {email.snippet}
                  </p>
                )}

                {/* Status Badges & Attachment indicator */}
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center space-x-1.5">
                    {email.status === "PROCESSED" && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60 font-medium">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>CV Procesado</span>
                      </span>
                    )}

                    {email.status === "PENDING" && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 font-medium">
                        <Clock className="w-2.5 h-2.5" />
                        <span>Pendiente</span>
                      </span>
                    )}

                    {email.status === "PROCESSING" && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-medium animate-pulse">
                        <Clock className="w-2.5 h-2.5 animate-spin" />
                        <span>Analizando...</span>
                      </span>
                    )}

                    {onProcessPending && (email.status === "PENDING" || email.status === "ERROR") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProcessingEmailId(email.id);
                          onProcessPending(email.id).finally(() => setProcessingEmailId(null));
                        }}
                        disabled={processingEmailId === email.id || isSyncingBatch}
                        className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium transition border border-indigo-200 dark:border-indigo-800/80 flex items-center space-x-1"
                        title="Analizar este currículum con IA y OCR"
                      >
                        {processingEmailId === email.id ? (
                          <>
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>Analizando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                            <span>Analizar</span>
                          </>
                        )}
                      </button>
                    )}

                    {email.status === "DISCARDED" && (
                      <span
                        className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                        title={email.discardReason || "No es un CV"}
                      >
                        <XCircle className="w-2.5 h-2.5 text-slate-400" />
                        <span>No es CV</span>
                      </span>
                    )}

                    {email.status === "ERROR" && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800/60">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Error</span>
                      </span>
                    )}
                  </div>

                  {/* Attachment indicator */}
                  {email.hasAttachment && (
                    <span
                      className="inline-flex items-center space-x-1 text-slate-500 text-[10px]"
                      title={email.attachmentFilename || "Adjunto"}
                    >
                      <Paperclip className="w-3 h-3 text-slate-400" />
                      <span className="max-w-[100px] truncate">
                        {email.attachmentFilename?.split(".").pop()?.toUpperCase() || "PDF"}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
