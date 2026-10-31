"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Users2, MapPin, Clock, CalendarDays, ArrowRight, Newspaper, Award } from "lucide-react";

type Props = {
  seasonY1: number;
  seasonY2: number;
  inscOpen: boolean;
  isMember?: boolean;
  membresCount?: number;
  nextTournoi?: { name: string; date: string } | null;
  horaires?: { jour: string; heure: string }[];
  prixAdulte?: number;
  prixEtudiant?: number;
  salleNom?: string;
  salleAdresse?: string;
  onMember?: () => void;
  // Rubriques désactivées dans l'admin (false) : pas de lien vers elles
  rubriques?: Partial<Record<"actualites" | "horaires" | "tournois", boolean>>;
};

/** 🏸 Accueil v2 : clair et sportif — texte à gauche, photo de la salle à droite, infos pratiques juste en dessous */
export default function AccueilHero({
  seasonY1, seasonY2, inscOpen, isMember = false, membresCount = 0, nextTournoi,
  horaires = [], prixAdulte, prixEtudiant, salleNom, salleAdresse, onMember, rubriques = {},
}: Props) {
  const voir = (r: "actualites" | "horaires" | "tournois") => rubriques[r] !== false;
  const plan = salleAdresse ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([salleNom, salleAdresse].filter(Boolean).join(", "))}` : null;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-[#f8fafc] pt-28 pb-14">
      {/* Lignes de terrain en décor */}
      <svg className="absolute -right-24 top-16 w-[44rem] h-[44rem] text-sky-200/60 pointer-events-none hidden md:block" viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="20" y="20" width="360" height="360" rx="4" />
        <line x1="20" y1="200" x2="380" y2="200" />
        <line x1="200" y1="20" x2="200" y2="380" />
        <rect x="60" y="20" width="280" height="360" />
        <line x1="20" y1="140" x2="380" y2="140" />
        <line x1="20" y1="260" x2="380" y2="260" />
      </svg>

      {/* 🎯 H1 SEO */}
      <h1 className="sr-only">Badminton Sainte-Adresse — SACCB, l&apos;association de badminton de Sainte-Adresse</h1>

      <div className="relative max-w-6xl mx-auto px-5 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        {/* ── Texte ── */}
        <div className="min-w-0 text-center lg:text-left">
          <motion.span
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5 ${inscOpen ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-red-100 text-red-700 border border-red-300"}`}
          >
            <span className={`w-2 h-2 rounded-full ${inscOpen ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            Saison {seasonY1}–{seasonY2} · {inscOpen ? "inscriptions ouvertes" : "inscriptions fermées"}
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
            className="font-display text-[3.4rem] sm:text-7xl lg:text-8xl leading-[0.9] tracking-wide text-[#1e3a5f] mb-4"
          >
            SACCB
            <span className="block text-[2rem] sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-emerald-600">
              Badminton · Sainte&#8209;Adresse
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.12 }}
            className="text-lg text-slate-600 max-w-lg mx-auto lg:mx-0 mb-7"
          >
            Une association conviviale pour jouer au badminton à tous les niveaux, se retrouver entre amis et participer à des tournois toute l&apos;année.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-7"
          >
            {inscOpen && !isMember && (
              <a href="/inscription" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e] shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 transition">
                <Trophy className="w-5 h-5" /> Adhérer au club
              </a>
            )}
            {onMember && (
              <button onClick={onMember} className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold transition hover:-translate-y-0.5 ${inscOpen && !isMember ? "text-[#1e3a5f] bg-white border-2 border-[#1e3a5f]/15" : "text-white bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e] shadow-lg"}`}>
                <Users2 className="w-5 h-5" /> {isMember ? "Mon espace adhérent" : "Espace adhérent"}
              </button>
            )}
            {voir("horaires") && (
              <a href="#horaires" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-slate-600 hover:text-[#1e3a5f]">
                Horaires &amp; tarifs <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </motion.div>

          <div className="flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-slate-500">
            {membresCount > 0 && <span className="flex items-center gap-1.5"><Users2 className="w-4 h-4 text-emerald-500" /> <strong className="text-slate-700">{membresCount}</strong> adhérents</span>}
            <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-amber-500" /> Tous niveaux</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-sky-500" /> {salleNom || "Sainte-Adresse"}</span>
          </div>
        </div>

        {/* ── Photo + cartes flottantes ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
          className="relative min-w-0 mx-auto w-full max-w-lg"
        >
          <div className="rounded-[2rem] overflow-hidden shadow-2xl shadow-sky-900/20 rotate-1 border-[6px] border-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/salle.png" alt="Salle Paul Vatine — Sainte-Adresse" className="w-full h-72 sm:h-96 object-cover" />
          </div>
          {nextTournoi && voir("tournois") && <ProchainTournoi name={nextTournoi.name} dateStr={nextTournoi.date} />}
          {(prixAdulte !== undefined || prixEtudiant !== undefined) && (
            <div className="absolute -bottom-5 right-3 sm:-right-4 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-100">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Adhésion / an</p>
              <p className="text-sm font-bold text-[#1e3a5f]">
                {prixAdulte !== undefined && <>{prixAdulte} € <span className="font-normal text-slate-500">adulte</span></>}
                {prixAdulte !== undefined && prixEtudiant !== undefined && <span className="text-slate-300"> · </span>}
                {prixEtudiant !== undefined && <>{prixEtudiant} € <span className="font-normal text-slate-500">étudiant</span></>}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Infos pratiques ── */}
      <div className={`relative max-w-6xl mx-auto px-5 mt-16 grid gap-4 ${voir("actualites") || voir("tournois") ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <Info icone={<Clock className="w-5 h-5" />} couleur="from-sky-500 to-blue-600" titre="Quand on joue">
          {horaires.length > 0 ? (
            <ul className="space-y-0.5">
              {horaires.map((h, i) => <li key={i} className="flex justify-between gap-2"><span className="font-semibold text-slate-700">{h.jour}</span><span>{h.heure}</span></li>)}
            </ul>
          ) : <p>Voir les horaires plus bas.</p>}
        </Info>
        <Info icone={<MapPin className="w-5 h-5" />} couleur="from-emerald-500 to-teal-600" titre="Où">
          <p className="font-semibold text-slate-700">{salleNom}</p>
          {salleAdresse && <p>{salleAdresse}</p>}
          {plan && <a href={plan} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 font-semibold text-emerald-700 hover:underline">Itinéraire →</a>}
        </Info>
        {(voir("actualites") || voir("tournois")) && (
          <Info icone={<Newspaper className="w-5 h-5" />} couleur="from-amber-500 to-orange-500" titre="La vie du club">
            <p>{voir("actualites") && voir("tournois") ? "Actualités et tournois : tout est sur le site." : voir("actualites") ? "Les dernières nouvelles du club sont sur le site." : "Les prochains tournois sont sur le site."}</p>
            <div className="flex gap-3 mt-1 font-semibold">
              {voir("actualites") && <a href="/actualites" className="text-amber-700 hover:underline">Actualités →</a>}
              {voir("tournois") && <a href="/tournois" className="text-amber-700 hover:underline">Tournois →</a>}
            </div>
          </Info>
        )}
      </div>
    </section>
  );
}

function Info({ icone, couleur, titre, children }: { icone: React.ReactNode; couleur: string; titre: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-sm text-slate-500">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${couleur} text-white flex items-center justify-center`}>{icone}</span>
        <p className="font-bold text-slate-800">{titre}</p>
      </div>
      {children}
    </div>
  );
}

/** Carte flottante « prochain tournoi » avec compte à rebours */
function ProchainTournoi({ name, dateStr }: { name: string; dateStr: string }) {
  const [jours, setJours] = useState<number | null>(null);
  useEffect(() => {
    const iso = /^\d{4}-\d{2}-\d{2}/.test(dateStr) ? dateStr.slice(0, 10) : (() => {
      const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
    })();
    if (!iso) return;
    const diff = Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86_400_000);
    setJours(diff);
  }, [dateStr]);
  if (jours !== null && jours < 0) return null;
  return (
    <a href="/tournois" className="absolute -top-5 left-3 sm:-left-6 max-w-[16rem] bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-100 hover:-translate-y-0.5 transition">
      <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Prochain tournoi</p>
      <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
      {jours !== null && <p className="text-xs text-slate-500">{jours === 0 ? "aujourd'hui !" : `dans ${jours} jour${jours > 1 ? "s" : ""}`}</p>}
    </a>
  );
}
