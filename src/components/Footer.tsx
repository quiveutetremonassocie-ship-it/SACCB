"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { publicContact } from "@/lib/db";

export default function Footer({ year, onAdmin }: { year: number; onAdmin: () => void }) {
  return (
    <footer id="contact" className="bg-[#1e3a5f] border-t border-[#1e3a5f] mt-20">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-blue-300 font-semibold mb-3">Contact</p>
          <h2 className="font-display text-5xl h-display text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-emerald-300">Contactez-nous</h2>
          <p className="text-white/50 mt-3 text-sm">Une question ? Envoyez-nous un message.</p>
        </div>

        <div className="max-w-lg mx-auto">
          <ContactForm />
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
          <button
            onClick={onAdmin}
            className="opacity-0 hover:opacity-30 focus:opacity-30 transition-opacity text-white cursor-default select-none text-[10px]"
            title=""
            tabIndex={-1}
            aria-hidden="true"
          >
            ·
          </button>
        </div>

        <p className="text-center mt-6 text-xs text-white/40">
          © {year} SACCB — Sainte-Adresse · Salle Paul Vatine
        </p>
      </div>
    </footer>
  );
}

function ContactForm() {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState(""); // champ piège invisible pour les bots
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [formOpenedAt] = useState(() => Date.now()); // heure d'ouverture du formulaire

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Anti-spam 1 : honeypot — si rempli c'est un bot
    if (honeypot) return;

    // Anti-spam 2 : temps minimum de 4 secondes sur le formulaire
    if (Date.now() - formOpenedAt < 4000) {
      setError("Envoi trop rapide. Attendez quelques secondes.");
      return;
    }

    setLoading(true);
    setError("");
    const r = await publicContact(nom.trim(), email.trim(), message.trim());
    setLoading(false);
    if (r.ok) {
      setSent(true);
      setNom(""); setEmail(""); setMessage("");
    } else {
      setError(r.reason || "Erreur lors de l'envoi. Réessayez.");
    }
  }

  if (sent) {
    return (
      <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <p className="text-white font-semibold text-lg">Message envoyé !</p>
        <p className="text-white/60 text-sm mt-2">Nous vous répondrons dans les plus brefs délais.</p>
        <button onClick={() => setSent(false)} className="mt-4 text-xs text-white/40 hover:text-white/70 transition underline">
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/10 border border-white/20 rounded-2xl p-7 space-y-4">
      {/* Champ piège anti-bot — invisible pour les humains */}
      <div style={{ display: "none" }} aria-hidden="true">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-blue-300 mb-1.5 block">Nom</label>
          <input
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition text-sm"
            placeholder="Votre nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-blue-300 mb-1.5 block">Email</label>
          <input
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition text-sm"
            type="email"
            placeholder="votre@email.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-blue-300 mb-1.5 block">Message</label>
        <textarea
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition text-sm resize-none"
          rows={4}
          placeholder="Votre message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={1000}
        />
        <p className="text-xs text-white/30 text-right mt-0.5">{message.length}/1000</p>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition"
      >
        <Send className="w-4 h-4" />
        {loading ? "Envoi en cours..." : "Envoyer le message"}
      </button>
    </form>
  );
}
