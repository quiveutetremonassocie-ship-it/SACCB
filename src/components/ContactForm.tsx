"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { publicContact } from "@/lib/db";

// Formulaire de contact réutilisable, thème clair (page /contact) ou sombre (footer)
export default function ContactForm({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [formOpenedAt] = useState(() => Date.now());

  const isLight = theme === "light";
  const labelCls = isLight
    ? "text-xs uppercase tracking-widest text-slate-500 mb-1.5 block"
    : "text-xs uppercase tracking-widest text-blue-300 mb-1.5 block";
  const inputCls = isLight
    ? "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition text-sm"
    : "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:border-blue-400 transition text-sm";
  const formCls = isLight
    ? "bg-white border border-slate-200 shadow-lg rounded-2xl p-7 space-y-4"
    : "bg-white/10 border border-white/20 rounded-2xl p-7 space-y-4";
  const counterCls = isLight ? "text-xs text-slate-400 text-right mt-0.5" : "text-xs text-white/60 text-right mt-0.5";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;
    if (Date.now() - formOpenedAt < 4000) {
      setError("Envoi trop rapide. Attendez quelques secondes.");
      return;
    }
    setLoading(true);
    setError("");
    const r = await publicContact(nom.trim(), email.trim(), message.trim(), honeypot);
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
      <div className={isLight ? "bg-white border border-slate-200 shadow-lg rounded-2xl p-8 text-center" : "bg-white/10 border border-white/20 rounded-2xl p-8 text-center"}>
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <p className={isLight ? "text-slate-800 font-semibold text-lg" : "text-white font-semibold text-lg"}>Message envoyé !</p>
        <p className={isLight ? "text-slate-500 text-sm mt-2" : "text-white/60 text-sm mt-2"}>Nous vous répondrons dans les plus brefs délais.</p>
        <button onClick={() => setSent(false)} className={isLight ? "mt-4 text-xs text-slate-500 hover:text-slate-700 transition underline" : "mt-4 text-xs text-white/70 hover:text-white transition underline"}>
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={formCls}>
      {/* Champ piège anti-bot — invisible pour les humains */}
      <div style={{ display: "none" }} aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Nom</label>
          <input className={inputCls} placeholder="Votre nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input className={inputCls} type="email" placeholder="votre@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className={labelCls}>Message</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={5}
          placeholder="Votre message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={1000}
        />
        <p className={counterCls}>{message.length}/1000</p>
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
