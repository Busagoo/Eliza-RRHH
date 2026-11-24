"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { LeftPanelFeed, EmailItem, SyncStateData } from "@/components/panels/LeftPanelFeed";
import { CentralPanelRanking } from "@/components/panels/CentralPanelRanking";
import { RightPanelSearch, SearchFilters } from "@/components/panels/RightPanelSearch";
import { ResumeViewerModal } from "@/components/ui/ResumeViewerModal";
import { CandidateDetailModal } from "@/components/ui/CandidateDetailModal";
import { LoginWall } from "@/components/auth/LoginWall";
import { CandidateSearchResponseItem } from "@/app/api/candidates/search/route";
import { Inbox, Award, SlidersHorizontal, Loader2 } from "lucide-react";

export default function ATSDashboard() {
  // Theme state: dark / light
  const [theme, setTheme] = useState<"dark" | "light">("light");

  // Mobile active tab: "feed" | "ranking" | "search"
  const [mobileTab, setMobileTab] = useState<"feed" | "ranking" | "search">("ranking");

  // Auth checking state
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Feed & Sync States
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [syncState, setSyncState] = useState<SyncStateData>({
    status: "IDLE",
    totalScanned: 0,
    totalResumesFound: 0,
    totalDiscarded: 0,
    totalErrors: 0,
  });
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [loadingFeed, setLoadingFeed] = useState<boolean>(true);
  const [isSyncingBatch, setIsSyncingBatch] = useState<boolean>(false);

  // AI analysis pause control (defaults to paused to allow fast email accumulation without token burn)
  const [isAiPaused, setIsAiPaused] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("ats_ai_analysis_paused");
    if (saved !== null) {
      setIsAiPaused(saved === "true");
    }
  }, []);

  const handleToggleAiPause = () => {
    setIsAiPaused((prev) => {
      const nextVal = !prev;
      localStorage.setItem("ats_ai_analysis_paused", String(nextVal));
      setBannerMessage({
        type: "info",
        text: nextVal
          ? "Análisis con IA pausado. Los correos se acumularán rápidamente sin consumir tokens."
          : "Análisis con IA activado. Analizando correos pendientes en segundo plano.",
      });
      setTimeout(() => setBannerMessage(null), 4000);
      return nextVal;
    });
  };

  // Search & Candidates Ranking States
  const [rankedCandidates, setRankedCandidates] = useState<CandidateSearchResponseItem[]>([]);
  const [activeQuery, setActiveQuery] = useState<string>("");
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);

  // Modals
  const [resumeModalCandidate, setResumeModalCandidate] = useState<CandidateSearchResponseItem | null>(null);
  const [detailModalCandidate, setDetailModalCandidate] = useState<CandidateSearchResponseItem | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<"overview" | "notes">("overview");

  const handleUpdateCandidate = (updated: CandidateSearchResponseItem) => {
    setRankedCandidates((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    if (detailModalCandidate?.id === updated.id) {
      setDetailModalCandidate(updated);
    }
  };

  // Notification banners
  const [bannerMessage, setBannerMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Sync theme with document element
  useEffect(() => {
    const saved = localStorage.getItem("eliza_theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      if (saved === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("eliza_theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  /**
   * Fetch sync state and account status
   */
  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status");
      if (res.ok) {
        const data = await res.json();
        if (data.syncState) {
          setSyncState(data.syncState);
        }
        if (data.account?.email) {
          setAccountEmail(data.account.email);
        } else {
          setAccountEmail(null);
        }
      }
    } catch (err) {
      console.warn("Could not fetch sync status:", err);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  /**
   * Fetch email feed (including dismissed items so user can switch between tabs instantly)
   */
  const fetchEmailFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/emails?limit=100&showDismissed=true");
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (err) {
      console.warn("Could not fetch emails:", err);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  /**
   * Hide / dismiss single email
   */
  const handleDismissEmail = async (emailId: string) => {
    try {
      const res = await fetch("/api/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, isDismissed: true }),
      });
      if (res.ok) {
        setEmails((prev) =>
          prev.map((e) => (e.id === emailId ? { ...e, isDismissed: true } : e))
        );
      }
    } catch (err) {
      console.error("Error dismissing email:", err);
    }
  };

  /**
   * Restore / unhide single email
   */
  const handleRestoreEmail = async (emailId: string) => {
    try {
      const res = await fetch("/api/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, isDismissed: false }),
      });
      if (res.ok) {
        setEmails((prev) =>
          prev.map((e) => (e.id === emailId ? { ...e, isDismissed: false } : e))
        );
        setBannerMessage({
          type: "success",
          text: "Correo restaurado a la bandeja principal.",
        });
        setTimeout(() => setBannerMessage(null), 3000);
      }
    } catch (err) {
      console.error("Error restoring email:", err);
    }
  };

  /**
   * Restore multiple selected emails from trash back to inbox feed
   */
  const handleRestoreMultipleEmails = async (emailIds: string[]) => {
    try {
      const res = await fetch("/api/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds, isDismissed: false }),
      });
      if (res.ok) {
        setEmails((prev) =>
          prev.map((e) => (emailIds.includes(e.id) ? { ...e, isDismissed: false } : e))
        );
        setBannerMessage({
          type: "success",
          text: `Se volvieron a mostrar ${emailIds.length} correos en la bandeja principal.`,
        });
        setTimeout(() => setBannerMessage(null), 4000);
      }
    } catch (err) {
      console.error("Error restoring multiple emails:", err);
    }
  };

  /**
   * Dismiss all discarded non-CV emails
   */
  const handleDismissAllDiscarded = async () => {
    try {
      const res = await fetch("/api/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissAllDiscarded: true }),
      });
      if (res.ok) {
        setEmails((prev) =>
          prev.map((e) => (e.status === "DISCARDED" ? { ...e, isDismissed: true } : e))
        );
        setBannerMessage({
          type: "success",
          text: "Se han movido los correos descartados a la papelera (puedes verlos o recuperarlos cuando quieras en la pestaña 'Papelera').",
        });
        setTimeout(() => setBannerMessage(null), 4000);
      }
    } catch (err) {
      console.error("Error dismissing all discarded emails:", err);
    }
  };

  /**
   * Restore all hidden emails from trash
   */
  const handleRestoreAllDismissed = async () => {
    try {
      const res = await fetch("/api/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreAll: true }),
      });
      if (res.ok) {
        setEmails((prev) => prev.map((e) => ({ ...e, isDismissed: false })));
        setBannerMessage({
          type: "success",
          text: "Se han restaurado todos los correos de la papelera a la bandeja principal.",
        });
        setTimeout(() => setBannerMessage(null), 4000);
      }
    } catch (err) {
      console.error("Error restoring all emails:", err);
    }
  };

  /**
   * Executes ATS Semantic Search & LLM Re-Ranking
   */
  const handleExecuteSearch = async (queryText: string, filters: SearchFilters) => {
    setLoadingSearch(true);
    setActiveQuery(queryText);
    setMobileTab("ranking");

    try {
      const res = await fetch("/api/candidates/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          filters,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRankedCandidates(data.candidates || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setBannerMessage({
          type: "error",
          text: errData.message || "Error al ejecutar la búsqueda de candidatos.",
        });
      }
    } catch (err: any) {
      setBannerMessage({
        type: "error",
        text: `Error de red al consultar el ranking: ${err.message}`,
      });
    } finally {
      setLoadingSearch(false);
    }
  };

  /**
   * Runs a single bounded batch of email sync (fast ingest or full batch)
   */
  const runSyncBatch = useCallback(
    async (forcedAction?: "ingest" | "batch" | "process") => {
      if (isSyncingBatch) return null;
      setIsSyncingBatch(true);
      try {
        const actionToUse = forcedAction || (isAiPaused ? "ingest" : "batch");
        const res = await fetch("/api/sync/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: actionToUse }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.syncState) {
            setSyncState(data.syncState);
          }
          await fetchEmailFeed();
          return data;
        }
      } catch (err) {
        console.warn("Batch sync error:", err);
      } finally {
        setIsSyncingBatch(false);
      }
      return null;
    },
    [isSyncingBatch, isAiPaused, fetchEmailFeed]
  );

  /**
   * Process pending candidate emails using AI & OCR in controlled batches
   */
  const handleProcessPending = async (targetEmailId?: string) => {
    setIsSyncingBatch(true);
    try {
      const res = await fetch("/api/sync/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: targetEmailId ? "process_single" : "process",
          targetEmailId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.syncState) {
          setSyncState(data.syncState);
        }
        await fetchEmailFeed();
        if (data.resumesFound > 0) {
          setBannerMessage({
            type: "success",
            text: `Se procesaron exitosamente ${data.resumesFound} currículum(s) con IA y OCR.`,
          });
          setTimeout(() => setBannerMessage(null), 4000);
        }
      }
    } catch (err: any) {
      console.error("Error processing pending candidates:", err);
    } finally {
      setIsSyncingBatch(false);
    }
  };

  /**
   * Toggle backfill worker (start, pause, reset)
   */
  const handleToggleBackfill = async (action: "start" | "pause" | "reset") => {
    try {
      if (action === "pause") {
        setSyncState((prev) => ({ ...prev, status: "PAUSED" }));
      } else if (action === "start" || action === "reset") {
        setSyncState((prev) => ({ ...prev, status: "RUNNING" }));
      }

      const res = await fetch("/api/sync/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, queryFilter: "in:inbox" }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.syncState) {
          setSyncState(data.syncState);
        }
        await fetchEmailFeed();

        if (action === "reset") {
          setBannerMessage({
            type: "success",
            text: "Sincronización reiniciada desde el inicio de la bandeja.",
          });
          setTimeout(() => setBannerMessage(null), 4000);
        }
      }
    } catch (err) {
      console.error("Backfill toggle failed:", err);
    }
  };

  /**
   * Disconnect active Gmail account (returns directly to Login Wall)
   */
  const handleDisconnectAccount = async () => {
    try {
      const res = await fetch("/api/auth/gmail/disconnect", { method: "POST" });
      if (res.ok) {
        setAccountEmail(null);
        setEmails([]);
        setRankedCandidates([]);
        await fetchSyncStatus();
      }
    } catch (err: any) {
      setBannerMessage({
        type: "error",
        text: `Error al desvincular cuenta: ${err.message}`,
      });
    }
  };

  /**
   * When an email in Panel 1 with a candidate is clicked, find or open that candidate
   */
  const handleSelectCandidateFromFeed = async (candidateId: string) => {
    const existing = rankedCandidates.find((c) => c.id === candidateId);
    if (existing) {
      setDetailModalCandidate(existing);
      return;
    }

    try {
      const res = await fetch(`/api/candidates/${candidateId}`);
      if (res.ok) {
        const data = await res.json();
        const c = data.candidate;
        if (c) {
          const item: CandidateSearchResponseItem = {
            id: c.id,
            fullName: c.fullName,
            contactEmail: c.contactEmail,
            phone: c.phone,
            location: c.location,
            seniority: c.seniority,
            experienceYears: c.experienceYears,
            skills: c.skills,
            languages: c.languages,
            summary: c.parsedData?.summary || c.resumeText?.slice(0, 300) || "",
            workHistory: c.parsedData?.workHistory || [],
            education: c.parsedData?.education || [],
            resumeFileUrl: c.resumeFileUrl || `/api/candidates/${c.id}/resume`,
            receivedAt: c.receivedAt,
            matchScore: 85,
            justification: "Candidato seleccionado directamente desde la bandeja de entrada.",
            keyStrengths: c.skills.slice(0, 3),
            missingRequirements: [],
          };
          setDetailModalCandidate(item);
        }
      }
    } catch (err) {
      console.error("Error loading candidate from feed:", err);
    }
  };

  // Initial load & Polling effect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("auth_success")) {
      setBannerMessage({
        type: "success",
        text: `¡Cuenta vinculada exitosamente (${urlParams.get("email") || "Conectada"})!`,
      });
      setTimeout(() => setBannerMessage(null), 6000);
    } else if (urlParams.get("auth_error")) {
      setAuthError(urlParams.get("auth_error"));
    }

    fetchSyncStatus();
    fetchEmailFeed();

    const interval = setInterval(() => {
      // Throttle polling: only refresh feed & status if document is active/visible
      if (document.visibilityState === "visible") {
        fetchSyncStatus();
        fetchEmailFeed();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchSyncStatus, fetchEmailFeed]);

  // Reactive runner: controls fast email ingestion and AI processing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isSyncingBatch) {
      if (syncState.status === "RUNNING") {
        // Fast ingestion mode: sync incoming emails quickly without AI if paused
        timeoutId = setTimeout(async () => {
          const res = await runSyncBatch(isAiPaused ? "ingest" : "batch");
          if (res && (!res.hasMore || res.status === "COMPLETED")) {
            fetchSyncStatus();
          }
        }, 1200);
      } else if (!isAiPaused) {
        // Ingestion completed or idle, but AI analysis is active: process pending emails
        const hasPending = emails.some(
          (e) => !e.isDismissed && (e.status === "PENDING" || e.status === "PROCESSING")
        );
        if (hasPending) {
          timeoutId = setTimeout(async () => {
            await handleProcessPending();
          }, 1500);
        }
      }
    }

    return () => clearTimeout(timeoutId);
  }, [
    syncState.status,
    isAiPaused,
    isSyncingBatch,
    emails,
    runSyncBatch,
    handleProcessPending,
    fetchSyncStatus,
  ]);

  // 1. Initial authentication loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
        <p className="text-xs text-slate-500 font-medium">Verificando sesión segura...</p>
      </div>
    );
  }

  // 2. Security Login Wall: If not authenticated with Google, block entry completely!
  if (!accountEmail) {
    return (
      <LoginWall
        theme={theme}
        onToggleTheme={toggleTheme}
        errorMessage={authError}
      />
    );
  }

  // 3. Authenticated: Render Full Dashboard
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Navigation */}
      <Navbar
        accountEmail={accountEmail}
        syncStatus={syncState.status}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefreshFeed={() => {
          fetchSyncStatus();
          fetchEmailFeed();
        }}
        onDisconnectAccount={handleDisconnectAccount}
      />

      {/* Optional Notification Toast / Banner */}
      {bannerMessage && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between font-medium transition-all ${
            bannerMessage.type === "success"
              ? "bg-emerald-100 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300 border-b border-emerald-300 dark:border-emerald-800"
              : bannerMessage.type === "info"
              ? "bg-indigo-100 dark:bg-indigo-950/90 text-indigo-800 dark:text-indigo-300 border-b border-indigo-300 dark:border-indigo-800"
              : "bg-rose-100 dark:bg-rose-950/90 text-rose-800 dark:text-rose-300 border-b border-rose-300 dark:border-rose-800"
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1.5 space-x-1 text-xs">
        <button
          onClick={() => setMobileTab("feed")}
          className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center space-x-1.5 transition ${
            mobileTab === "feed"
              ? "bg-indigo-600 text-white font-semibold shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Bandeja ({emails.length})</span>
        </button>

        <button
          onClick={() => setMobileTab("ranking")}
          className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center space-x-1.5 transition ${
            mobileTab === "ranking"
              ? "bg-indigo-600 text-white font-semibold shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Ranking ({rankedCandidates.length})</span>
        </button>

        <button
          onClick={() => setMobileTab("search")}
          className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center space-x-1.5 transition ${
            mobileTab === "search"
              ? "bg-indigo-600 text-white font-semibold shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filtros</span>
        </button>
      </div>

      {/* 3-Panel Main Layout */}
      <main className="flex-1 overflow-hidden">
        {/* DESKTOP VIEW: 3 columns side-by-side */}
        <div className="hidden md:grid md:grid-cols-12 h-full overflow-hidden">
          {/* PANEL 1: Left Feed (3 cols) */}
          <div className="col-span-3 h-full overflow-hidden">
            <LeftPanelFeed
              emails={emails}
              syncState={syncState}
              loading={loadingFeed}
              isSyncingBatch={isSyncingBatch}
              isAiPaused={isAiPaused}
              onToggleAiPause={handleToggleAiPause}
              onSelectCandidate={handleSelectCandidateFromFeed}
              onToggleBackfill={handleToggleBackfill}
              onProcessPending={handleProcessPending}
              onDismissEmail={handleDismissEmail}
              onRestoreEmail={handleRestoreEmail}
              onRestoreMultiple={handleRestoreMultipleEmails}
              onDismissAllDiscarded={handleDismissAllDiscarded}
              onRestoreAllDismissed={handleRestoreAllDismissed}
              onRefresh={fetchEmailFeed}
            />
          </div>

          {/* PANEL 2: Central ATS Ranking (6 cols) */}
          <div className="col-span-6 h-full overflow-hidden">
            <CentralPanelRanking
              candidates={rankedCandidates}
              activeQuery={activeQuery}
              loading={loadingSearch}
              onOpenResume={(candidate) => setResumeModalCandidate(candidate)}
              onOpenDetails={(candidate, initialTab) => {
                setDetailModalCandidate(candidate);
                setDetailModalTab(initialTab || "overview");
              }}
              onUpdateCandidate={handleUpdateCandidate}
            />
          </div>

          {/* PANEL 3: Right HR Search Requirements (3 cols) */}
          <div className="col-span-3 h-full overflow-hidden">
            <RightPanelSearch
              onExecuteSearch={handleExecuteSearch}
              loading={loadingSearch}
            />
          </div>
        </div>

        {/* MOBILE VIEW */}
        <div className="block md:hidden h-full overflow-hidden">
          {mobileTab === "feed" && (
            <LeftPanelFeed
              emails={emails}
              syncState={syncState}
              loading={loadingFeed}
              isSyncingBatch={isSyncingBatch}
              isAiPaused={isAiPaused}
              onToggleAiPause={handleToggleAiPause}
              onSelectCandidate={handleSelectCandidateFromFeed}
              onToggleBackfill={handleToggleBackfill}
              onProcessPending={handleProcessPending}
              onDismissEmail={handleDismissEmail}
              onRestoreEmail={handleRestoreEmail}
              onRestoreMultiple={handleRestoreMultipleEmails}
              onDismissAllDiscarded={handleDismissAllDiscarded}
              onRestoreAllDismissed={handleRestoreAllDismissed}
              onRefresh={fetchEmailFeed}
            />
          )}

          {mobileTab === "ranking" && (
            <CentralPanelRanking
              candidates={rankedCandidates}
              activeQuery={activeQuery}
              loading={loadingSearch}
              onOpenResume={(candidate) => setResumeModalCandidate(candidate)}
              onOpenDetails={(candidate, initialTab) => {
                setDetailModalCandidate(candidate);
                setDetailModalTab(initialTab || "overview");
              }}
              onUpdateCandidate={handleUpdateCandidate}
            />
          )}

          {mobileTab === "search" && (
            <RightPanelSearch
              onExecuteSearch={handleExecuteSearch}
              loading={loadingSearch}
            />
          )}
        </div>
      </main>

      {/* PDF / CV Viewer Modal */}
      <ResumeViewerModal
        candidate={resumeModalCandidate}
        isOpen={Boolean(resumeModalCandidate)}
        onClose={() => setResumeModalCandidate(null)}
      />

      {/* Detailed Profile Modal */}
      <CandidateDetailModal
        candidate={detailModalCandidate}
        isOpen={Boolean(detailModalCandidate)}
        initialTab={detailModalTab}
        onClose={() => setDetailModalCandidate(null)}
        onOpenResume={(c) => setResumeModalCandidate(c)}
        onUpdateCandidate={handleUpdateCandidate}
      />
    </div>
  );
}
