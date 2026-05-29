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

        {/* Boutons de partage */}
        <div className="mt-16 flex items-center justify-center gap-3">
          <span className="text-xs uppercase tracking-widest text-white/40 font-semibold mr-2">Partager</span>
          <a
            href="https://wa.me/?text=Decouvrez%20le%20SACCB%2C%20association%20de%20badminton%20a%20Sainte-Adresse%20!%20https%3A%2F%2Fsaccb.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-[#25D366]/20 hover:bg-[#25D366]/40 flex items-center justify-center transition"
            title="Partager sur WhatsApp"
          >
            <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
          <a
            href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fsaccb.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-full bg-[#1877F2]/20 hover:bg-[#1877F2]/40 flex items-center justify-center transition"
            title="Partager sur Facebook"
          >
            <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
          <button
            onClick={() => { navigator.clipboard.writeText("https://saccb.fr"); alert("Lien copie !"); }}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            title="Copier le lien"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50">
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
