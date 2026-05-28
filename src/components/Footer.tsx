"use client";

import Link from "next/link";
import ContactForm from "./ContactForm";

export default function Footer({ year }: { year: number; onAdmin?: () => void }) {
  return (
    <footer id="contact" className="bg-[#1e3a5f] border-t border-[#1e3a5f] mt-20">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-blue-300 font-semibold mb-3">Contact</p>
          <h2 className="font-display text-5xl h-display text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-emerald-300">Contactez-nous</h2>
          <p className="text-white/50 mt-3 text-sm">Une question ? Envoyez-nous un message.</p>
        </div>

        <div className="max-w-lg mx-auto">
          <ContactForm theme="dark" />
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50">
          <Link href="/mentions-legales" className="hover:text-white transition">Mentions légales</Link>
          <span className="text-white/20">•</span>
          <Link href="/cgu" className="hover:text-white transition">CGU</Link>
          <span className="text-white/20">•</span>
          <Link href="/cgv" className="hover:text-white transition">CGV</Link>
          <span className="text-white/20">•</span>
          <Link href="/politique-confidentialite" className="hover:text-white transition">Politique de confidentialité</Link>
          <span className="text-white/20">•</span>
          {/* Lien admin volontairement invisible pour les visiteurs */}
          <Link
            href="/admin"
            className="opacity-0 hover:opacity-30 focus:opacity-30 transition-opacity text-white cursor-default select-none text-[10px]"
            title=""
            tabIndex={-1}
            aria-hidden="true"
          >
            ·
          </Link>
        </div>

        <p className="text-center mt-6 text-xs text-white/70">
          © {year} SACCB — Sainte-Adresse · Salle Paul Vatine
        </p>
      </div>
    </footer>
  );
}
