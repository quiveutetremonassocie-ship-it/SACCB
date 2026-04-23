"use client";

import { motion } from "framer-motion";
import { Calendar, Trophy, Users, Lock, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Medal } from "lucide-react";
import { useState } from "react";
import { DB, Tournoi, InscritTournoi, SeasonArchive } from "@/lib/types";
import { publicRegisterTournoi } from "@/lib/db";
import { MemberSession } from "@/lib/useMemberSession";

const today = new Date().toISOString().slice(0, 10);

function isTermine(t: Tournoi) {
  return t.date < today;
}

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
  const upcoming = tournois.filter((t) => !isTermine(t));
  const done = tournois.filter((t) => isTermine(t));
  const archives = db.archives ?? [];

  const [showDone, setShowDone] = useState(false);
  const [openArchive, setOpenArchive] = useState<string | null>(null);

  return (
    <section id="tournois" className="bg-section-wrap bg-tournament relative">
      <div className="section-pad relative">
        <div className="text-center mb-14">
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-amber-600">Compétitions</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Tournois</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Inscrivez votre binôme aux prochains tournois du club.
          </p>
        </div>

        {/* ── Tournois à venir ── */}
        {upcoming.length === 0 && done.length === 0 ? (
          <div className="glass-sport p-10 text-center text-slate-400">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            Aucun tournoi prévu pour le moment.
          </div>
        ) : (
          <div className="space-y-6">
            {upcoming.map((t) => {
              const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
              return (
                <TournoiCard key={t.id} t={t} inscrits={inscrits} memberSession={memberSession} onLoginRequest={onLoginRequest} />
              );
            })}
          </div>
        )}

        {/* ── Tournois terminés (saison courante) ── */}
        {done.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowDone(!showDone)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition mb-4"
            >
              {showDone ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Tournois terminés cette saison ({done.length})
            </button>
            {showDone && (
              <div className="space-y-4">
                {done.map((t) => {
                  const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                  return <TournoiTermineCard key={t.id} t={t} inscrits={inscrits} memberSession={memberSession} onLoginRequest={onLoginRequest} />;
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Saisons précédentes ── */}
        {archives.length > 0 && (
          <div className="mt-10">
            <h3 className="font-display text-2xl text-slate-700 tracking-wider mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" /> Saisons précédentes
            </h3>
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
                            {hasResults && (
                              <PalmaresSection
                                config_tournois={archive.config_tournois ?? []}
                                inscrits_tournoi={archive.inscrits_tournoi ?? []}
                                saison={`${archive.y1}–${archive.y2}`}
                              />
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

// ── Palmares d'une saison ──────────────────────────────────────
function PalmaresSection({ config_tournois, inscrits_tournoi, saison }: {
  config_tournois: Tournoi[];
  inscrits_tournoi: InscritTournoi[];
  saison: string;
}) {
  const stats: Record<string, { nom: string; podiums: number; bestRank: number; count: number }> = {};
  for (const insc of inscrits_tournoi) {
    if (!insc.resultat) continue;
    const rank = parseInt(insc.resultat.split("/")[0]);
    if (isNaN(rank)) continue;
    const noms = insc.joueurs.split("/").map((n) => n.trim());
    for (const nom of noms) {
      if (!stats[nom]) stats[nom] = { nom, podiums: 0, bestRank: 999, count: 0 };
      stats[nom].count++;
      if (rank <= 3) stats[nom].podiums++;
      if (rank < stats[nom].bestRank) stats[nom].bestRank = rank;
    }
  }
  const sorted = Object.values(stats).sort((a, b) => a.bestRank - b.bestRank || b.podiums - a.podiums);
  if (sorted.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
        <Medal className="w-3.5 h-3.5" /> Classement saison {saison}
      </p>
      <div className="space-y-1.5">
        {sorted.map((p, idx) => (
          <div key={p.nom} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-slate-100 text-sm">
            <span className="w-6 text-center font-bold text-slate-500">
              {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
            </span>
            <span className="flex-1 text-slate-700 font-medium">{p.nom}</span>
            <span className="text-xs text-slate-400">{p.count} tournoi{p.count > 1 ? "s" : ""}</span>
            {p.podiums > 0 && <span className="text-xs text-amber-600 font-semibold">{p.podiums} podium{p.podiums > 1 ? "s" : ""}</span>}
          </div>
        ))}
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

function TournoiCard({ t, inscrits, memberSession, onLoginRequest }: {
  t: Tournoi; inscrits: InscritTournoi[]; memberSession: MemberSession | null; onLoginRequest: () => void;
}) {
  const isFull = !!(t.quota && inscrits.length >= t.quota);
  const [submitting, setSubmitting] = useState(false);
  const daysLeft = getDaysLeft(t.dateLimit);
  const inscriptionsClosed = t.closed === true || (daysLeft !== null && daysLeft < 0);

  async function regT(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("p1") || "").trim();
    const p2 = String(fd.get("p2") || "").trim();
    if (!p1 || !p2) { setSubmitting(false); return; }
    try {
      const r = await publicRegisterTournoi(t.id, p1, p2);
      if (r.ok) { alert(`Inscription enregistrée pour ${t.name} !`); (e.target as HTMLFormElement).reset(); window.location.reload(); }
      else alert(r.reason || "Erreur.");
    } finally { setSubmitting(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className={`glass-sport overflow-hidden ${inscriptionsClosed ? "opacity-75" : ""}`}>
      <div className={`relative p-7 border-l-4 ${inscriptionsClosed ? "border-red-400" : "border-emerald-500"}`}>
        <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl ${inscriptionsClosed ? "from-red-100/40" : "from-emerald-100/40"} to-transparent rounded-full blur-2xl pointer-events-none`} />
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display text-3xl text-slate-800 tracking-wider">{t.name}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {t.date}</span>
              {t.type && <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${inscriptionsClosed ? "bg-red-50 text-red-400" : "bg-blue-100 text-blue-700"}`}>Double {t.type}</span>}
              {t.quota && <span className={`flex items-center gap-1.5 ${inscriptionsClosed ? "text-red-400" : "text-emerald-600"}`}><Users className="w-4 h-4" /> {inscrits.length} / {t.quota} doubles</span>}
            </div>
            {t.dateLimit && !inscriptionsClosed && <div className="mt-3"><CountdownBadge dateLimit={t.dateLimit} /></div>}
          </div>
          {isFull && <span className="px-4 py-2 rounded-full bg-red-100 text-red-600 text-sm font-bold uppercase">Complet</span>}
          {!isFull && inscriptionsClosed && <span className="px-4 py-2 rounded-full bg-red-100 text-red-600 text-sm font-bold uppercase flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Inscriptions fermées</span>}
          {!isFull && !inscriptionsClosed && <span className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold uppercase flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Inscriptions ouvertes</span>}
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
        {inscriptionsClosed ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 text-sm">
              💬 <strong>Vous souhaitez participer à ce tournoi ?</strong> Contactez <strong>Hernan</strong> ou un membre du bureau — il est peut-être encore possible de vous inscrire.
            </p>
          </div>
        ) : !isFull && (
          memberSession ? (
            <form onSubmit={regT} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input className="input" name="p1" placeholder="Joueur 1" required />
                <input className="input" name="p2" placeholder="Joueur 2" required />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? "Envoi..." : "S'inscrire"}</button>
            </form>
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
