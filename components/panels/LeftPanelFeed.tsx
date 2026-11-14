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
  onSelectCandidate?: (candidateId: string) => void;
  onToggleBackfill?: (action: "start" | "pause" | "reset") => void;
  onDismissEmail?: (emailId: string) => Promise<void>;
  onDismissAllDiscarded?: () => Promise<void>;
  onRefresh?: () => void;
}

export function LeftPanelFeed({
  emails,
  syncState,
  loading = false,
  onSelectCandidate,
  onToggleBackfill,
  onDismissEmail,
  onDismissAllDiscarded,
  onRefresh,
}: LeftPanelFeedProps) {
  const [filterTab, setFilterTab] = useState<"ALL" | "PROCESSED" | "PROCESSING" | "DISCARDED">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [cleaning, setCleaning] = useState(false);

  const filteredEmails = emails.filter((mail) => {
    if (filterTab !== "ALL" && mail.status !== filterTab) return false;
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

  const totalScanned = syncState.totalScanned || 0;
  const totalResumes = syncState.totalResumesFound || 0;
  const progressPercent = Math.min(100, Math.round((totalResumes / Math.max(1, totalScanned)) * 100));

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/60 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-hidden transition-colors">
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/40">
        <div className="flex items-center space-x-2">
          <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Feed de Correos
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {filterTab === "DISCARDED" && onDismissAllDiscarded && (
            <button
              onClick={handleCleanDiscarded}
              disabled={cleaning}
              className="text-[10px] px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 transition font-medium disabled:opacity-50"
              title="Borrar todos los correos descartados para limpiar la vista"
            >
              {cleaning ? "Limpiando..." : "Limpiar descartados"}
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
                ? "Sincronizando bandeja Gmail..."
                : syncState.status === "COMPLETED"
                ? "Bandeja sincronizada"
                : syncState.status === "PAUSED"
                ? "Sincronización en pausa"
                : "Listo para sincronizar"}
            </span>
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
              title="Reiniciar sincronización desde los correos más nuevos del inicio"
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
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800/80 space-y-2 bg-white dark:bg-slate-900/20">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por remitente o asunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:outline-none placeholder:text-slate-400 text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex space-x-1 text-[11px] font-medium">
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
            <span>Analizando</span>
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
        </div>
      </div>

      {/* Email Feed List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/60">
        {loading && emails.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Cargando bandeja de entrada...
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p>No hay correos en esta sección.</p>
          </div>
        ) : (
          filteredEmails.map((email) => {
            const { text: dateDisplay, isHistorical } = formatDate(email.receivedAt);
            const isClickable = Boolean(email.candidate?.id);

            return (
              <div
                key={email.id}
                className="p-3 transition-colors bg-white dark:bg-transparent hover:bg-slate-100/70 dark:hover:bg-slate-900/40 relative group"
              >
                {/* Top Row: Sender, Date & Quick Dismiss */}
                <div className="flex items-start justify-between gap-1 mb-1">
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

                    {/* Dismiss / Delete button */}
                    {onDismissEmail && (
                      <button
                        onClick={() => onDismissEmail(email.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-0.5 rounded transition"
                        title="Ocultar este correo para que no vuelva a aparecer"
                      >
                        <Trash2 className="w-3 h-3" />
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

                    {email.status === "PROCESSING" && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-medium animate-pulse">
                        <Clock className="w-2.5 h-2.5 animate-spin" />
                        <span>Analizando...</span>
                      </span>
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
