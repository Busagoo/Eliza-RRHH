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

  // Search & Candidates Ranking States
  const [rankedCandidates, setRankedCandidates] = useState<CandidateSearchResponseItem[]>([]);
  const [activeQuery, setActiveQuery] = useState<string>(
    "Desarrollador con experiencia técnica, proactivo y buen nivel de comunicación"
  );
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);

  // Modals
  const [resumeModalCandidate, setResumeModalCandidate] = useState<CandidateSearchResponseItem | null>(null);
  const [detailModalCandidate, setDetailModalCandidate] = useState<CandidateSearchResponseItem | null>(null);

  // Notification banners
  const [bannerMessage, setBannerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
   * Fetch email feed
   */
  const fetchEmailFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/emails?limit=60");
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
   * Dismiss single email
   */
  const handleDismissEmail = async (emailId: string) => {
    try {
      const res = await fetch("/api/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      });
      if (res.ok) {
        setEmails((prev) => prev.filter((e) => e.id !== emailId));
      }
    } catch (err) {
      console.error("Error dismissing email:", err);
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
        setEmails((prev) => prev.filter((e) => e.status !== "DISCARDED"));
        setBannerMessage({
          type: "success",
          text: "Se han ocultado todos los correos que no son CVs de la bandeja.",
        });
        setTimeout(() => setBannerMessage(null), 4000);
      }
    } catch (err) {
      console.error("Error dismissing all discarded emails:", err);
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
   * Toggle backfill worker (start, pause, reset)
   */
  const handleToggleBackfill = async (action: "start" | "pause" | "reset") => {
    try {
      const res = await fetch("/api/sync/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, queryFilter: "in:inbox" }),
      });

      if (res.ok) {
        await fetchSyncStatus();
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
            resumeFileUrl: c.resumeFileUrl,
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

    handleExecuteSearch(
      "Desarrollador con experiencia técnica, proactivo y buen nivel de comunicación",
      { includeHistorical: true }
    );

    const interval = setInterval(() => {
      // Throttle polling: only refresh feed & status if document is active/visible
      if (document.visibilityState === "visible") {
        fetchSyncStatus();
        fetchEmailFeed();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchSyncStatus, fetchEmailFeed]);

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
              onSelectCandidate={handleSelectCandidateFromFeed}
              onToggleBackfill={handleToggleBackfill}
              onDismissEmail={handleDismissEmail}
              onDismissAllDiscarded={handleDismissAllDiscarded}
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
              onOpenDetails={(candidate) => setDetailModalCandidate(candidate)}
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
              onSelectCandidate={handleSelectCandidateFromFeed}
              onToggleBackfill={handleToggleBackfill}
              onDismissEmail={handleDismissEmail}
              onDismissAllDiscarded={handleDismissAllDiscarded}
              onRefresh={fetchEmailFeed}
            />
          )}

          {mobileTab === "ranking" && (
            <CentralPanelRanking
              candidates={rankedCandidates}
              activeQuery={activeQuery}
              loading={loadingSearch}
              onOpenResume={(candidate) => setResumeModalCandidate(candidate)}
              onOpenDetails={(candidate) => setDetailModalCandidate(candidate)}
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
        onClose={() => setDetailModalCandidate(null)}
        onOpenResume={(c) => setResumeModalCandidate(c)}
      />
    </div>
  );
}
