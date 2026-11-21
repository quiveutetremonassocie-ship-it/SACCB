"use client";

import { ChevronDown, ChevronUp, CalendarPlus, Car, MapPin, Phone, BellOff, Bell, Lock } from "lucide-react";
import { useState } from "react";
import { DB, Tournoi, InscritTournoi, joueursCourts } from "@/lib/types";
import { publicRegisterTournoiWithCovoiturage, memberToggleTournoiIgnored } from "@/lib/db";
import { MemberSession } from "@/lib/useMemberSession";

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

// Clé de tri chronologique (dates en texte libre "25 mai 2026" comprises) ; date illisible → à la fin
function tournoiTime(t: Tournoi): number {
  const d = parseFreeDate(t.date);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}

function isTermine(t: Tournoi) {
  const free = parseFreeDate(t.date);
  const parsed = free ? `${free.getFullYear()}-${String(free.getMonth() + 1).padStart(2, "0")}-${String(free.getDate()).padStart(2, "0")}` : parseTournoiDate(t.date);
  // Si la date est parsable, comparer avec aujourd'hui
  if (parsed) return parsed < today;
  // Date en texte libre non parsable → on ne sait pas, on considère "à venir" par défaut
  return false;
}


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


/** Jour et mois courts d'un tournoi pour la colonne date (« 28 » / « nov. ») */
function jourEtMois(t: Tournoi): { jour: string; mois: string } {
  const d = parseFreeDate(t.date);
  if (!d) return { jour: "?", mois: "" };
  const jour = d.getDate() === 1 ? "1er" : String(d.getDate());
  return { jour, mois: d.toLocaleDateString("fr-FR", { month: "short" }) };
}

/** Date limite lisible : « 28 novembre » */
function limiteLisible(dateLimit?: string | null): string {
  if (!dateLimit) return "";
  const d = parseFreeDate(dateLimit);
  if (!d) return dateLimit;
  return d.getDate() === 1
    ? `1er ${d.toLocaleDateString("fr-FR", { month: "long" })}`
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
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
  // 📅 À venir : le plus proche en premier · Passés : le plus récent en premier
  const upcoming = tournois.filter((t) => !isTermine(t)).sort((a, b) => tournoiTime(a) - tournoiTime(b));
  const done = tournois.filter((t) => isTermine(t)).sort((a, b) => tournoiTime(b) - tournoiTime(a));
  const archives = db.archives ?? [];

  const hasPast = done.length > 0 || archives.length > 0;
  const [tab, setTab] = useState<"avenir" | "passes">("avenir");
  const [openArchive, setOpenArchive] = useState<string | null>(null);

  return (
    <section id="tournois" className="bg-[#F2F6F9] scroll-mt-20" aria-labelledby="titre-tournois">
      <div className="max-w-6xl mx-auto px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-6">
          <h2 id="titre-tournois" className="font-display text-4xl md:text-5xl text-[#0F1B26] leading-[0.95]">
            {tab === "avenir" ? "Les prochains tournois" : "Les tournois passés"}
          </h2>
          {hasPast && (
            <button
              onClick={() => setTab(tab === "avenir" ? "passes" : "avenir")}
              className="font-bold text-[#007DB0] underline underline-offset-4 min-h-[48px] inline-flex items-center"
            >
              {tab === "avenir" ? "Voir les tournois passés et le palmarès" : `Voir les tournois à venir${upcoming.length ? ` (${upcoming.length})` : ""}`}
            </button>
          )}
        </div>

        {/* ── Tournois à venir : feuille de matchs ── */}
        {tab === "avenir" && (
          upcoming.length === 0 ? (
            <div className="border-t-[3px] border-[#0F1B26] py-10 text-slate-600 text-lg">
              Aucun tournoi à venir pour le moment. Les prochains seront annoncés ici et par mail.
            </div>
          ) : (
            <div className="border-t-[3px] border-[#0F1B26]">
              {upcoming.map((t) => {
                const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                return <TournoiLigne key={t.id} t={t} inscrits={inscrits} memberSession={memberSession} onLoginRequest={onLoginRequest} membreNoms={membreNoms} readOnly={readOnly} />;
              })}
            </div>
          )
        )}

        {/* ── Tournois passés (saison en cours) ── */}
        {tab === "passes" && done.length > 0 && (
          <div className="border-t-[3px] border-[#0F1B26]">
            {done.map((t) => {
              const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
              return <TournoiTermineLigne key={t.id} t={t} inscrits={inscrits} memberSession={memberSession} onLoginRequest={onLoginRequest} />;
            })}
          </div>
        )}

        {/* ── Saisons précédentes ── */}
        {tab === "passes" && archives.length > 0 && (
          <div className="mt-10">
            <h3 className="font-display text-3xl text-[#0F1B26] mb-3">Saisons précédentes</h3>
            <div className="border-t-2 border-[#0F1B26]">
              {[...archives].reverse().map((archive) => {
                const key = `${archive.y1}-${archive.y2}`;
                const isOpen = openArchive === key;
                const nb = (archive.config_tournois ?? []).length;
                const hasResults = (archive.inscrits_tournoi ?? []).some((i) => i.resultat);
                return (
                  <div key={key} className="border-b border-[#D3DEE6]">
                    <button
                      onClick={() => setOpenArchive(isOpen ? null : key)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-3 py-4 min-h-[56px] text-left hover:text-[#007DB0]"
                    >
                      <span className="flex flex-wrap items-baseline gap-x-3">
                        <span className="font-display font-bold text-2xl">Saison {archive.y1}-{archive.y2}</span>
                        <span className="text-slate-600">{nb ? `${nb} tournoi${nb > 1 ? "s" : ""}` : "Aucun tournoi"}{hasResults ? ", classements disponibles" : ""}</span>
                      </span>
                      {isOpen ? <ChevronUp className="w-5 h-5 shrink-0" /> : <ChevronDown className="w-5 h-5 shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="pb-5">
                        {!memberSession ? (
                          <p className="text-slate-600 flex flex-wrap items-center gap-3">
                            Les détails des saisons passées sont réservés aux adhérents.
                            <button onClick={onLoginRequest} className="btn-primary">Se connecter</button>
                          </p>
                        ) : nb ? (
                          <div className="border-t border-[#D3DEE6]">
                            {archive.config_tournois.map((t) => {
                              const inscrits = (archive.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                              return <TournoiTermineLigne key={t.id} t={t} inscrits={inscrits} memberSession={memberSession} onLoginRequest={onLoginRequest} />;
                            })}
                          </div>
                        ) : (
                          <p className="text-slate-600">Aucun tournoi enregistré pour cette saison.</p>
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

/** Liste des binômes inscrits (noms courts « Prénom N. ») */
function ListeBinomes({ inscrits, avecResultat = false }: { inscrits: InscritTournoi[]; avecResultat?: boolean }) {
  return (
    <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">
      {inscrits.map((i) => (
        <li key={i.id} className="flex items-baseline gap-2 text-slate-700">
          <span className="text-[#157A55] font-bold" aria-hidden="true">✓</span>
          <span>{joueursCourts(i.joueurs)}</span>
          {avecResultat && i.resultat && <span className="ml-auto text-slate-500 tabular-nums">{i.resultat}</span>}
        </li>
      ))}
    </ul>
  );
}

// ── Ligne d'un tournoi terminé (classement) ──────────────────────
function TournoiTermineLigne({ t, inscrits, memberSession, onLoginRequest }: {
  t: Tournoi; inscrits: InscritTournoi[];
  memberSession: MemberSession | null;
  onLoginRequest: () => void;
}) {
  const { jour, mois } = jourEtMois(t);
  const classement = inscrits.filter((i) => i.resultat).sort((a, b) => {
    const ra = parseInt(a.resultat?.split("/")[0] ?? "99");
    const rb = parseInt(b.resultat?.split("/")[0] ?? "99");
    return ra - rb;
  });

  return (
    <article className="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[5.5rem_1fr] gap-x-4 py-5 border-b border-[#D3DEE6]">
      <div className="font-display leading-[0.9] text-slate-500">
        <span className="block text-4xl sm:text-5xl font-extrabold">{jour}</span>
        <span className="text-lg font-bold">{mois}</span>
      </div>
      <div className="min-w-0">
        <h3 className="font-bold text-lg leading-snug">{t.name}</h3>
        <p className="text-slate-600">
          {t.type ? `Double ${t.type}, ` : ""}{inscrits.length} binôme{inscrits.length > 1 ? "s" : ""}, terminé
        </p>
        {!memberSession ? (
          <p className="mt-2 text-slate-600">
            Résultats réservés aux adhérents. <button onClick={onLoginRequest} className="font-bold text-[#007DB0] underline underline-offset-4">Se connecter</button>
          </p>
        ) : classement.length > 0 ? (
          <ol className="mt-2 space-y-1">
            {classement.map((i) => {
              const rang = parseInt(i.resultat!.split("/")[0]);
              return (
                <li key={i.id} className="flex items-baseline gap-2">
                  <span className="font-display font-bold text-xl w-8 text-[#007DB0] tabular-nums">{rang}<sup className="text-xs">{rang === 1 ? "er" : "e"}</sup></span>
                  <span className="text-slate-800">{joueursCourts(i.joueurs)}</span>
                  <span className="ml-auto text-slate-500 tabular-nums">{i.resultat}</span>
                </li>
              );
            })}
          </ol>
        ) : inscrits.length > 0 ? (
          <ListeBinomes inscrits={inscrits} />
        ) : null}
      </div>
    </article>
  );
}

// ── Ligne d'un tournoi à venir (feuille de matchs) ───────────────
function TournoiLigne({ t, inscrits, memberSession, onLoginRequest, membreNoms = [], readOnly = false }: {
  t: Tournoi; inscrits: InscritTournoi[]; memberSession: MemberSession | null; onLoginRequest: () => void; membreNoms?: string[]; readOnly?: boolean;
}) {
  const isFull = !!(t.quota && inscrits.length >= t.quota);
  const [ouvert, setOuvert] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCovoiturage, setShowCovoiturage] = useState(false);
  const [covoSeats, setCovoSeats] = useState("");
  const [covoDepart, setCovoDepart] = useState("");
  const [covoContact, setCovoContact] = useState("");
  const daysLeft = getDaysLeft(t.dateLimit);
  const inscriptionsClosed = t.closed === true || (daysLeft !== null && daysLeft < 0);
  const { jour, mois } = jourEtMois(t);
  // 🔕 Le membre a-t-il dit "pas intéressé" pour ce tournoi ?
  const [ignored, setIgnored] = useState<boolean>(!!memberSession?.tournoisIgnored?.includes(t.id));
  const [togglingIgnored, setTogglingIgnored] = useState(false);
  const panneauId = `inscription-${t.id}`;

  async function toggleIgnoredFn() {
    if (!memberSession) return;
    const code = memberSession.memberCode || memberSession.adminCode || sessionStorage.getItem("saccb_member_code") || "";
    if (!code) {
      alert("Reconnectez-vous à votre espace membre pour modifier vos préférences.");
      return;
    }
    setTogglingIgnored(true);
    const r = await memberToggleTournoiIgnored(memberSession.email, code, memberSession.membreId, t.id, !ignored);
    setTogglingIgnored(false);
    if (r.ok) setIgnored(!ignored);
    else alert("Erreur : " + (r.reason || "inconnue"));
  }

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
    const code = memberSession.memberCode || memberSession.adminCode || sessionStorage.getItem("saccb_member_code") || "";
    if (!code) {
      alert("Vous devez être connecté à votre espace membre pour vous inscrire à un tournoi.");
      setSubmitting(false);
      return;
    }
    const covo = showCovoiturage && covoSeats && parseInt(covoSeats) > 0
      ? { seats: parseInt(covoSeats), depart: covoDepart || undefined, contact: covoContact || undefined }
      : null;
    try {
      const r = await publicRegisterTournoiWithCovoiturage(t.id, p1, p2, memberSession.email, code, covo);
      if (r.ok) { alert(`Inscription enregistrée pour ${t.name} !`); (e.target as HTMLFormElement).reset(); window.location.reload(); }
      else alert(r.reason || "Erreur.");
    } finally { setSubmitting(false); }
  }

  // État des inscriptions, en une phrase (couleur selon l'urgence)
  const etat = isFull
    ? { texte: "Complet", couleur: "text-[#C62828]" }
    : inscriptionsClosed
    ? { texte: "Inscriptions fermées", couleur: "text-[#C62828]" }
    : daysLeft === 0
    ? { texte: "Dernier jour pour s'inscrire", couleur: "text-[#C62828]" }
    : daysLeft !== null && daysLeft <= 3
    ? { texte: `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} pour s'inscrire`, couleur: "text-[#B45309]" }
    : t.dateLimit
    ? { texte: `Inscriptions jusqu'au ${limiteLisible(t.dateLimit)}`, couleur: "text-[#157A55]" }
    : { texte: "Inscriptions ouvertes", couleur: "text-[#157A55]" };

  return (
    <article className="py-5 border-b border-[#D3DEE6]">
      <div className="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[5.5rem_1fr_auto] gap-x-4 gap-y-3 items-start">
        <div className="font-display leading-[0.9] text-[#0F1B26]">
          <span className="block text-4xl sm:text-5xl font-extrabold">{jour}</span>
          <span className="text-lg font-bold text-slate-600">{mois}</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-lg sm:text-xl leading-snug">{t.name}</h3>
          <p className="text-slate-600">
            {[t.type ? `Double ${t.type}` : "", t.quota ? `${inscrits.length} / ${t.quota} binômes` : inscrits.length === 0 ? "aucun binôme inscrit pour l'instant" : `${inscrits.length} binôme${inscrits.length > 1 ? "s" : ""} inscrit${inscrits.length > 1 ? "s" : ""}`].filter(Boolean).join(", ")}
          </p>
          <p className={`font-bold ${etat.couleur}`}>{etat.texte}</p>
          {t.description && <p className="mt-2 text-slate-700 whitespace-pre-line max-w-[62ch]">{t.description}</p>}

          {/* Offres de covoiturage */}
          {memberSession && covoiturageOffers.length > 0 && (
            <div className="mt-3">
              <p className="font-bold mb-2 flex items-center gap-2"><Car className="w-4 h-4 text-[#007DB0]" aria-hidden="true" /> Covoiturage proposé</p>
              <ul className="space-y-1">
                {covoiturageOffers.map((i) => (
                  <li key={i.id} className="flex flex-wrap gap-x-4 text-slate-700">
                    <span className="font-bold text-[#007DB0]">{i.covoiturage!.seats} place{i.covoiturage!.seats > 1 ? "s" : ""}</span>
                    <span>{joueursCourts(i.joueurs)}</span>
                    {i.covoiturage!.depart && <span className="inline-flex items-center gap-1 text-slate-600"><MapPin className="w-3.5 h-3.5" /> {i.covoiturage!.depart}</span>}
                    {i.covoiturage!.contact && <span className="inline-flex items-center gap-1 text-slate-600"><Phone className="w-3.5 h-3.5" /> {i.covoiturage!.contact}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* 👥 Binômes déjà inscrits */}
          {inscrits.length > 0 && (
            memberSession ? (
              <div className="mt-3">
                <p className="font-bold text-sm text-slate-700">Déjà inscrits</p>
                <ListeBinomes inscrits={inscrits} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">La liste des binômes inscrits est visible par les adhérents connectés.</p>
            )
          )}
        </div>
        <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:self-center">
          {isFull ? (
            <span className="inline-flex items-center gap-2 font-bold text-[#C62828] min-h-[48px]"><Lock className="w-4 h-4" /> Complet</span>
          ) : inscriptionsClosed ? (
            <button onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} aria-controls={panneauId} className="btn-ghost">Me renseigner</button>
          ) : !memberSession ? (
            <button onClick={onLoginRequest} className="btn-primary !px-6">S&apos;inscrire</button>
          ) : (
            <button onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} aria-controls={panneauId} className={ouvert ? "btn-ghost !px-6" : "btn-primary !px-6"}>
              {ouvert ? "Fermer" : "S'inscrire"}
            </button>
          )}
        </div>
      </div>

      {ouvert && (
        <div id={panneauId} className="mt-4 sm:ml-[6.5rem] bg-white border border-[#D3DEE6] rounded-xl p-5 space-y-4">
          {inscriptionsClosed ? (
            <p className="text-slate-700">
              <strong>Vous souhaitez participer à ce tournoi ?</strong> Contactez un membre du bureau : il est peut-être encore possible de vous inscrire.
            </p>
          ) : memberSession && memberSession.paid !== true ? (
            <p className="text-slate-700">
              <strong>Adhésion à finaliser pour s&apos;inscrire.</strong> Renouvelez votre adhésion de la saison depuis votre espace membre pour pouvoir vous inscrire aux tournois.
            </p>
          ) : memberSession ? (
            <form onSubmit={readOnly ? (e: React.FormEvent) => { e.preventDefault(); alert("Mode présentation : les inscriptions sont désactivées."); } : regT} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Joueur 1</span>
                  <input className="input" name="p1" list={`members-list-${t.id}`} defaultValue={memberSession.nom || ""} required autoComplete="off" />
                </label>
                <label className="block">
                  <span className="label">Joueur 2 (partenaire)</span>
                  <input className="input" name="p2" list={`members-list-${t.id}`} required autoComplete="off" placeholder="Tapez le prénom" />
                </label>
              </div>
              {/* Liste des adhérents : évite les fautes de frappe */}
              <datalist id={`members-list-${t.id}`}>
                {membreNoms.map((nom) => <option key={nom} value={nom} />)}
              </datalist>

              {/* Covoiturage */}
              <div>
                <label className="inline-flex items-center gap-3 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={showCovoiturage} onChange={(e) => setShowCovoiturage(e.target.checked)} className="w-5 h-5 rounded border-slate-400" />
                  <Car className="w-5 h-5 text-[#007DB0]" aria-hidden="true" />
                  <span className="font-bold">Je propose des places en covoiturage</span>
                </label>
                {showCovoiturage && (
                  <div className="mt-2 grid sm:grid-cols-[6rem_1fr_1fr] gap-3">
                    <label className="block"><span className="label">Places</span><input className="input" type="number" min="1" max="7" value={covoSeats} onChange={(e) => setCovoSeats(e.target.value)} placeholder="2" /></label>
                    <label className="block"><span className="label">Départ depuis</span><input className="input" value={covoDepart} onChange={(e) => setCovoDepart(e.target.value)} placeholder="Sainte-Adresse" /></label>
                    <label className="block"><span className="label">Contact (facultatif)</span><input className="input" value={covoContact} onChange={(e) => setCovoContact(e.target.value)} placeholder="Téléphone ou WhatsApp" /></label>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="btn-primary !px-6" disabled={submitting}>{submitting ? "Envoi…" : "Valider l'inscription"}</button>
                <button type="button" onClick={() => downloadIcs(t)} className="btn-ghost" title="Fichier à ouvrir avec Google Agenda, iPhone ou Outlook">
                  <CalendarPlus className="w-4 h-4" /> Ajouter à mon agenda
                </button>
              </div>

              {/* 🔕 « Pas intéressé(e) » : plus de rappel pour ce tournoi */}
              {!readOnly && (
                ignored ? (
                  <p className="text-slate-700 flex flex-wrap items-center gap-3">
                    Vous ne recevrez pas de rappel pour ce tournoi.
                    <button type="button" onClick={toggleIgnoredFn} disabled={togglingIgnored} className="btn-ghost"><Bell className="w-4 h-4" /> Réactiver les rappels</button>
                  </p>
                ) : (
                  <button type="button" onClick={toggleIgnoredFn} disabled={togglingIgnored} className="text-slate-600 underline underline-offset-4 inline-flex items-center gap-2 min-h-[44px]">
                    <BellOff className="w-4 h-4" /> {togglingIgnored ? "…" : "Pas intéressé(e), ne plus me rappeler ce tournoi"}
                  </button>
                )
              )}
            </form>
          ) : null}

        </div>
      )}
    </article>
  );
}
