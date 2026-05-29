"use client";

import { motion } from "framer-motion";
import { Calendar, Trophy, Users, Lock, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, CalendarPlus, Car, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { DB, Tournoi, InscritTournoi, SeasonArchive } from "@/lib/types";
import { publicRegisterTournoiWithCovoiturage } from "@/lib/db";
import { MemberSession } from "@/lib/useMemberSession";
import { MiniCalendarBadge } from "./MiniCalendar";
import TiltCard from "./TiltCard";

const today = new Date().toISOString().slice(0, 10);

function parseTournoiDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // Format ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Autre format : tentative de parsing natif
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function isTermine(t: Tournoi) {
  const parsed = parseTournoiDate(t.date);
  // Si la date est parsable, comparer avec aujourd'hui
  if (parsed) return parsed < today;
  // Date en texte libre non parsable → on ne sait pas, on considère "à venir" par défaut
  return false;
}

export default function Tournois({
  db,
  memberSession,
  onLoginRequest,
  membreNoms = [],
  readOnly = false,
}: {
  db: DB;
  memberSession: MemberSession | null;
  onLoginRequest: () => void;
  membreNoms?: string[];
  readOnly?: boolean;
}) {
  const tournois = db.config_tournois ?? [];
  const upcoming = tournois.filter((t) => !isTermine(t));
  const done = tournois.filter((t) => isTermine(t));
  const archives = db.archives ?? [];

  const hasPast = done.length > 0 || archives.length > 0;
  const [tab, setTab] = useState<"avenir" | "passes">("avenir");
  const [openArchive, setOpenArchive] = useState<string | null>(null);

  return (
    <section id="tournois" className="bg-section-wrap bg-tournament relative">
      <div className="section-pad relative">
        <div className="text-center mb-10">
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-amber-600">Compétitions</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Tournois</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Inscrivez votre binôme aux prochains tournois de l’association.
          </p>
        </div>

        {/* ── Onglets ── */}
        {hasPast && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-2xl bg-slate-100 p-1 gap-1">
              <button
                onClick={() => setTab("avenir")}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                  tab === "avenir"
                    ? "bg-white text-slate-800 shadow"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  À venir {upcoming.length > 0 && <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full">{upcoming.length}</span>}
                </span>
              </button>
              <button
                onClick={() => setTab("passes")}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                  tab === "passes"
                    ? "bg-white text-slate-800 shadow"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Passés {done.length > 0 && <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{done.length}</span>}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Tournois à venir ── */}
        {tab === "avenir" && (
          <>
            {upcoming.length === 0 ? (
              <div className="glass-sport p-10 text-center text-slate-400">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                Aucun tournoi à venir pour le moment.
              </div>
            ) : (
              <div className="space-y-6">
                {upcoming.map((t) => {
                  const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                  return (
                    <TiltCard key={t.id}><TournoiCard t={t} inscrits={inscrits} memberSession={memberSession} onLoginRequest={onLoginRequest} membreNoms={membreNoms} readOnly={readOnly} /></TiltCard>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tournois passés ── */}
        {tab === "passes" && (
          <>
            {done.length > 0 && (
              <div className="space-y-4 mb-8">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1 mb-3">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Saison en cours
                </p>
                {done.map((t) => {
                  const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                  return <TournoiTermineCard key={t.id} t={t} inscrits={inscrits} memberSession={memberSession} onLoginRequest={onLoginRequest} />;
                })}
              </div>
            )}
          </>
        )}

        {/* ── Saisons précédentes (dans onglet Passés) ── */}
        {tab === "passes" && archives.length > 0 && (
          <div className="mt-6">
            {done.length > 0 && <div className="border-t border-slate-200 mb-6" />}
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold flex items-center gap-1 mb-3">
              <Trophy className="w-3.5 h-3.5 text-amber-500" /> Saisons précédentes
            </p>
            <div className="space-y-3">
              {[...archives].reverse().map((archive) => {
                const key = `${archive.y1}-${archive.y2}`;
                const isOpen = openArchive === key;
                const hasTournois = (archive.config_tournois ?? []).length > 0;
                const hasResults = (archive.inscrits_tournoi ?? []).some((i) => i.resultat);
                return (
                  <div key={key} className="glass rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setOpenArchive(isOpen ? null : key)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-display text-xl text-slate-700 tracking-wider">Saison {archive.y1}–{archive.y2}</span>
                        <span className="text-xs text-slate-400">{hasTournois ? `${archive.config_tournois.length} tournoi${archive.config_tournois.length > 1 ? "s" : ""}` : "Aucun tournoi"}</span>
                        {hasResults && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🏅 Classements disponibles</span>}
                      </div>
                      {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 border-t border-slate-100">
                        {!memberSession ? (
                          <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
                            <Lock className="w-8 h-8 text-slate-300" />
                            <p className="text-slate-500 text-sm">Connectez-vous pour voir les détails de cette saison.</p>
                            <button onClick={onLoginRequest} className="btn-primary !px-5 !py-2 !text-sm">Se connecter</button>
                          </div>
                        ) : (
                          <>
                            {hasTournois && (
                              <div className="mt-4 space-y-3">
                                {archive.config_tournois.map((t) => {
                                  const inscrits = (archive.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                                  return <TournoiTermineCard key={t.id} t={t} inscrits={inscrits} memberSession={memberSession} onLoginRequest={onLoginRequest} />;
                                })}
                              </div>
                            )}
                            {!hasTournois && <p className="text-slate-400 text-sm mt-4">Aucun tournoi enregistré pour cette saison.</p>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Carte tournoi terminé ──────────────────────────────────────
function TournoiTermineCard({ t, inscrits, memberSession, onLoginRequest }: {
  t: Tournoi; inscrits: InscritTournoi[];
  memberSession: MemberSession | null;
  onLoginRequest: () => void;
}) {
  const withResults = inscrits.filter((i) => i.resultat).sort((a, b) => {
    const ra = parseInt(a.resultat?.split("/")[0] ?? "99");
    const rb = parseInt(b.resultat?.split("/")[0] ?? "99");
    return ra - rb;
  });

  return (
    <div className="glass-sport overflow-hidden opacity-80">
      <div className="relative p-5 border-l-4 border-slate-300">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl text-slate-600 tracking-wider">{t.name}</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Terminé
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-400">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {t.date}</span>
              {t.type && <span className="text-xs">Double {t.type}</span>}
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {inscrits.length} binôme{inscrits.length > 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
        {!memberSession ? (
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <span className="text-sm text-slate-400 flex items-center gap-2"><Lock className="w-4 h-4" /> Résultats réservés aux membres</span>
            <button onClick={onLoginRequest} className="text-xs text-blue-600 hover:underline font-semibold">Se connecter</button>
          </div>
        ) : withResults.length > 0 ? (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Classement</p>
            <div className="space-y-1">
              {withResults.map((i) => {
                const rank = parseInt(i.resultat!.split("/")[0]);
                return (
                  <div key={i.id} className="flex items-center gap-2 text-sm">
                    <span>{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`}</span>
                    <span className="text-slate-700">{i.joueurs}</span>
                    <span className="text-slate-400 text-xs ml-auto">{i.resultat}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : inscrits.length > 0 ? (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Participants</p>
            <div className="space-y-1">
              {inscrits.map((i) => (
                <p key={i.id} className="text-sm text-slate-600">• {i.joueurs}</p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


// ── Carte tournoi à venir ──────────────────────────────────────
function getDaysLeft(dateLimit: string | null | undefined): number | null {
  if (!dateLimit) return null;
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
  if (days < 0) return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold"><Lock className="w-3 h-3" /> Inscriptions closes</span>;
  if (days === 0) return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold animate-pulse"><AlertCircle className="w-3 h-3" /> Dernier jour !</span>;
  if (days <= 3) return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold"><Clock className="w-3 h-3" /> Plus que {days} jour{days > 1 ? "s" : ""} !</span>;
  if (days <= 7) return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold"><Clock className="w-3 h-3" /> {days} jours restants</span>;
  if (days <= 14) return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 text-xs font-semibold"><Clock className="w-3 h-3" /> {days} jours restants</span>;
  return null;
}

// 📅 Helpers pour le download d'un fichier iCal (.ics) ajoutable dans tout agenda
function parseFreeDate(input: string): Date | null {
  if (!input) return null;
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const months: Record<string, number> = {
    janvier: 0, fevrier: 1, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, aout: 7, août: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, décembre: 11,
  };
  const m = s.toLowerCase().match(/(\d{1,2})(?:er|e|ème)?\s+([a-zéû]+)\s+(\d{4})/i);
  if (m) {
    const day = parseInt(m[1]);
    const month = months[m[2]];
    const year = parseInt(m[3]);
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }
  return null;
}

function downloadIcs(t: Tournoi) {
  const startDate = parseFreeDate(t.date);
  if (!startDate) {
    alert("La date du tournoi est dans un format non reconnu, impossible de l'ajouter au calendrier.");
    return;
  }
  // Si on peut extraire une heure dans le champ date (ex: "31 mai 2026 (8:30)" ou "...8h30"), on l'utilise
  const hourMatch = t.date.match(/(\d{1,2})[h:](\d{2})/);
  if (hourMatch) {
    startDate.setHours(parseInt(hourMatch[1]), parseInt(hourMatch[2]));
  } else {
    startDate.setHours(9, 0); // défaut 9h
  }
  // Fin = +6h par défaut (tournoi typique)
  const endDate = new Date(startDate.getTime() + 6 * 60 * 60 * 1000);

  function fmt(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  }
  function escapeIcs(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  const uid = `tournoi-${t.id}@saccb.fr`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SACCB//Tournoi//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(startDate)}`,
    `DTEND:${fmt(endDate)}`,
    `SUMMARY:🏸 ${escapeIcs(t.name)}`,
    `DESCRIPTION:${escapeIcs(`Tournoi de badminton SACCB${t.type ? ` (Double ${t.type})` : ""}. Plus d'infos sur https://saccb.fr/#tournois`)}`,
    "LOCATION:Sainte-Adresse",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `tournoi-${t.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function TournoiCard({ t, inscrits, memberSession, onLoginRequest, membreNoms = [], readOnly = false }: {
  t: Tournoi; inscrits: InscritTournoi[]; memberSession: MemberSession | null; onLoginRequest: () => void; membreNoms?: string[]; readOnly?: boolean;
}) {
  const isFull = !!(t.quota && inscrits.length >= t.quota);
  const [submitting, setSubmitting] = useState(false);
  const [showCovoiturage, setShowCovoiturage] = useState(false);
  const [covoSeats, setCovoSeats] = useState("");
  const [covoDepart, setCovoDepart] = useState("");
  const [covoContact, setCovoContact] = useState("");
  const daysLeft = getDaysLeft(t.dateLimit);
  const inscriptionsClosed = t.closed === true || (daysLeft !== null && daysLeft < 0);

  // Offres de covoiturage pour ce tournoi
  const covoiturageOffers = inscrits.filter((i) => i.covoiturage && i.covoiturage.seats > 0);

  async function regT(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!memberSession) return;
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("p1") || "").trim();
    const p2 = String(fd.get("p2") || "").trim();
    if (!p1 || !p2) { setSubmitting(false); return; }
    const code = memberSession.adminCode || sessionStorage.getItem("saccb_member_code") || "";
    if (!code) {
      alert("Vous devez etre connecte a votre espace membre pour vous inscrire a un tournoi.");
      setSubmitting(false);
      return;
    }
    const covo = showCovoiturage && covoSeats && parseInt(covoSeats) > 0
      ? { seats: parseInt(covoSeats), depart: covoDepart || undefined, contact: covoContact || undefined }
      : null;
    try {
      const r = await publicRegisterTournoiWithCovoiturage(t.id, p1, p2, memberSession.email, code, covo);
      if (r.ok) { alert(`Inscription enregistree pour ${t.name} !`); (e.target as HTMLFormElement).reset(); window.location.reload(); }
      else alert(r.reason || "Erreur.");
    } finally { setSubmitting(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className={`glass-sport overflow-hidden ${inscriptionsClosed ? "opacity-75" : ""}`}>
      <div className={`relative p-7 border-l-4 ${inscriptionsClosed ? "border-red-400" : "border-emerald-500"}`}>
        <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl ${inscriptionsClosed ? "from-red-100/40" : "from-emerald-100/40"} to-transparent rounded-full blur-2xl pointer-events-none`} />
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex gap-4 items-start">
            {/* Mini calendrier */}
            <MiniCalendarBadge dateStr={t.date} />
            <div>
              <h3 className="font-display text-3xl text-slate-800 tracking-wider">{t.name}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {t.date}</span>
                {t.type && <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${inscriptionsClosed ? "bg-red-50 text-red-400" : "bg-blue-100 text-blue-700"}`}>Double {t.type}</span>}
                {t.quota && <span className={`flex items-center gap-1.5 ${inscriptionsClosed ? "text-red-400" : "text-emerald-600"}`}><Users className="w-4 h-4" /> {inscrits.length} / {t.quota} doubles</span>}
              </div>
              {t.dateLimit && !inscriptionsClosed && <div className="mt-3"><CountdownBadge dateLimit={t.dateLimit} /></div>}
              <button
                onClick={() => downloadIcs(t)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition"
                title="Telecharge un fichier .ics a ouvrir avec Google Calendar / iPhone / Outlook"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Ajouter a mon agenda
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isFull && <span className="px-4 py-2 rounded-full bg-red-100 text-red-600 text-sm font-bold uppercase">Complet</span>}
            {!isFull && inscriptionsClosed && <span className="px-4 py-2 rounded-full bg-red-100 text-red-600 text-sm font-bold uppercase flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Inscriptions fermees</span>}
            {!isFull && !inscriptionsClosed && <span className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold uppercase flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Inscriptions ouvertes</span>}
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
          {memberSession ? (
            <>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Binômes inscrits</p>
              {inscrits.length === 0 ? <p className="text-slate-400 text-sm">Aucun pour le moment</p> : (
                <ul className="space-y-1">
                  {inscrits.map((i) => <li key={i.id} className="text-sm text-slate-600 flex items-center gap-2"><span className="text-emerald-500">✓</span> {i.joueurs}</li>)}
                </ul>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                {isFull
                  ? <strong className="text-red-500">Complet</strong>
                  : t.quota
                  ? <>{inscrits.length} / {t.quota} places prises</>
                  : <>{inscrits.length} binôme{inscrits.length > 1 ? "s" : ""} inscrit{inscrits.length > 1 ? "s" : ""}</>
                }
                {" — "}liste réservée aux membres
              </span>
            </div>
          )}
        </div>
        {/* Offres de covoiturage */}
        {memberSession && covoiturageOffers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold mb-2 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" /> Covoiturage ({covoiturageOffers.length} offre{covoiturageOffers.length > 1 ? "s" : ""})
            </p>
            <div className="space-y-2">
              {covoiturageOffers.map((i) => (
                <div key={i.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 text-sm border border-blue-100">
                  <span className="text-blue-600 font-bold shrink-0">{i.covoiturage!.seats} place{i.covoiturage!.seats > 1 ? "s" : ""}</span>
                  <span className="text-slate-600 truncate">{i.joueurs}</span>
                  {i.covoiturage!.depart && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                      <MapPin className="w-3 h-3" /> {i.covoiturage!.depart}
                    </span>
                  )}
                  {i.covoiturage!.contact && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                      <Phone className="w-3 h-3" /> {i.covoiturage!.contact}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {inscriptionsClosed ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 text-sm">
              💬 <strong>Vous souhaitez participer à ce tournoi ?</strong> Contactez <strong>Hernan</strong> ou un membre du bureau — il est peut-être encore possible de vous inscrire.
            </p>
          </div>
        ) : !isFull && (
          readOnly ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <p className="text-emerald-700 text-sm font-medium">Les inscriptions se font depuis l&apos;espace membre sur <strong>saccb.fr</strong></p>
            </div>
          ) : memberSession && memberSession.paid === true ? (
            <form onSubmit={regT} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  className="input"
                  name="p1"
                  placeholder="Joueur 1 (votre nom)"
                  list={`members-list-${t.id}`}
                  defaultValue={memberSession.nom || ""}
                  required
                  autoComplete="off"
                />
                <input
                  className="input"
                  name="p2"
                  placeholder="Joueur 2 (partenaire)"
                  list={`members-list-${t.id}`}
                  required
                  autoComplete="off"
                />
              </div>
              {/* Datalist pour autocomplétion : permet de sélectionner un adhérent existant */}
              <datalist id={`members-list-${t.id}`}>
                {membreNoms.map((nom) => (
                  <option key={nom} value={nom} />
                ))}
              </datalist>
              <p className="text-xs text-slate-400">
                Commencez a taper le prenom pour voir la liste des adherents et eviter les fautes de frappe.
              </p>
              {/* Covoiturage */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCovoiturage}
                    onChange={(e) => setShowCovoiturage(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Car className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Je propose des places en covoiturage</span>
                </label>
                {showCovoiturage && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-500 block mb-1">Places</label>
                        <input
                          className="input !text-sm"
                          type="number"
                          min="1"
                          max="7"
                          value={covoSeats}
                          onChange={(e) => setCovoSeats(e.target.value)}
                          placeholder="2"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-500 block mb-1">Depart depuis</label>
                        <input
                          className="input !text-sm"
                          value={covoDepart}
                          onChange={(e) => setCovoDepart(e.target.value)}
                          placeholder="Sainte-Adresse"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Contact (optionnel)</label>
                      <input
                        className="input !text-sm"
                        value={covoContact}
                        onChange={(e) => setCovoContact(e.target.value)}
                        placeholder="Tel ou via WhatsApp"
                      />
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? "Envoi..." : "S'inscrire"}</button>
            </form>
          ) : memberSession && memberSession.paid !== true ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-semibold text-sm mb-1">Adhésion à finaliser pour s'inscrire</p>
                  <p className="text-amber-700 text-xs">
                    Renouvelez votre adhésion saison en cours pour pouvoir vous inscrire aux tournois. Rendez-vous dans votre espace membre.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <Lock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-slate-600 text-sm mb-3">Réservé aux adhérents. Connectez-vous à votre espace membre.</p>
              <button onClick={onLoginRequest} className="btn-primary !px-5 !py-2">Se connecter</button>
            </div>
          )
        )}
      </div>
    </motion.div>
  );
}
