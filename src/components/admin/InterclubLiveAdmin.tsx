"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Shuffle, Rocket, Copy, Check, ExternalLink, RefreshCw, ChevronRight, Flag, Undo2, Trash2, Pencil, ClipboardList, Monitor } from "lucide-react";
import { InterClub, InterClubLive, LiveFormat, LiveMatch, LivePhase } from "@/lib/types";
import {
  equipesDuTournoi, genererBrassage, genererPhaseSuivante, matchsPoule, matchJoue, phaseTerminee, formatTexte,
  jetonAleatoire, classementFinal, nomEquipe, lettre,
} from "@/lib/interclubLive";
import { LiveBoard, ScoreForm, EquipesMap, NomEquipe } from "../live/LiveBoard";
import { exporterResultatsPdf } from "@/lib/interclubPdf";
import { imprimerQrCodes } from "@/lib/interclubQr";

const SITE = "https://saccb.fr";
const POINTS = [11, 12, 14, 15, 18, 21];

function FormatChoix({ f, set }: { f: LiveFormat; set: (f: LiveFormat) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select className="input !py-1.5 !text-sm w-auto" value={f.sets} onChange={(e) => set({ ...f, sets: Number(e.target.value) === 1 ? 1 : 3 })}>
        <option value={1}>1 set</option>
        <option value={3}>2 sets gagnants</option>
      </select>
      <span className="text-slate-500">de</span>
      <select className="input !py-1.5 !text-sm w-auto" value={f.points} onChange={(e) => set({ ...f, points: Number(e.target.value) })}>
        {POINTS.map((p) => <option key={p} value={p}>{p} points</option>)}
      </select>
      <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
        <input type="checkbox" checked={f.cassant} onChange={(e) => set({ ...f, cassant: e.target.checked })} />
        points cassants <span className="text-[11px] text-slate-400">(sans 2 points d&apos;écart)</span>
      </label>
    </div>
  );
}

export default function InterclubLiveAdmin({
  t, onSave, onRefresh, onClose, readOnly,
}: {
  t: InterClub;
  onSave: (live: InterClubLive | undefined) => Promise<void>;
  onRefresh?: () => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const live = t.live;
  const eqs = useMemo(() => equipesDuTournoi(t), [t]);
  const equipes: EquipesMap = eqs;
  const clubs = useMemo(() => Object.fromEntries(t.clubs.map((c) => [c.id, c.nom])), [t]);
  const nbEquipes = Object.keys(eqs).length;
  const [busy, setBusy] = useState(false);
  const [copie, setCopie] = useState<string | null>(null);

  // ── Préparation (avant le lancement) ──
  const [nbPoules, setNbPoules] = useState(Math.max(1, Math.round(nbEquipes / 5)));
  const [format1, setFormat1] = useState<LiveFormat>({ sets: 1, points: 12, cassant: true });
  const [brouillon, setBrouillon] = useState<LivePhase | null>(null);

  // ── Phase suivante ──
  const phases = live?.phases || [];
  const courante = phases[phases.length - 1];
  const [suiteNom, setSuiteNom] = useState(phases.length <= 1 ? "2ᵉ tour" : "Finale");
  const [suitePoules, setSuitePoules] = useState(courante?.poules.length || nbPoules);
  const [suiteFormat, setSuiteFormat] = useState<LiveFormat>({ sets: 3, points: phases.length <= 1 ? 14 : 18, cassant: true });
  const [edition, setEdition] = useState<string | null>(null);

  // 🔄 Les scores saisis par les clubs arrivent toutes les 5 s
  useEffect(() => {
    if (!live || !onRefresh) return;
    let enCours = false;
    const iv = setInterval(() => {
      if (document.hidden || enCours) return;
      enCours = true;
      onRefresh().catch(() => {}).finally(() => { enCours = false; });
    }, 5000);
    return () => clearInterval(iv);
  }, [!!live, onRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enregistrer(l: InterClubLive | undefined) {
    setBusy(true);
    try { await onSave(l); } finally { setBusy(false); }
  }

  async function copier(texte: string, cle: string) {
    try { await navigator.clipboard.writeText(texte); } catch { window.prompt("Copie ce texte :", texte); }
    setCopie(cle);
    setTimeout(() => setCopie((c) => (c === cle ? null : c)), 2000);
  }

  function deplacer(equipeId: string, versPoule: number) {
    if (!brouillon) return;
    const poules = brouillon.poules.map((p) => ({ ...p, equipes: p.equipes.filter((id) => id !== equipeId) }));
    poules[versPoule].equipes.push(equipeId);
    setBrouillon({ ...brouillon, poules: poules.map((p) => ({ ...p, matchs: matchsPoule(p.equipes) })) });
  }

  async function lancer() {
    if (!brouillon) return;
    if (!confirm("Lancer le tournoi ?\n\nLes inscriptions seront fermées et les clubs verront les poules sur leur page.")) return;
    await enregistrer({ liveToken: jetonAleatoire(18), phases: [brouillon], startedAt: new Date().toISOString() });
    setBrouillon(null);
  }

  // Modifie un match de la phase courante (ou d'une autre) et enregistre
  async function majMatch(phaseId: string, matchId: string, patch: Partial<LiveMatch>, action: string) {
    if (!live) return;
    const at = new Date().toISOString();
    const l: InterClubLive = {
      ...live,
      phases: live.phases.map((ph) => ph.id !== phaseId ? ph : {
        ...ph,
        poules: ph.poules.map((p) => ({ ...p, matchs: p.matchs.map((m) => {
          if (m.id !== matchId) return m;
          const n = { ...m, ...patch, at };
          // 🕘 Historique : la table de marque apparaît comme « admin »
          n.historique = [...(m.historique || []), { at, par: "admin", action, sa: n.sa, sb: n.sb }].slice(-30);
          return n;
        }) })),
      }),
    };
    await enregistrer(l);
  }

  async function phaseSuivante() {
    if (!live || !courante) return;
    if (!phaseTerminee(courante) && !confirm("Tous les matchs n'ont pas de score. Continuer quand même ? (les matchs sans score comptent comme non joués)")) return;
    const fermee: LivePhase = {
      ...courante,
      terminee: true,
      poules: courante.poules.map((p) => ({ ...p, matchs: p.matchs.map((m) => (matchJoue(m) ? { ...m, etat: "valide" as const } : m)) })),
    };
    const nouvelle = genererPhaseSuivante(fermee, Math.max(1, Math.min(suitePoules, nbEquipes)), suiteFormat, suiteNom.trim() || `Phase ${phases.length + 1}`);
    await enregistrer({ ...live, phases: [...live.phases.slice(0, -1), fermee, nouvelle] });
    setSuiteNom("Finale");
    setSuiteFormat({ sets: 3, points: 18, cassant: true });
  }

  async function annulerPhase() {
    if (!live || phases.length < 2) return;
    if (courante.poules.some((p) => p.matchs.some(matchJoue))) { alert("Des scores ont déjà été saisis dans cette phase : impossible de l'annuler."); return; }
    if (!confirm(`Annuler « ${courante.nom} » et revenir à « ${phases[phases.length - 2].nom} » ?`)) return;
    const prec = { ...phases[phases.length - 2], terminee: false };
    await enregistrer({ ...live, phases: [...phases.slice(0, -2), prec] });
  }

  async function terminer() {
    if (!live || !courante) return;
    if (!phaseTerminee(courante) && !confirm("Tous les matchs n'ont pas de score. Terminer quand même ?")) return;
    await enregistrer({ ...live, termine: true, phases: [...phases.slice(0, -1), { ...courante, terminee: true }] });
  }

  async function reinitialiser() {
    const mot = prompt("⚠️ Cela efface les poules et TOUS les scores du jour J (les inscriptions des clubs sont conservées).\n\nTape EFFACER pour confirmer :");
    if (mot !== "EFFACER") return;
    await enregistrer(undefined);
  }

  const lienEcran = live ? `${SITE}/interclub/#ecran=${live.liveToken}` : "";
  const texteClassement = () => {
    if (!courante) return "";
    return [`${t.name} — classement final`, "", ...classementFinal(courante).map((id, i) => `${i + 1}. ${nomEquipe(eqs[id])} (${eqs[id]?.club || "?"})`)].join("\n");
  };

  // 🏳 Forfait (RGC FFBaD 3.4.2) : défaite 0-21 (ou 0-N selon le format) à chaque set, compte -1
  async function forfait(ph: LivePhase, m: LiveMatch, equipe: string) {
    const nom = nomEquipe(eqs[equipe]);
    if (!confirm(`Déclarer « ${nom} » forfait pour ce match ?\n\nScore enregistré : 0-${ph.format.points}${ph.format.sets === 1 ? "" : `, 0-${ph.format.points}`} et le forfait compte -1 point au classement (règlement FFBaD).`)) return;
    const nbSets = ph.format.sets === 1 ? 1 : 2;
    const perdant = Array(nbSets).fill(0), gagnant = Array(nbSets).fill(ph.format.points);
    await majMatch(ph.id, m.id, {
      sa: m.a === equipe ? perdant : gagnant,
      sb: m.a === equipe ? gagnant : perdant,
      forfait: equipe, etat: "valide", par: "admin",
    }, `forfait de ${nom}`);
  }

  // 🚪 Équipe qui arrête (RGC FFBaD 3.4.4) : ses résultats ne comptent plus dans sa poule
  async function basculerRetrait(equipe: string) {
    if (!live || !courante) return;
    const poule = courante.poules.find((p) => p.equipes.includes(equipe));
    if (!poule) return;
    const deja = (poule.retirees || []).includes(equipe);
    if (!deja && !confirm(`« ${nomEquipe(eqs[equipe])} » arrête le tournoi ?\n\nComme le prévoit le règlement FFBaD, tous ses résultats dans la poule sont retirés du classement, elle est classée dernière et ne passe pas à la phase suivante.`)) return;
    const retirees = deja ? (poule.retirees || []).filter((x) => x !== equipe) : [...(poule.retirees || []), equipe];
    await enregistrer({
      ...live,
      phases: live.phases.map((ph) => ph.id !== courante.id ? ph : { ...ph, poules: ph.poules.map((p) => (p.id === poule.id ? { ...p, retirees } : p)) }),
    });
  }

  const renderAction = (m: LiveMatch, ph: LivePhase) => {
    if (readOnly || live?.termine) return null;
    const enEdition = edition === m.id;
    const aValider = matchJoue(m) && m.etat !== "valide" && m.par !== "admin";
    if (m.forfait) {
      return (
        <div className="mt-1 flex justify-center items-center gap-2 text-[11px]">
          <span className="text-red-600 font-semibold">🏳 Forfait de {eqs[m.forfait]?.joueur1 || "?"} / {eqs[m.forfait]?.joueur2 || "?"}</span>
          <button onClick={() => majMatch(ph.id, m.id, { sa: undefined, sb: undefined, forfait: undefined, etat: undefined, par: undefined, conteste: undefined, corrige: undefined, ancien: undefined }, "forfait annulé")} className="text-blue-600 hover:underline">annuler</button>
        </div>
      );
    }
    const desaccord = m.conteste && m.etat !== "valide" && m.par !== "admin";
    const score = (sa?: number[], sb?: number[]) => (sa && sb ? sa.map((v, i) => `${v}-${sb[i]}`).join(" · ") : "—");
    return (
      <div className="mt-1.5">
        {desaccord && !enEdition && (
          <div className="mb-1.5 rounded-lg border-2 border-red-300 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
            <p className="font-bold">❓ Score contesté — va au terrain régler le match</p>
            <p>{clubs[m.ancien?.par || ""] || "1ʳᵉ équipe"} : <span className="font-mono font-bold">{score(m.ancien?.sa, m.ancien?.sb)}</span></p>
            <p>{clubs[m.par || ""] || "2ᵉ équipe"} : <span className="font-mono font-bold">{score(m.sa, m.sb)}</span></p>
            <p className="text-red-600 mt-0.5">Une fois sur place : garde le bon score, valide la correction, ou saisis le score décidé.</p>
            {m.ancien?.sa && m.ancien?.sb && (
              <button
                onClick={() => majMatch(ph.id, m.id, { sa: m.ancien!.sa, sb: m.ancien!.sb, etat: "valide", par: "admin", conteste: undefined, corrige: undefined, ancien: undefined }, "1er score gardé (table de marque)")}
                disabled={busy}
                className="mt-1 text-[11px] font-semibold text-red-700 underline"
              >
                Garder le 1ᵉʳ score ({score(m.ancien.sa, m.ancien.sb)})
              </button>
            )}
          </div>
        )}
        {enEdition ? (
          <ScoreForm
            m={m} format={ph.format} equipes={equipes} labelBouton="Valider ce score"
            onSubmit={async (sa, sb) => { await majMatch(ph.id, m.id, { sa, sb, etat: "valide", par: "admin", conteste: undefined, corrige: undefined, ancien: undefined }, "score saisi par la table de marque"); setEdition(null); return null; }}
          />
        ) : (
          <div className="flex justify-center gap-2">
            {aValider && (
              <button onClick={() => majMatch(ph.id, m.id, { etat: "valide", conteste: undefined, corrige: undefined, ancien: undefined }, "validé par la table de marque")} disabled={busy} className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 hover:bg-emerald-100 flex items-center gap-1">
                <Check className="w-3 h-3" /> Valider
              </button>
            )}
            <button onClick={() => setEdition(m.id)} className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5 hover:bg-slate-100 flex items-center gap-1">
              <Pencil className="w-3 h-3" /> {matchJoue(m) ? "Corriger" : "Saisir"}
            </button>
            {matchJoue(m) && (
              <button
                onClick={() => { if (confirm("Effacer ce score ? Le match repassera « à jouer ».")) majMatch(ph.id, m.id, { sa: undefined, sb: undefined, etat: undefined, par: undefined, conteste: undefined, corrige: undefined, ancien: undefined }, "effacé par la table de marque"); }}
                disabled={busy}
                className="text-[11px] font-semibold text-red-600 bg-white border border-red-200 rounded-md px-2 py-0.5 hover:bg-red-50 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Effacer
              </button>
            )}
            <select
              value=""
              onChange={(e) => { if (e.target.value) forfait(ph, m, e.target.value); }}
              className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-md px-1 py-0.5"
              title="Déclarer une équipe forfait"
            >
              <option value="">🏳 Forfait…</option>
              <option value={m.a}>{eqs[m.a]?.joueur1} / {eqs[m.a]?.joueur2}</option>
              <option value={m.b}>{eqs[m.b]?.joueur1} / {eqs[m.b]?.joueur2}</option>
            </select>
          </div>
        )}
        {(m.historique?.length ?? 0) > 0 && <HistoriqueMatch m={m} clubs={clubs} />}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-gradient-to-br from-[#0f2440] via-[#1e3a5f] to-[#0f2440] overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between gap-3 mb-5 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Jour J · table de marque</p>
            <h2 className="text-2xl font-bold">{t.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20" title="Fermer"><X className="w-5 h-5" /></button>
        </div>

        {/* ───────── Avant le lancement ───────── */}
        {!live && (
          <div className="bg-white rounded-3xl shadow-2xl p-5 md:p-6 space-y-5">
            {nbEquipes < 2 ? (
              <p className="text-center text-slate-500 py-8">Il faut au moins 2 binômes inscrits pour lancer le tournoi.</p>
            ) : (
              <>
                <div>
                  <p className="font-bold text-[#1e3a5f] mb-1">1. Les poules du premier tour</p>
                  <p className="text-sm text-slate-500 mb-3">
                    {nbEquipes} binômes inscrits. Les poules sont équilibrées en niveau et on évite de mettre deux équipes du même club ensemble.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-slate-600 flex items-center gap-2">
                      Nombre de poules
                      <select className="input !py-1.5 !text-sm w-auto" value={nbPoules} onChange={(e) => { setNbPoules(Number(e.target.value)); setBrouillon(null); }}>
                        {Array.from({ length: Math.min(12, Math.floor(nbEquipes / 2)) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n} poule{n > 1 ? "s" : ""} (≈ {Math.round((nbEquipes / n) * 10) / 10} équipes)</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-[#1e3a5f] mb-2">2. Format des matchs</p>
                  <FormatChoix f={format1} set={(f) => { setFormat1(f); if (brouillon) setBrouillon({ ...brouillon, format: f }); }} />
                </div>
                <button onClick={() => setBrouillon(genererBrassage(t, nbPoules, format1))} className="btn-primary !text-xs !px-5 !py-2.5">
                  <Shuffle className="w-4 h-4" /> {brouillon ? "Refaire le tirage" : "Générer les poules"}
                </button>

                {brouillon && (
                  <div className="border-t border-slate-200 pt-5">
                    <p className="font-bold text-[#1e3a5f] mb-1">3. Vérifie les poules</p>
                    <p className="text-sm text-slate-500 mb-3">Tu peux déplacer une équipe avec le menu à côté de son nom.</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {brouillon.poules.map((p, pi) => {
                        const clubsPoule = p.equipes.map((id) => eqs[id]?.clubId);
                        return (
                          <div key={p.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                            <p className="px-3 py-2 bg-[#1e3a5f] text-white font-bold text-sm">{p.nom} · {p.equipes.length}</p>
                            <ul className="divide-y divide-slate-100">
                              {p.equipes.map((id) => {
                                const memeClub = clubsPoule.filter((c) => c === eqs[id]?.clubId).length > 1;
                                return (
                                  <li key={id} className={`px-3 py-2 flex items-center gap-2 ${memeClub ? "bg-amber-50" : ""}`}>
                                    <div className="flex-1 min-w-0"><NomEquipe id={id} equipes={equipes} /></div>
                                    <select className="text-[11px] border border-slate-200 rounded px-1 py-0.5" value={pi} onChange={(e) => deplacer(id, Number(e.target.value))} title="Déplacer">
                                      {brouillon.poules.map((_, k) => <option key={k} value={k}>{lettre(k)}</option>)}
                                    </select>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">Fond orange : deux équipes du même club dans la poule.</p>
                    {!readOnly && (
                      <button onClick={lancer} disabled={busy} className="btn-primary mt-5 w-full !py-3">
                        <Rocket className="w-5 h-5" /> Lancer le tournoi
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ───────── Pendant / après le tournoi ───────── */}
        {live && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow-xl p-4 flex flex-wrap items-center gap-2 text-sm">
              {(() => {
                const n = courante ? courante.poules.reduce((s, p) => s + p.matchs.filter((m) => m.conteste && m.etat !== "valide" && m.par !== "admin").length, 0) : 0;
                return n > 0 ? (
                  <span className="w-full mb-1 rounded-xl bg-red-600 text-white font-bold px-3 py-2 flex items-center gap-2 animate-pulse">
                    ❓ {n} score{n > 1 ? "s" : ""} contesté{n > 1 ? "s" : ""} : va au terrain — repère les matchs encadrés en rouge
                  </span>
                ) : null;
              })()}
              <Monitor className="w-4 h-4 text-[#1e3a5f]" />
              <span className="font-semibold text-[#1e3a5f]">Écran géant pour la salle :</span>
              <button onClick={() => copier(lienEcran, "ecran")} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 flex items-center gap-1">
                {copie === "ecran" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copie === "ecran" ? "Copié" : "Copier le lien"}
              </button>
              <a href={lienEcran} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Ouvrir
              </a>
              <button onClick={() => exporterResultatsPdf(t)} className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 flex items-center gap-1" title="Classement et toutes les poules, prêt à imprimer ou envoyer">
                📄 Résultats en PDF
              </button>
              <button onClick={() => imprimerQrCodes(t)} className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 flex items-center gap-1" title="QR codes des clubs et de l'écran géant, à imprimer">
                🖨 QR codes
              </button>
              {onRefresh && (
                <button onClick={() => onRefresh()} className="ml-auto text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Actualiser (auto toutes les 5 s)
                </button>
              )}
            </div>

            <LiveBoard phases={live.phases} equipes={equipes} termine={live.termine} clubs={clubs} renderAction={renderAction} />

            {!readOnly && !live.termine && courante && (
              <div className="bg-white rounded-3xl shadow-2xl p-5 space-y-4">
                <p className="font-bold text-[#1e3a5f]">
                  Fin de « {courante.nom} » : {courante.poules.reduce((s, p) => s + p.matchs.filter(matchJoue).length, 0)}/{courante.poules.reduce((s, p) => s + p.matchs.length, 0)} matchs joués
                </p>
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><ChevronRight className="w-4 h-4" /> Créer la phase suivante</p>
                  <p className="text-xs text-slate-500">
                    Les équipes sont regroupées selon leur classement : la poule A réunit les meilleures, la dernière poule les suivantes (comme dans votre tableau : 1A, 1B, 2A, 2B…).
                  </p>
                  <div className="flex flex-wrap gap-3 items-center">
                    <input className="input !py-1.5 !text-sm w-40" value={suiteNom} onChange={(e) => setSuiteNom(e.target.value)} placeholder="Nom de la phase" />
                    <select className="input !py-1.5 !text-sm w-auto" value={suitePoules} onChange={(e) => setSuitePoules(Number(e.target.value))}>
                      {Array.from({ length: Math.min(12, Math.floor(nbEquipes / 2)) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} poule{n > 1 ? "s" : ""}</option>)}
                    </select>
                  </div>
                  <FormatChoix f={suiteFormat} set={setSuiteFormat} />
                  <button onClick={phaseSuivante} disabled={busy} className="btn-primary !text-xs !px-5 !py-2.5">
                    <ChevronRight className="w-4 h-4" /> Lancer « {suiteNom || "phase suivante"} » ({formatTexte(suiteFormat)})
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">🚪 Une équipe arrête le tournoi (blessure, départ…)</p>
                  <p className="text-xs text-slate-500">
                    Règlement FFBaD : ses résultats dans la poule sont retirés du classement, elle est classée dernière et ne passe pas à la phase suivante.
                  </p>
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) basculerRetrait(e.target.value); }}
                    className="input !py-1.5 !text-sm w-auto"
                  >
                    <option value="">Choisir l&apos;équipe…</option>
                    {courante.poules.map((p) => (
                      <optgroup key={p.id} label={p.nom}>
                        {p.equipes.filter((id) => !(p.retirees || []).includes(id)).map((id) => (
                          <option key={id} value={id}>{nomEquipe(eqs[id])} ({eqs[id]?.club})</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {courante.poules.some((p) => (p.retirees || []).length > 0) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {courante.poules.flatMap((p) => (p.retirees || []).map((id) => (
                        <span key={id} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                          {nomEquipe(eqs[id])} a arrêté
                          <button onClick={() => basculerRetrait(id)} className="text-blue-600 hover:underline ml-1">annuler</button>
                        </span>
                      )))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={terminer} disabled={busy} className="btn-ghost !text-xs !px-4 !py-2"><Flag className="w-4 h-4" /> Terminer le tournoi (classement final)</button>
                  {phases.length > 1 && (
                    <button onClick={annulerPhase} disabled={busy} className="btn-ghost !text-xs !px-4 !py-2"><Undo2 className="w-4 h-4" /> Annuler « {courante.nom} »</button>
                  )}
                </div>
              </div>
            )}

            {live.termine && (
              <div className="bg-white rounded-2xl shadow-xl p-4 flex flex-wrap gap-2">
                <button onClick={() => copier(texteClassement(), "classement")} className="btn-primary !text-xs !px-4 !py-2">
                  {copie === "classement" ? <Check className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />} Copier le classement final
                </button>
                {!readOnly && (
                  <button onClick={() => enregistrer({ ...live, termine: false, phases: [...phases.slice(0, -1), { ...courante, terminee: false }] })} className="btn-ghost !text-xs !px-4 !py-2">
                    <Undo2 className="w-4 h-4" /> Rouvrir le tournoi
                  </button>
                )}
              </div>
            )}

            {!readOnly && (
              <div className="text-center pb-6">
                <button onClick={reinitialiser} className="text-xs text-red-300 hover:text-red-200 inline-flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Réinitialiser le jour J
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 🕘 Historique d'un match : qui a saisi, corrigé, confirmé, contesté… et à quelle heure */
function HistoriqueMatch({ m, clubs }: { m: LiveMatch; clubs: Record<string, string> }) {
  const [ouvert, setOuvert] = useState(false);
  const h = m.historique || [];
  const score = (sa?: number[], sb?: number[]) => (sa && sb && sa.length ? sa.map((v, i) => `${v}-${sb[i]}`).join(" · ") : "");
  return (
    <div className="mt-1 text-center">
      <button onClick={() => setOuvert(!ouvert)} className="text-[10px] text-slate-400 hover:text-slate-600">
        🕘 Historique ({h.length}) {ouvert ? "▲" : "▼"}
      </button>
      {ouvert && (
        <ol className="mt-1 text-left text-[10px] text-slate-600 bg-white border border-slate-200 rounded-md divide-y divide-slate-100">
          {h.map((e, i) => (
            <li key={i} className="px-2 py-1 flex gap-2">
              <span className="font-mono text-slate-400 shrink-0">{new Date(e.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className="font-semibold shrink-0">{e.par === "admin" ? "Table de marque" : clubs[e.par] || "?"}</span>
              <span className="flex-1">{e.action}</span>
              {score(e.sa, e.sb) && <span className="font-mono font-bold text-[#1e3a5f] shrink-0">{score(e.sa, e.sb)}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
