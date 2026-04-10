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
    <main className="min-h-screen pt-32 pb-24 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </Link>

        <header className="mb-12">
          <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-3">
            Informations légales
          </p>
          <h1 className="font-display text-4xl md:text-5xl h-display mb-3">{title}</h1>
          {subtitle && <p className="text-white/60">{subtitle}</p>}
        </header>

        <div className="glass p-8 md:p-10 prose prose-invert max-w-none legal-content">
          {children}
        </div>

        <p className="text-xs text-white/40 text-center mt-10">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
        </p>
      </div>
    </main>
  );
}
