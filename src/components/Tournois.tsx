"use client";

import { motion } from "framer-motion";
import { Calendar, Trophy, Users, Lock, Clock, AlertCircle } from "lucide-react";
import { useState } from "react";
import { DB, Tournoi, InscritTournoi } from "@/lib/types";
import { publicRegisterTournoi } from "@/lib/db";
import { MemberSession } from "@/lib/useMemberSession";

export default function Tournois({
  db,
  memberSession,
  onLoginRequest,
}: {
  db: DB;
  memberSession: MemberSession | null;
  onLoginRequest: () => void;
}) {
  const tournois = db.config_tournois ?? [];

  return (
    <section id="tournois" className="bg-section-wrap bg-tournament relative">
      <div className="section-pad relative">
      <div className="text-center mb-14">
        <div className="sport-label mb-5">
          <span className="sport-label-dot" />
          <span className="sport-label-text text-amber-600">Compétitions</span>
        </div>
        <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Tournois à venir</h2>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Inscrivez votre binôme aux prochains tournois du club.
        </p>
      </div>

      {tournois.length === 0 ? (
        <div className="glass-sport p-10 text-center text-slate-400">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          Aucun tournoi prévu pour le moment.
        </div>
      ) : (
        <div className="space-y-6">
          {tournois.map((t) => {
            const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
            return (
              <TournoiCard
                key={t.id}
                t={t}
                inscrits={inscrits}
                memberSession={memberSession}
                onLoginRequest={onLoginRequest}
              />
            );
          })}
        </div>
      )}
      </div>
    </section>
  );
}

function getDaysLeft(dateLimit: string | null | undefined): number | null {
  if (!dateLimit) return null;
  // Supporte DD/MM/YYYY et YYYY-MM-DD
  let date: Date;
  if (dateLimit.includes("/")) {
    const [d, m, y] = dateLimit.split("/");
    date = new Date(`${y}-${m}-${d}`);
  } else {
    date = new Date(dateLimit);
  }
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function CountdownBadge({ dateLimit }: { dateLimit?: string | null }) {
  const days = getDaysLeft(dateLimit);
  if (days === null) return null;

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
        <Lock className="w-3 h-3" /> Inscriptions closes
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold animate-pulse">
        <AlertCircle className="w-3 h-3" /> Dernier jour !
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold">
        <Clock className="w-3 h-3" /> Plus que {days} jour{days > 1 ? "s" : ""} pour s&apos;inscrire !
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
        <Clock className="w-3 h-3" /> Dépêchez-vous, il reste {days} jours pour s&apos;inscrire !
      </span>
    );
  }
  if (days <= 14) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 text-xs font-semibold">
        <Clock className="w-3 h-3" /> {days} jours restants pour s&apos;inscrire
      </span>
    );
  }
  return null;
}

function TournoiCard({
  t,
  inscrits,
  memberSession,
  onLoginRequest,
}: {
  t: Tournoi;
  inscrits: InscritTournoi[];
  memberSession: MemberSession | null;
  onLoginRequest: () => void;
}) {
  const isFull = !!(t.quota && inscrits.length >= t.quota);
  const [submitting, setSubmitting] = useState(false);

  const daysLeft = getDaysLeft(t.dateLimit);
  const inscriptionsClosed = daysLeft !== null && daysLeft < 0;

  async function regT(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("p1") || "").trim();
    const p2 = String(fd.get("p2") || "").trim();
    if (!p1 || !p2) {
      setSubmitting(false);
      return;
    }
    try {
      const r = await publicRegisterTournoi(t.id, p1, p2);
      if (r.ok) {
        alert(`Inscription enregistrée pour ${t.name} !`);
        (e.target as HTMLFormElement).reset();
        window.location.reload();
      } else {
        alert(r.reason || "Erreur lors de l'inscription.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass-sport overflow-hidden"
    >
      <div className="relative p-7 border-l-4 border-emerald-500">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-100/40 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display text-3xl text-slate-800 tracking-wider">{t.name}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {t.date}
              </span>
              {t.type && (
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold uppercase">
                  Double {t.type}
                </span>
              )}
              {t.quota && (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <Users className="w-4 h-4" /> {inscrits.length} / {t.quota} doubles
                </span>
              )}
            </div>
            {/* Compte à rebours */}
            {t.dateLimit && (
              <div className="mt-3">
                <CountdownBadge dateLimit={t.dateLimit} />
              </div>
            )}
          </div>
          {isFull && (
            <span className="px-4 py-2 rounded-full bg-red-100 text-red-600 text-sm font-bold uppercase">
              Complet
            </span>
          )}
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Binômes inscrits</p>
          {inscrits.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucun pour le moment</p>
          ) : (
            <ul className="space-y-1">
              {inscrits.map((i) => (
                <li key={i.id} className="text-sm text-slate-600 flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> {i.joueurs}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Zone d'inscription : réservée aux membres */}
        {!isFull && !inscriptionsClosed && (
          memberSession ? (
            <form onSubmit={regT} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="input" name="p1" placeholder="Joueur 1" required />
                <input className="input" name="p2" placeholder="Joueur 2" required />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? "Envoi..." : "S'inscrire"}
              </button>
            </form>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <Lock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-slate-600 text-sm mb-3">
                Réservé aux adhérents. Connectez-vous à votre espace membre pour vous inscrire.
              </p>
              <button onClick={onLoginRequest} className="btn-primary !px-5 !py-2">
                Se connecter
              </button>
            </div>
          )
        )}
      </div>
    </motion.div>
  );
}
