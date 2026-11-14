import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RRHH ELIZA - ATS Inteligente con Ingesta Gmail y Ranking en Tiempo Real",
  description:
    "Applicant Tracking System avanzado conectado a Gmail API con soporte para backfill histórico (2024+), Pub/Sub en tiempo real y ranking semántico de candidatos con pgvector.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-100 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 min-h-screen antialiased select-none">
        {children}
      </body>
    </html>
  );
}
