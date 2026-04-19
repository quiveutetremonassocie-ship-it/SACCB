"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen pt-24 pb-24 px-6 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1e3a5f] bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-2.5 hover:bg-slate-100 transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </Link>

        <header className="mb-12">
          <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold mb-3">
            Informations légales
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-slate-800 mb-3">{title}</h1>
          {subtitle && <p className="text-slate-500">{subtitle}</p>}
        </header>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 md:p-10 prose max-w-none legal-content">
          {children}
        </div>

        <p className="text-xs text-slate-400 text-center mt-10">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
        </p>
      </div>
    </main>
  );
}
