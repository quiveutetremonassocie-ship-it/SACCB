"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, CheckCircle2, MapPin, Clock, ArrowUpRight } from "lucide-react";
import { publicContact } from "@/lib/db";
import Shuttlecock from "./Shuttlecock";

type Props = { year: number; onAdmin: () => void };

const NAV = [
  { href: "#presentation", label: "Le club" },
  { href: "#actualites", label: "Actualités" },
  { href: "#horaires", label: "Horaires" },
  { href: "#tournois", label: "Tournois" },
  { href: "#palmares", label: "Palmarès" },
  { href: "#inscription", label: "Adhésion" },
];

const LEGAL = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/cgv", label: "CGV" },
  { href: "/politique-confidentialite", label: "Confidentialité" },
];

export default function Footer({ year, onAdmin }: Props) {
  return (
    <footer
      id="contact"
      className="bg-[color:var(--ink)] text-[color:var(--bone)] relative overflow-hidden"
    >
      {/* Top decorative line */}
      <div className="h-[3px] bg-[color:var(--gold)]" />

      {/* Massive wordmark backdrop */}
      {/* <div className="absolute -bottom-8 left-0 right-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
        <p className="font-display text-[22vw] md:text-[20rem] leading-none tracking-tight text-[color:var(--bone)]/[0.035] whitespace-nowrap text-center">
          SACCB · SACCB · SACCB
        </p>
      </div> */}

      <div className="relative max-w-7xl mx-auto px-6 md:px-10 py-24">
        {/* Contact header */}
        <div className="grid md:grid-cols-12 gap-10 mb-24">
          <div className="md:col-span-6">
            <p
              className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--gold)] font-semibold mb-4 flex items-center gap-3"
              style={{ fontFamily: "Oswald, sans-serif" }}
            >
              <span className="w-6 h-px bg-[color:var(--gold)]/60" />
              07 — Contact
            </p>
            <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-[color:var(--bone)] leading-[0.9]">
              Une question ?<br />
              <span className="font-editorial italic font-normal text-[color:var(--bone)]/85">
                Écrivez-nous.
              </span>
            </h2>
            <p className="mt-6 text-[color:var(--bone)]/65 max-w-md leading-relaxed">
              On répond à tous les messages dans la semaine. Curieux, motivés,
              débutants ou confirmés — bienvenue.
            </p>

            <div className="mt-10 space-y-5">
              <InfoRow
                icon={<MapPin className="w-4 h-4" />}
                label="Gymnase"
                value={
                  <>
                    Salle Paul Vatine
                    <br />
                    30bis Rue Georges Boissaye du Bocage, 76310 Sainte-Adresse
                  </>
                }
              />
              <InfoRow
                icon={<Clock className="w-4 h-4" />}
                label="Créneaux"
                value="Lundi, Jeudi 18h30 · Samedi 17h30"
              />
            </div>
          </div>

          <div className="md:col-span-6 md:pl-8 md:border-l md:border-[color:var(--bone)]/15">
            <ContactForm />
          </div>
        </div>

        {/* Bottom nav grid */}
        <div className="pt-12 border-t border-[color:var(--bone)]/12 grid md:grid-cols-12 gap-10">
          <div className="md:col-span-4">
            <Link href="#" className="inline-flex items-center gap-3 group">
              <span className="w-10 h-10 flex items-center justify-center border border-[color:var(--bone)]/30 group-hover:bg-[color:var(--bone)] transition-colors duration-500">
                <Shuttlecock
                  className="w-5 h-5 text-[color:var(--bone)] group-hover:text-[color:var(--ink)] transition-colors duration-500"
                  color="currentColor"
                />
              </span>
              <span>
                <span className="block font-display text-3xl tracking-[0.1em] text-[color:var(--bone)]">
                  SACCB
                </span>
                <span
                  className="block text-[9px] tracking-[0.3em] uppercase text-[color:var(--bone)]/50 font-semibold mt-0.5"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                >
                  Badminton · Sainte-Adresse
                </span>
              </span>
            </Link>
            <p className="mt-5 text-sm text-[color:var(--bone)]/55 max-w-xs leading-relaxed">
              Association loi 1901. Club affilié FFBaD. Établi à la Salle Paul
              Vatine.
            </p>
          </div>

          <div className="md:col-span-4">
            <p
              className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--bone)]/50 font-semibold mb-5"
              style={{ fontFamily: "Oswald, sans-serif" }}
            >
              Navigation
            </p>
            <ul className="grid grid-cols-2 gap-y-2">
              {NAV.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-sm text-[color:var(--bone)]/75 hover:text-[color:var(--bone)] transition-colors inline-flex items-center gap-2 group"
                  >
                    {l.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <p
              className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--bone)]/50 font-semibold mb-5"
              style={{ fontFamily: "Oswald, sans-serif" }}
            >
              Informations
            </p>
            <ul className="space-y-2">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-[color:var(--bone)]/75 hover:text-[color:var(--bone)] transition-colors inline-flex items-center gap-2 group"
                  >
                    {l.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          className="mt-16 pt-6 border-t border-[color:var(--bone)]/12 flex flex-col md:flex-row flex-wrap items-center justify-center md:justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-[color:var(--bone)]/40 font-semibold"
          style={{ fontFamily: "Oswald, sans-serif" }}
        >
          <p>© {year} · SACCB</p>
          <p className="flex flex-col md:flex-row items-center gap-3">
            <span>Normandie · FR</span>
            {/* <span className="w-px h-3 bg-[color:var(--bone)]/20" /> */}
            <span>Made with ♡ in Sainte-Adresse</span>
          </p>
          {/* Admin hidden access */}
          {/* <button
            onClick={onAdmin}
            className="opacity-100 hover:opacity-30 focus:opacity-30 transition-opacity text-[color:var(--bone)] cursor-default select-none text-[10px]"
            title=""
            tabIndex={-1}
            aria-hidden="true"
          >
            ·
          </button> */}
        </div>
      </div>
    </footer>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-9 h-9 border border-[color:var(--bone)]/25 flex items-center justify-center text-[color:var(--gold)] shrink-0">
        {icon}
      </span>
      <div>
        <p
          className="text-xs uppercase tracking-[0.28em] text-[color:var(--bone)]/50 font-semibold"
          style={{ fontFamily: "Oswald, sans-serif" }}
        >
          {label}
        </p>
        <p className="text-sm text-[color:var(--bone)]/85 mt-1 leading-relaxed">
          {value}
        </p>
      </div>
    </div>
  );
}

function ContactForm() {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [formOpenedAt] = useState(() => Date.now());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) return;
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
      setNom("");
      setEmail("");
      setMessage("");
    } else {
      setError(r.reason || "Erreur lors de l'envoi. Réessayez.");
    }
  }

  if (sent) {
    return (
      <div className="border border-[color:var(--bone)]/20 p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-[color:var(--gold)] mx-auto mb-4" />
        <p className="font-display text-3xl text-[color:var(--bone)] tracking-tight mb-2">
          Message envoyé.
        </p>
        <p className="text-[color:var(--bone)]/60 text-sm">
          Nous vous répondrons dans les plus brefs délais.
        </p>
        <button
          onClick={() => setSent(false)}
          className="mt-5 text-[10px] uppercase tracking-[0.28em] text-[color:var(--bone)]/50 hover:text-[color:var(--bone)] transition-colors font-semibold link-reveal"
          style={{ fontFamily: "Oswald, sans-serif" }}
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      aria-label="Formulaire de contact"
    >
      {/* Honeypot */}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DarkField
          label="Nom"
          value={nom}
          onChange={setNom}
          placeholder="Votre nom"
          required
        />
        <DarkField
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          placeholder="vous@email.fr"
          required
        />
      </div>

      <DarkField
        label="Message"
        value={message}
        onChange={setMessage}
        textarea
        placeholder="Votre message…"
        required
        maxLength={1000}
        hint={`${message.length}/1000`}
      />

      {error && (
        <p
          className="text-sm text-[color:#ff9b8e]"
          style={{ fontFamily: "Oswald, sans-serif" }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-[color:var(--bone)] text-[color:var(--ink)] text-[12px] uppercase font-semibold tracking-[0.24em] hover:bg-[color:var(--gold)] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
        style={{ fontFamily: "Oswald, sans-serif" }}
      >
        <Send className="w-4 h-4" />
        {loading ? "Envoi en cours…" : "Envoyer le message"}
      </button>
    </form>
  );
}

function DarkField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  textarea,
  required,
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
  required?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  const base =
    "w-full bg-transparent border-0 border-b border-[color:var(--bone)]/25 px-0 py-3 text-[color:var(--bone)] placeholder-[color:var(--bone)]/35 focus:outline-none focus:border-[color:var(--gold)] transition-colors";
  return (
    <div>
      <label
        className="block text-[10px] uppercase tracking-[0.28em] text-[color:var(--bone)]/55 font-semibold mb-2"
        style={{ fontFamily: "Oswald, sans-serif" }}
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          className={`${base} resize-none`}
          rows={4}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={maxLength}
        />
      ) : (
        <input
          className={base}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={maxLength}
        />
      )}
      {hint && (
        <p
          className="text-[10px] text-[color:var(--bone)]/30 mt-1 text-right"
          style={{ fontFamily: "Oswald, sans-serif" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
