"use client";

import React from "react";
import { Shield, Lock, ArrowRight, Sun, Moon } from "lucide-react";

interface LoginWallProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  errorMessage?: string | null;
}

export function LoginWall({ theme, onToggleTheme, errorMessage }: LoginWallProps) {
  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 p-4 transition-colors relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={onToggleTheme}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm transition"
          title={theme === "dark" ? "Modo Día" : "Modo Nocturno"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none backdrop-blur-xl relative z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" />
            <span>Acceso Seguro ATS</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard ELIZA
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            Plataforma de selección y análisis inteligente de talento conectada a Gmail.
          </p>
        </div>

        {/* Error notice if redirected back with auth failure */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs text-center leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Security badge description */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-semibold text-xs">
            <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Protección de Datos & Token Guard</span>
          </div>
          <p className="leading-relaxed text-[11px]">
            Para proteger los currículums, datos de candidatos y tokens del sistema, se requiere iniciar sesión con la cuenta de Google autorizada antes de acceder a la plataforma.
          </p>
        </div>

        {/* Big Google Login Button */}
        <a
          href="/api/auth/gmail"
          className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-3 group active:scale-[0.99]"
        >
          {/* Google G Logo SVG */}
          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center p-0.5 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <span>Iniciar sesión con Google</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>

        {/* Footer info */}
        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
          Autenticación oficial OAuth 2.0 gestionada directamente por Google.
        </p>
      </div>
    </div>
  );
}
