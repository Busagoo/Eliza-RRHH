"use client";

import React, { useState } from "react";
import {
  Mail,
  RefreshCw,
  Database,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  HelpCircle,
} from "lucide-react";

interface NavbarProps {
  accountEmail?: string | null;
  syncStatus?: string;
  isRealtimeActive?: boolean;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  onRefreshFeed?: () => void;
  onDisconnectAccount?: () => Promise<void>;
  onOpenTutorial?: () => void;
}

export function Navbar({
  accountEmail,
  syncStatus = "IDLE",
  theme = "dark",
  onToggleTheme,
  onRefreshFeed,
  onDisconnectAccount,
  onOpenTutorial,
}: NavbarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-20 flex-shrink-0 transition-colors">
      {/* Brand: Super clean, without logo */}
      <div className="flex items-center space-x-2">
        <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
          Dashboard ELIZA
        </h1>
        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
          ATS
        </span>
      </div>

      {/* Center status badges (desktop) */}
      <div className="hidden md:flex items-center space-x-3 text-xs">
        {/* Realtime PubSub Indicator */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">Realtime Activo</span>
        </div>

        {/* Backfill Status */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <Database className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span className="text-slate-500 dark:text-slate-400">Sincronización:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
            {syncStatus === "RUNNING" ? (
              <span className="text-amber-500 dark:text-amber-400 flex items-center space-x-1">
                <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
                Escaneando...
              </span>
            ) : syncStatus === "COMPLETED" ? (
              <span className="text-emerald-600 dark:text-emerald-400">Completada</span>
            ) : (
              syncStatus
            )}
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center space-x-2">
        {/* Tutorial / Help Button */}
        {onOpenTutorial && (
          <button
            onClick={onOpenTutorial}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition flex items-center space-x-1.5 text-xs font-medium"
            title="Ver tutorial paso a paso"
          >
            <HelpCircle className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">Tutorial</span>
          </button>
        )}

        {/* Dark / Light Mode Toggle */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={theme === "dark" ? "Cambiar a Modo Día" : "Cambiar a Modo Nocturno"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 hover:-rotate-12 transition-transform" />
            )}
          </button>
        )}

        {/* Refresh Feed */}
        {onRefreshFeed && (
          <button
            onClick={onRefreshFeed}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Actualizar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Gmail Account Switching & Connect */}
        {accountEmail ? (
          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="max-w-[120px] sm:max-w-[150px] truncate font-medium">{accountEmail}</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {/* Dropdown Menu */}
            {accountMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                  Bandeja conectada:
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{accountEmail}</div>
                </div>

                <a
                  href="/api/auth/gmail"
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center space-x-2 transition"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Cambiar cuenta de Gmail</span>
                </a>

                {onDisconnectAccount && (
                  <button
                    onClick={async () => {
                      setAccountMenuOpen(false);
                      await onDisconnectAccount();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-300 flex items-center space-x-2 transition border-t border-slate-100 dark:border-slate-800"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Desconectar cuenta</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <a
            href="/api/auth/gmail"
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition flex items-center space-x-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Conectar Gmail</span>
          </a>
        )}
      </div>
    </header>
  );
}
