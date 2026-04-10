"use client";

import { motion } from "framer-motion";
import { Calendar, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { DB } from "@/lib/types";
import { fetchPublicDB } from "@/lib/db";
import { SUPA_KEY, SUPA_URL, SHEETS_WEBHOOK } from "@/lib/supabase";

export default function Tournois({ db }: { db: DB }) {
  const tournois = db.config_tournois ?? [];

  return (
    <section id="tournois" className="section-pad">
      <div className="text-center mb-14">
        <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-3">Compétitions</p>
        <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Tournois à venir</h2>
        <p className="text-white/60 max-w-2xl mx-auto">
          Inscrivez votre binôme aux prochains tournois du club.
        </p>
      </div>

      {tournois.length === 0 ? (
        <div className="glass p-10 text-center text-white/60">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-white/30" />
          Aucun tournoi prévu pour le moment.
        </div>
      ) : (
        <div className="space-y-6">
          {tournois.map((t) => {
            const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
            return <TournoiCard key={t.id} t={t} inscrits={inscrits} />;
          })}
        </div>
      )}
    </section>
  );
}

function TournoiCard({ t, inscrits }: { t: any; inscrits: any[] }) {
  const isFull = !!(t.quota && inscrits.length >= t.quota);
  const [submitting, setSubmitting] = useState(false);

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
      const res = await fetch(`${SUPA_URL}/rest/v1/saccb_db?select=data&id=eq.1`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      });
      const json = await res.json();
      const cur = json[0]?.data ?? {};
      cur.inscrits_tournoi = cur.inscrits_tournoi || [];
      cur.inscrits_tournoi.push({
        id: Date.now().toString(),
        tournoiId: t.id,
        joueurs: `${p1} / ${p2}`,
      });
      await fetch(`${SUPA_URL}/rest/v1/saccb_db?id=eq.1`, {
        method: "PATCH",
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: cur }),
      });
      fetch(SHEETS_WEBHOOK, { method: "POST", mode: "no-cors", body: JSON.stringify(cur) }).catch(
        () => {}
      );
      alert(`✅ Inscription enregistrée pour ${t.name} !`);
      (e.target as HTMLFormElement).reset();
      window.location.reload();
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
      className="glass overflow-hidden"
    >
      <div className="relative p-7 border-l-4 border-emerald-500">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display text-3xl text-white tracking-wider">{t.name}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-white/60">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> {t.date}
              </span>
              {t.type && (
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold uppercase">
                  Double {t.type}
                </span>
              )}
              {t.quota && (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Users className="w-4 h-4" /> {inscrits.length} / {t.quota} doubles
                </span>
              )}
            </div>
          </div>
          {isFull && (
            <span className="px-4 py-2 rounded-full bg-red-500/20 text-red-400 text-sm font-bold uppercase">
              Complet
            </span>
          )}
        </div>

        <div className="bg-black/20 rounded-xl p-4 mb-4">
          <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Binômes inscrits</p>
          {inscrits.length === 0 ? (
            <p className="text-white/40 text-sm">Aucun pour le moment</p>
          ) : (
            <ul className="space-y-1">
              {inscrits.map((i) => (
                <li key={i.id} className="text-sm text-white/80 flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> {i.joueurs}
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isFull && (
          <form onSubmit={regT} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <input className="input" name="p1" placeholder="Joueur 1" required />
              <input className="input" name="p2" placeholder="Joueur 2" required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? "Envoi..." : "S'inscrire"}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
