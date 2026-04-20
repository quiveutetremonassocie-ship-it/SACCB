"use client";

import { motion } from "framer-motion";
import { Calendar, Users, Lock, Clock, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Medal, Trophy, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { DB, Tournoi, InscritTournoi } from "@/lib/types";
import { publicRegisterTournoi } from "@/lib/db";
import { MemberSession } from "@/lib/useMemberSession";

const today = new Date().toISOString().slice(0, 10);
const isTermine = (t: Tournoi) => t.date < today;

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
    <section id="tournois" className="bg-section-wrap">
      <div className="section-pad">
        <header className="section-head">
          <div>
            <span className="section-index">04 — Compétitions</span>
            <h2 className="h-title text-5xl md:text-7xl lg:text-8xl mt-4">
              Tournois <span className="font-editorial italic font-normal">à venir.</span>
            </h2>
          </div>
          <p className="hidden md:block text-[color:var(--muted)] max-w-xs text-right text-sm leading-relaxed">
            Inscrivez votre binôme. Doubles hommes, dames et mixtes.
          </p>
        </header>

        {/* À venir */}
        {upcoming.length === 0 && done.length === 0 ? (
          <div className="py-20 text-center border-y border-[color:var(--line)]">
            <Trophy className="w-8 h-8 mx-auto mb-5 text-[color:var(--muted)]" />
            <p className="text-[color:var(--muted)] text-sm uppercase tracking-[0.28em]" style={{ fontFamily: "Oswald, sans-serif" }}>
              Aucun tournoi programmé
            </p>
          </div>
        ) : (
          <div className="border-t border-[color:var(--line)]">
            {upcoming.map((t) => {
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

        {/* Terminés de la saison */}
        {done.length > 0 && (
          <div className="mt-14">
            <button
              onClick={() => setShowDone(!showDone)}
              className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors font-semibold"
              style={{ fontFamily: "Oswald, sans-serif" }}
            >
              {showDone ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <CheckCircle2 className="w-4 h-4 text-[color:var(--forest)]" />
              Tournois terminés ({done.length})
            </button>
            {showDone && (
              <div className="mt-6 border-t border-[color:var(--line)]">
                {done.map((t) => {
                  const inscrits = (db.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                  return <TournoiTermineCard key={t.id} t={t} inscrits={inscrits} />;
                })}
              </div>
            )}
          </div>
        )}

        {/* Saisons précédentes */}
        {archives.length > 0 && (
          <div className="mt-20 pt-14 border-t border-[color:var(--line-strong)]">
            <h3 className="font-display text-3xl md:text-4xl tracking-tight text-[color:var(--ink)] mb-6 flex items-center gap-3">
              <Trophy className="w-6 h-6 text-[color:var(--gold)]" /> Saisons précédentes
            </h3>
            <div className="border-t border-[color:var(--line)]">
              {[...archives].reverse().map((archive) => {
                const key = `${archive.y1}-${archive.y2}`;
                const isOpen = openArchive === key;
                const hasTournois = (archive.config_tournois ?? []).length > 0;
                const hasResults = (archive.inscrits_tournoi ?? []).some((i) => i.resultat);
                return (
                  <div key={key} className="border-b border-[color:var(--line)]">
                    <button
                      onClick={() => setOpenArchive(isOpen ? null : key)}
                      className="w-full flex items-center justify-between py-5 text-left group"
                    >
                      <span className="flex items-baseline gap-4">
                        <span className="font-display text-2xl md:text-3xl text-[color:var(--ink)] tracking-tight">
                          Saison {archive.y1}–{archive.y2}
                        </span>
                        <span className="text-xs text-[color:var(--muted)]">
                          {hasTournois ? `${archive.config_tournois.length} tournoi${archive.config_tournois.length > 1 ? "s" : ""}` : "Aucun tournoi"}
                        </span>
                        {hasResults && (
                          <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--gold)] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
                            · Classements
                          </span>
                        )}
                      </span>
                      {isOpen ? <ChevronUp className="w-5 h-5 text-[color:var(--muted)] group-hover:text-[color:var(--ink)]" /> : <ChevronDown className="w-5 h-5 text-[color:var(--muted)] group-hover:text-[color:var(--ink)]" />}
                    </button>
                    {isOpen && (
                      <div className="pb-8 pt-2">
                        {hasTournois && (
                          <div className="border-t border-[color:var(--line)]">
                            {archive.config_tournois.map((t) => {
                              const inscrits = (archive.inscrits_tournoi ?? []).filter((i) => i.tournoiId === t.id);
                              return <TournoiTermineCard key={t.id} t={t} inscrits={inscrits} />;
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
                        {!hasTournois && <p className="text-[color:var(--muted)] text-sm mt-4">Aucun tournoi enregistré.</p>}
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

// ─── Carte tournoi terminé ──────────────────────────────────────
function TournoiTermineCard({ t, inscrits }: { t: Tournoi; inscrits: InscritTournoi[] }) {
  const withResults = inscrits.filter((i) => i.resultat).sort((a, b) => {
    const ra = parseInt(a.resultat?.split("/")[0] ?? "99");
    const rb = parseInt(b.resultat?.split("/")[0] ?? "99");
    return ra - rb;
  });

  return (
    <article className="py-8 border-b border-[color:var(--line)] opacity-75">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h4 className="font-display text-2xl md:text-3xl tracking-tight text-[color:var(--ink)]">{t.name}</h4>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)] border border-[color:var(--line-strong)]" style={{ fontFamily: "Oswald, sans-serif" }}>
              <CheckCircle2 className="w-3 h-3" /> Terminé
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[color:var(--muted)]" style={{ fontFamily: "Oswald, sans-serif" }}>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {t.date}</span>
            {t.type && <span className="uppercase tracking-[0.18em] text-[11px]">Double {t.type}</span>}
            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {inscrits.length} binôme{inscrits.length > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
      {withResults.length > 0 ? (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)] mb-3 font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
            Classement
          </p>
          <ul className="space-y-1">
            {withResults.map((i) => {
              const rank = parseInt(i.resultat!.split("/")[0]);
              return (
                <li key={i.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-[color:var(--line)]/50 last:border-0">
                  <span className="w-6 text-center">{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`}</span>
                  <span className="text-[color:var(--ink)]">{i.joueurs}</span>
                  <span className="text-[color:var(--muted)] text-xs ml-auto tabular-nums" style={{ fontFamily: "Oswald, sans-serif" }}>{i.resultat}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : inscrits.length > 0 ? (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)] mb-2 font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
            Participants
          </p>
          <ul className="space-y-0.5">
            {inscrits.map((i) => (
              <li key={i.id} className="text-sm text-[color:var(--ink)]/80">· {i.joueurs}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

// ─── Palmarès d'une saison ──────────────────────────────────────
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
    <div className="mt-8 pt-8 border-t border-[color:var(--line)]">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)] mb-4 font-semibold flex items-center gap-2" style={{ fontFamily: "Oswald, sans-serif" }}>
        <Medal className="w-3.5 h-3.5" /> Classement saison {saison}
      </p>
      <ul className="divide-y divide-[color:var(--line)]">
        {sorted.map((p, idx) => (
          <li key={p.nom} className="flex items-center gap-4 py-3 text-sm">
            <span className="w-6 text-center font-bold text-[color:var(--muted)]">
              {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
            </span>
            <span className="flex-1 text-[color:var(--ink)] font-medium">{p.nom}</span>
            <span className="text-xs text-[color:var(--muted)]">{p.count} tournoi{p.count > 1 ? "s" : ""}</span>
            {p.podiums > 0 && <span className="text-xs text-[color:var(--gold)] font-semibold">{p.podiums} podium{p.podiums > 1 ? "s" : ""}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Countdown ──────────────────────────────────────
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
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] font-semibold border";
  const fontStyle = { fontFamily: "Oswald, sans-serif" };
  if (days < 0) return <span className={`${base} border-[color:var(--line-strong)] text-[color:var(--muted)]`} style={fontStyle}><Lock className="w-3 h-3" /> Inscriptions closes</span>;
  if (days === 0) return <span className={`${base} border-[color:var(--danger)] text-[color:var(--danger)]`} style={fontStyle}><AlertCircle className="w-3 h-3" /> Dernier jour</span>;
  if (days <= 3) return <span className={`${base} border-[color:var(--danger)] text-[color:var(--danger)]`} style={fontStyle}><Clock className="w-3 h-3" /> {days} j restants</span>;
  if (days <= 7) return <span className={`${base} border-[color:var(--gold)] text-[color:var(--gold)]`} style={fontStyle}><Clock className="w-3 h-3" /> {days} jours</span>;
  if (days <= 14) return <span className={`${base} border-[color:var(--line-strong)] text-[color:var(--muted)]`} style={fontStyle}><Clock className="w-3 h-3" /> {days} jours</span>;
  return null;
}

// ─── Carte tournoi à venir ──────────────────────────────────────
function TournoiCard({ t, inscrits, memberSession, onLoginRequest }: {
  t: Tournoi; inscrits: InscritTournoi[]; memberSession: MemberSession | null; onLoginRequest: () => void;
}) {
  const isFull = !!(t.quota && inscrits.length >= t.quota);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const daysLeft = getDaysLeft(t.dateLimit);
  const inscriptionsClosed = daysLeft !== null && daysLeft < 0;

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
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-[color:var(--line)] py-10 group"
    >
      <div className="grid md:grid-cols-12 gap-6 md:gap-10 items-start">
        <div className="md:col-span-5">
          <div className="flex items-baseline gap-4">
            <span className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--gold)] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
              {t.date}
            </span>
            {t.type && (
              <span className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)] font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
                Double {t.type}
              </span>
            )}
          </div>
          <h3 className="font-display text-4xl md:text-5xl tracking-tight text-[color:var(--ink)] mt-3 leading-[0.95]">
            {t.name}
          </h3>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            {t.dateLimit && <CountdownBadge dateLimit={t.dateLimit} />}
            {t.quota && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] font-semibold border border-[color:var(--forest)] text-[color:var(--forest)]" style={{ fontFamily: "Oswald, sans-serif" }}>
                <Users className="w-3 h-3" />
                {inscrits.length} / {t.quota}
              </span>
            )}
            {isFull && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] font-semibold border border-[color:var(--danger)] text-[color:var(--danger)]" style={{ fontFamily: "Oswald, sans-serif" }}>
                Complet
              </span>
            )}
          </div>
        </div>

        <div className="md:col-span-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)] mb-3 font-semibold" style={{ fontFamily: "Oswald, sans-serif" }}>
            Binômes inscrits
          </p>
          {inscrits.length === 0 ? (
            <p className="text-[color:var(--muted)] text-sm italic">Aucun pour le moment</p>
          ) : (
            <ul className="space-y-1.5">
              {inscrits.map((i) => (
                <li key={i.id} className="text-sm text-[color:var(--ink)]/85 flex items-center gap-2">
                  <span className="w-1 h-1 bg-[color:var(--gold)] rounded-full" />
                  {i.joueurs}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-3 md:flex md:justify-end">
          {!isFull && !inscriptionsClosed && (
            memberSession ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="btn-primary group inline-flex items-center gap-2"
              >
                {expanded ? "Fermer" : "S'inscrire"}
                <ArrowUpRight className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : "group-hover:translate-x-1 group-hover:-translate-y-1"}`} />
              </button>
            ) : (
              <button onClick={onLoginRequest} className="btn-ghost inline-flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Se connecter
              </button>
            )
          )}
        </div>
      </div>

      {expanded && memberSession && !isFull && !inscriptionsClosed && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={regT}
          className="mt-8 pt-8 border-t border-[color:var(--line)] grid md:grid-cols-12 gap-4 items-end"
        >
          <div className="md:col-span-5">
            <label className="label">Joueur 1</label>
            <input className="input" name="p1" placeholder="Nom du joueur" required />
          </div>
          <div className="md:col-span-5">
            <label className="label">Joueur 2</label>
            <input className="input" name="p2" placeholder="Nom du partenaire" required />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? "Envoi…" : "Valider"}
            </button>
          </div>
        </motion.form>
      )}
    </motion.article>
  );
}
