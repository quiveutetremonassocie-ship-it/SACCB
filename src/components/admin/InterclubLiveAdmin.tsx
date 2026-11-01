"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Shuffle, Rocket, Copy, Check, ExternalLink, RefreshCw, ChevronRight, Flag, Undo2, Trash2, Pencil, ClipboardList, Monitor } from "lucide-react";
import { InterClub, InterClubBinome, InterClubLive, LiveFormat, LiveMatch, LivePhase, INTERCLUB_NIVEAUX } from "@/lib/types";
import { interclubSauvegardeMail } from "@/lib/db";
import {
  equipesDuTournoi, genererBrassage, genererPhaseSuivante, matchsPoule, matchJoue, phaseTerminee, formatTexte,
  jetonAleatoire, classementFinal, nomEquipe, lettre, uidLive,
} from "@/lib/interclubLive";
import { LiveBoard, ScoreForm, EquipesMap, NomEquipe } from "../live/LiveBoard";
import ReglageManuel from "./ReglageManuel";
import { exporterResultatsPdf, exporterScoresPdf, lireSauvegardePdf, SauvegardeTournoi } from "@/lib/interclubPdf";
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
  t, onSave, onRefresh, onClose, readOnly, adminEmail, adminCode, onAjouterBinome, onRestaurer,
}: {
  t: InterClub;
  onSave: (live: InterClubLive | undefined) => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  onAjouterBinome?: (clubId: string, b: InterClubBinome, live: InterClubLive) => Promise<void>; // ➕ binôme arrivé en retard
  onRestaurer?: (live: InterClubLive, manquants: { clubId: string; clubNom: string; b: InterClubBinome }[]) => Promise<void>; // ♻️ garde la version actuelle pour pouvoir annuler
  onRefresh?: () => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const live = t.live;
  const eqs = useMemo(() => equipesDuTournoi(t), [t]);
  const equipes: EquipesMap = eqs;
  // « Saisi par » : un club (inter-clubs) ou un binôme (tournoi interne)
  const clubs = useMemo(() => Object.fromEntries([
    ...t.clubs.map((c) => [c.id, c.nom]),
    ...t.clubs.flatMap((c) => c.binomes.map((b) => [b.id, `${b.joueur1} / ${b.joueur2}`])),
  ]), [t]);
  const nbEquipes = Object.keys(eqs).length;
  const [busy, setBusy] = useState(false);
  const [copie, setCopie] = useState<string | null>(null);

  // ── Préparation (avant le lancement) ──
  // 📋 Le programme prévu dans la fiche du tournoi fournit les réglages de chaque tour
  const programme = t.programme || [];
  const [nbPoules, setNbPoules] = useState(Math.max(1, Math.min(programme[0]?.poules ?? Math.round(nbEquipes / 5), Math.floor(nbEquipes / 2) || 1)));
  const [format1, setFormat1] = useState<LiveFormat>(programme[0]?.format ?? { sets: 1, points: 12, cassant: true });
  const [modifier1, setModifier1] = useState(programme.length === 0);
  const [brouillon, setBrouillon] = useState<LivePhase | null>(null);

  // ── Phase suivante ──
  const phases = live?.phases || [];
  const courante = phases[phases.length - 1];
  const prevu = programme[phases.length]; // prochain tour prévu au programme
  const [suiteNom, setSuiteNom] = useState(prevu?.nom ?? (phases.length <= 1 ? "2ᵉ tour" : "Finale"));
  const [suitePoules, setSuitePoules] = useState(prevu?.poules ?? (courante?.poules.length || nbPoules));
  const [suiteFormat, setSuiteFormat] = useState<LiveFormat>(prevu?.format ?? { sets: 3, points: phases.length <= 1 ? 14 : 18, cassant: true });
  const [modifierSuite, setModifierSuite] = useState(false);
  // Quand un tour est lancé, on prépare automatiquement le suivant d'après le programme
  useEffect(() => {
    const p = (t.programme || [])[phases.length];
    if (p) { setSuiteNom(p.nom); setSuitePoules(p.poules); setSuiteFormat(p.format); }
    setModifierSuite(false);
  }, [phases.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [edition, setEdition] = useState<string | null>(null);
  const [tourReglage, setTourReglage] = useState<string | null>(null);

  // ➕ Binôme arrivé en retard (ajouté à son club et à une poule du tour en cours)
  const [retard, setRetard] = useState({ j1: "", j2: "", club: t.clubs[0]?.id || "", niveau: t.niveaux?.[0] || "Intermédiaire", poule: "" });
  async function ajouterRetard() {
    if (!live || !onAjouterBinome) return;
    const cour = live.phases[live.phases.length - 1];
    const poule = cour?.poules.find((p) => p.id === retard.poule) || cour?.poules[0];
    if (!cour || !poule) return;
    if (!retard.j1.trim() || !retard.j2.trim()) { alert("Indique les deux joueurs."); return; }
    const b: InterClubBinome = { id: uidLive(), joueur1: retard.j1.trim().slice(0, 60), joueur2: retard.j2.trim().slice(0, 60), niveau: retard.niveau, createdAt: new Date().toISOString() };
    const club = t.clubs.find((c) => c.id === retard.club) || t.clubs[0];
    if (!club) return;
    if (!confirm(`Ajouter « ${b.joueur1} / ${b.joueur2} » (${club.nom}) dans la ${poule.nom} de « ${cour.nom} » ?\n\n${poule.equipes.length} match(s) contre les équipes de la poule seront créés.`)) return;
    const arrivee = { ...poule, equipes: [...poule.equipes, b.id], matchs: [...poule.matchs, ...poule.equipes.map((autre, k) => (k % 2 ? { id: uidLive(), a: autre, b: b.id } : { id: uidLive(), a: b.id, b: autre }))] };
    setBusy(true);
    try {
      await onAjouterBinome(club.id, b, { ...live, phases: live.phases.map((ph) => (ph.id !== cour.id ? ph : { ...ph, poules: ph.poules.map((p) => (p.id === poule.id ? arrivee : p)) })) });
      setRetard({ ...retard, j1: "", j2: "" });
    } finally { setBusy(false); }
  }

  // 💾 Sauvegarde par mail toutes les 5 min (seulement si quelque chose a changé)
  const [mailAuto, setMailAuto] = useState(true);
  const [dernierMail, setDernierMail] = useState<string | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const empreinteEnvoyee = useRef("");
  const sauvegarderParMail = useRef(async () => {});
  sauvegarderParMail.current = async () => {
    const tt = tRef.current;
    if (!tt.live || !adminEmail || !adminCode || readOnly || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    const empreinte = JSON.stringify(tt.live.phases) + String(tt.live.termine);
    if (empreinte === empreinteEnvoyee.current) return;
    const buf = await exporterScoresPdf(tt, true);
    if (!buf) return;
    const octets = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < octets.length; i += 8192) bin += String.fromCharCode(...octets.subarray(i, i + 8192));
    const r = await interclubSauvegardeMail(adminEmail, adminCode, tt.id, btoa(bin));
    if (r.ok) {
      empreinteEnvoyee.current = empreinte;
      if (!r.ignore) setDernierMail(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    }
  };
  useEffect(() => {
    if (!live || !mailAuto) return;
    const iv = setInterval(() => { sauvegarderParMail.current().catch(() => {}); }, 5 * 60_000);
    return () => clearInterval(iv);
  }, [!!live, mailAuto]); // eslint-disable-line react-hooks/exhaustive-deps
  // Fin du tournoi : sauvegarde finale tout de suite
  useEffect(() => {
    if (live?.termine && mailAuto) sauvegarderParMail.current().catch(() => {});
  }, [live?.termine]); // eslint-disable-line react-hooks/exhaustive-deps // tour choisi dans « Prendre la main » (défaut : en cours)

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
  }

  const scoresTour = (ph: LivePhase) => ph.poules.reduce((s, p) => s + p.matchs.filter(matchJoue).length, 0);

  async function annulerPhase() {
    if (!live || phases.length < 2) return;
    const n = scoresTour(courante);
    if (!confirm(`Annuler « ${courante.nom} » et revenir à « ${phases[phases.length - 2].nom} » ?${n > 0 ? `\n\n⚠️ Les ${n} score(s) déjà saisis dans « ${courante.nom} » seront effacés.` : ""}\n\n« ${phases[phases.length - 2].nom} » redevient le tour en cours : tu pourras tout y modifier, puis relancer le tour suivant.`)) return;
    const prec = { ...phases[phases.length - 2], terminee: false };
    await enregistrer({ ...live, phases: [...phases.slice(0, -2), prec] });
  }

  async function refaireTour() {
    if (!live || phases.length < 2) return;
    const prec = phases[phases.length - 2];
    const n = scoresTour(courante);
    if (!confirm(`Refaire les poules de « ${courante.nom} » d'après le classement actuel de « ${prec.nom} » ?\n\nMême nombre de poules et même format.${n > 0 ? `\n\n⚠️ Les ${n} score(s) déjà saisis dans « ${courante.nom} » seront effacés.` : ""}`)) return;
    const nouvelle = genererPhaseSuivante(prec, Math.max(1, courante.poules.length), courante.format, courante.nom);
    await enregistrer({ ...live, phases: [...phases.slice(0, -1), nouvelle] });
  }

  async function terminer() {
    if (!live || !courante) return;
    if (!phaseTerminee(courante) && !confirm("Tous les matchs n'ont pas de score. Terminer quand même ?")) return;
    await enregistrer({ ...live, termine: true, phases: [...phases.slice(0, -1), { ...courante, terminee: true }] });
  }

  // ♻️ Remettre un jour J sauvegardé (PDF « Tous les scores » ou version d'avant la réinitialisation)
  const fichierPdf = useRef<HTMLInputElement>(null);
  async function restaurer(l: InterClubLive, origine: string, autreTournoi?: string, sauvClubs?: SauvegardeTournoi["clubs"]) {
    // Un PDF d'un autre tournoi mélangerait deux tournois : refusé
    if (autreTournoi) {
      alert(`❌ Ce PDF appartient à un autre tournoi : « ${autreTournoi} ».

Pour éviter de mélanger deux tournois, il ne peut pas être restauré ici. Ouvre la table de marque de « ${autreTournoi} » et restaure-le là-bas.`);
      return;
    }
    const ids = [...new Set(l.phases.flatMap((ph) => ph.poules.flatMap((p) => p.equipes)))];
    // 👥 Binômes du PDF absents de ce tournoi : on les remet dans leur club (rien n'est retiré)
    const manquants = (sauvClubs || []).flatMap((c) => c.binomes.filter((b) => ids.includes(b.id) && !eqs[b.id]).map((b) => ({ clubId: c.id, clubNom: c.nom, b })));
    const retrouves = new Set(manquants.map((m) => m.b.id));
    const inconnues = ids.filter((id) => !eqs[id] && !retrouves.has(id)).length;
    // Aucun binôme ne correspond (PDF d'un autre tournoi, sans les noms) : on refuse plutôt que de tout afficher « Équipe retirée »
    if (ids.length && inconnues === ids.length) {
      alert(`❌ Restauration refusée : aucun binôme de ce ${autreTournoi ? `PDF (tournoi « ${autreTournoi} »)` : "fichier"} n'existe dans ce tournoi.\n\nTous les binômes apparaîtraient « Équipe retirée ». Vérifie que tu as choisi le PDF de CE tournoi.`);
      return;
    }
    const joues = l.phases.reduce((s, ph) => s + ph.poules.reduce((n, p) => n + p.matchs.filter(matchJoue).length, 0), 0);
    if (!confirm(
      `Remettre le tournoi ${origine} ?\n\n• ${l.phases.length} tour(s) : ${l.phases.map((p) => p.nom).join(", ")}\n• ${joues} match(s) avec un score\n• chaque binôme dans sa poule${l.termine ? "\n• tournoi terminé (podium)" : ""}` +
      (autreTournoi ? `\n\n⚠️ Ce PDF vient d'un AUTRE tournoi : « ${autreTournoi} ».` : "") +
      (manquants.length ? `\n\n➕ ${manquants.length} binôme(s) du PDF absents d'ici seront rajoutés à leur club.` : "") +
      (inconnues ? `\n\n⚠️ ${inconnues} binôme(s) du PDF n'existent plus dans ce tournoi (affichés « Équipe retirée »).` : "") +
      (live ? "\n\n↩️ Le jour J actuel est gardé : tu pourras annuler cette restauration." : "")
    )) return;
    // Le lien de l'écran géant actuel reste valable
    const nouveau = { ...l, liveToken: live?.liveToken || l.liveToken };
    setBusy(true);
    try {
      if (onRestaurer) await onRestaurer(nouveau, manquants);
      else await onSave(nouveau);
    } finally { setBusy(false); }
    alert("✅ Tournoi remis en place.");
  }
  async function restaurerDepuisPdf(f: File | undefined) {
    if (!f) return;
    const s = await lireSauvegardePdf(f);
    if (fichierPdf.current) fichierPdf.current.value = "";
    if (!s) { alert("Ce fichier ne contient pas de sauvegarde de tournoi.\n\nUtilise un PDF téléchargé avec le bouton « 📋 Tous les scores en PDF »."); return; }
    await restaurer(s.live, `tel qu'il était le ${new Date(s.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} (PDF)`, s.tournoiId !== t.id ? s.nom : undefined, s.clubs);
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
    if (!confirm(`Déclarer « ${nom} » forfait pour ce match ?\n\nScore enregistré : 0-${ph.format.points}${ph.format.sets === 1 ? "" : `, 0-${ph.format.points}`} et le forfait compte -1 point au classement (règlement du tournoi).`)) return;
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
    if (!deja && !confirm(`« ${nomEquipe(eqs[equipe])} » arrête le tournoi ?\n\nComme le prévoit le règlement du tournoi, tous ses résultats dans la poule sont retirés du classement, elle est classée dernière et ne passe pas à la phase suivante.`)) return;
    const retirees = deja ? (poule.retirees || []).filter((x) => x !== equipe) : [...(poule.retirees || []), equipe];
    await enregistrer({
      ...live,
      phases: live.phases.map((ph) => ph.id !== courante.id ? ph : { ...ph, poules: ph.poules.map((p) => (p.id === poule.id ? { ...p, retirees } : p)) }),
    });
  }

  const renderAction = (m: LiveMatch, ph: LivePhase) => {
    if (readOnly) return null;
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
        <input ref={fichierPdf} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => restaurerDepuisPdf(e.target.files?.[0])} />
        {!live && !readOnly && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-4 md:p-5 space-y-2">
            <p className="font-bold text-amber-900">♻️ Reprendre un tournoi déjà commencé</p>
            {t.liveAvantReset && (
              <button onClick={() => restaurer(t.liveAvantReset!.live, `tel qu'il était avant la réinitialisation du ${new Date(t.liveAvantReset!.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`)} disabled={busy} className="btn-primary !text-sm w-full sm:w-auto">
                ↩️ Remettre le tournoi tel qu&apos;il était avant la {t.liveAvantReset.origine === "restauration" ? "restauration" : "réinitialisation"} ({new Date(t.liveAvantReset.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })})
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => fichierPdf.current?.click()} disabled={busy} className="btn-ghost !text-sm">📥 Restaurer depuis le PDF des scores</button>
              <span className="text-xs text-amber-800">Choisis un PDF « 📋 Tous les scores » : poules, binômes et scores sont remis comme au moment du téléchargement.</span>
            </div>
          </div>
        )}
        {!live && (
          <div className="bg-white rounded-3xl shadow-2xl p-5 md:p-6 space-y-5">
            {nbEquipes < 2 ? (
              <p className="text-center text-slate-500 py-8">Il faut au moins 2 binômes inscrits pour lancer le tournoi.</p>
            ) : (
              <>
                {programme.length > 0 && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                    <p className="font-bold text-[#1e3a5f] mb-2">📋 Programme de la journée ({nbEquipes} binômes)</p>
                    <ol className="space-y-1 text-sm">
                      {programme.map((p, i) => (
                        <li key={i} className="flex gap-2 items-center">
                          <span className="w-6 h-6 shrink-0 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                          <span><strong>{p.nom}</strong> — {p.poules} poule{p.poules > 1 ? "s" : ""} · {formatTexte(p.format)}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="text-[11px] text-slate-500 mt-2">Chaque tour se lancera en un clic avec ces réglages. Pour changer le programme : fiche du tournoi.</p>
                  </div>
                )}
                {programme.length > 0 && !modifier1 ? (
                  <button onClick={() => setModifier1(true)} className="text-xs text-slate-500 hover:text-slate-700 underline">Modifier exceptionnellement le 1er tour</button>
                ) : (
                <>
                <div>
                  <p className="font-bold text-[#1e3a5f] mb-1">Les poules du premier tour</p>
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
                  <p className="font-bold text-[#1e3a5f] mb-2">Format des matchs</p>
                  <FormatChoix f={format1} set={(f) => { setFormat1(f); if (brouillon) setBrouillon({ ...brouillon, format: f }); }} />
                </div>
                </>
                )}
                <button onClick={() => setBrouillon(genererBrassage(t, nbPoules, format1, programme[0]?.nom || "Brassage"))} className="btn-primary !text-xs !px-5 !py-2.5">
                  <Shuffle className="w-4 h-4" /> {brouillon ? "Refaire le tirage" : "Générer les poules"}
                </button>

                {brouillon && (
                  <div className="border-t border-slate-200 pt-5">
                    <p className="font-bold text-[#1e3a5f] mb-1">Vérifie les poules</p>
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
                        <Rocket className="w-5 h-5" /> C&apos;est parti : lancer « {brouillon.nom} »
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
              <button onClick={() => exporterResultatsPdf(t)} className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 flex items-center gap-1" title="Classement final de toutes les équipes, prêt à imprimer ou envoyer">
                📄 Classement en PDF
              </button>
              <button onClick={() => exporterScoresPdf(t)} className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 rounded-md px-2 py-1 flex items-center gap-1" title="Tous les scores de chaque match, tour par tour : à garder pour tout ressaisir si le tournoi doit être relancé">
                📋 Tous les scores en PDF
              </button>
              <button onClick={() => imprimerQrCodes(t)} className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 flex items-center gap-1" title="QR codes des clubs et de l'écran géant, à imprimer">
                🖨 QR codes
              </button>
              {adminEmail && adminCode && !readOnly && (
                <label className="w-full sm:w-auto order-last sm:order-none text-[11px] text-slate-600 flex items-center gap-1.5 cursor-pointer select-none" title="Le PDF « Tous les scores » (restaurable) est envoyé par mail au propriétaire du site toutes les 5 minutes, s'il y a du nouveau">
                  <input type="checkbox" checked={mailAuto} onChange={(e) => setMailAuto(e.target.checked)} />
                  💾 Sauvegarde par mail toutes les 5 min{dernierMail ? ` · dernière à ${dernierMail}` : ""}
                </label>
              )}
              {onRefresh && (
                <button onClick={() => onRefresh()} className="ml-auto text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Actualiser (auto toutes les 5 s)
                </button>
              )}
            </div>

            <LiveBoard phases={live.phases} equipes={equipes} termine={live.termine} clubs={clubs} renderAction={renderAction} />

            {!readOnly && live.termine && (
              <p className="rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-4 py-2.5">
                🏁 Tournoi terminé, mais tout reste corrigeable : scores (« Corriger » sous chaque match), classements, poules et format dans « ✋ Prendre la main ». Le podium et le palmarès se mettent à jour tout seuls. Pour relancer un tour : « Rouvrir le tournoi ».
              </p>
            )}
            {!readOnly && courante && (
              <ReglageManuel
                phase={phases.find((p) => p.id === tourReglage) || courante}
                tours={phases.map((p) => ({ id: p.id, nom: p.nom }))}
                onTour={setTourReglage}
                equipes={equipes}
                busy={busy}
                onSave={(ph) => enregistrer({ ...live, phases: live.phases.map((p) => (p.id === ph.id ? ph : p)) })}
              />
            )}
            {!readOnly && !live.termine && phases.length > 1 && (
              <div className="bg-white rounded-2xl shadow-xl p-4 space-y-2">
                <p className="text-sm font-bold text-[#1e3a5f]">✏️ Modifier un tour déjà joué</p>
                <p className="text-xs text-slate-600">
                  Les scores de « {phases.slice(0, -1).map((p) => p.nom).join(" », « ")} » restent modifiables : clique sur l&apos;onglet du tour au-dessus des poules, puis « Corriger ».
                  Les poules et le classement se règlent dans « ✋ Prendre la main » (choisis le tour). Les poules de « {courante.nom} » ne bougent pas toutes seules : si les changements modifient qui va où, refais-les.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={refaireTour} disabled={busy} className="btn-ghost !text-xs !px-4 !py-2">🔄 Refaire les poules de « {courante.nom} » avec les nouveaux résultats</button>
                  <button onClick={annulerPhase} disabled={busy} className="btn-ghost !text-xs !px-4 !py-2"><Undo2 className="w-4 h-4" /> Revenir à « {phases[phases.length - 2].nom} »</button>
                </div>
              </div>
            )}
            {!readOnly && !live.termine && courante && (
              <div className="bg-white rounded-3xl shadow-2xl p-5 space-y-4">
                {(() => {
                  const joues = courante.poules.reduce((s, p) => s + p.matchs.filter(matchJoue).length, 0);
                  const total = courante.poules.reduce((s, p) => s + p.matchs.length, 0);
                  const fini = phaseTerminee(courante);
                  const suivant = programme[phases.length];
                  return (
                    <div className={`rounded-2xl p-4 ${fini ? "bg-emerald-50 border-2 border-emerald-400" : "bg-slate-50 border border-slate-200"}`}>
                      <p className="font-bold text-[#1e3a5f]">
                        {fini ? `✅ « ${courante.nom} » terminé` : `« ${courante.nom} » en cours : ${joues}/${total} matchs joués`}
                      </p>
                      {suivant ? (
                        <>
                          <p className="text-sm text-slate-600 mt-1">Prochain tour prévu : <strong>{suiteNom}</strong> — {suitePoules} poule{suitePoules > 1 ? "s" : ""} · {formatTexte(suiteFormat)}</p>
                          <button onClick={phaseSuivante} disabled={busy} className={`mt-3 w-full !py-3 ${fini ? "btn-primary" : "btn-ghost"}`}>
                            <ChevronRight className="w-5 h-5" /> Lancer « {suiteNom} »
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-slate-600 mt-1">C&apos;est le dernier tour du programme.</p>
                          <button onClick={terminer} disabled={busy} className={`mt-3 w-full !py-3 ${fini ? "btn-primary" : "btn-ghost"}`}>
                            <Flag className="w-5 h-5" /> Terminer le tournoi et afficher le podium
                          </button>
                        </>
                      )}
                      {!fini && <p className="text-[11px] text-slate-500 mt-2 text-center">Le bouton reste utilisable si un match ne peut pas être joué (il comptera comme non joué).</p>}
                    </div>
                  );
                })()}
                {!modifierSuite ? (
                  <button onClick={() => setModifierSuite(true)} className="text-xs text-slate-500 hover:text-slate-700 underline">
                    {programme[phases.length] ? "Modifier exceptionnellement le prochain tour" : "Ajouter un tour supplémentaire"}
                  </button>
                ) : (
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><ChevronRight className="w-4 h-4" /> Réglages du prochain tour</p>
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
                )}
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">🚪 Une équipe arrête le tournoi (blessure, départ…)</p>
                  <p className="text-xs text-slate-500">
                    Règlement du tournoi : ses résultats dans la poule sont retirés du classement, elle est classée dernière et ne passe pas à la phase suivante.
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
                {onAjouterBinome && (
                  <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                    <p className="text-sm font-semibold text-slate-700">➕ Un binôme arrive en retard</p>
                    <p className="text-xs text-slate-500">Il est ajouté à son club et placé dans la poule choisie de « {courante.nom} » : ses matchs contre les équipes de la poule sont créés tout seuls.</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input className="input !py-1.5 !text-sm" placeholder="Joueur 1 (prénom nom)" value={retard.j1} onChange={(e) => setRetard({ ...retard, j1: e.target.value })} />
                      <input className="input !py-1.5 !text-sm" placeholder="Joueur 2 (prénom nom)" value={retard.j2} onChange={(e) => setRetard({ ...retard, j2: e.target.value })} />
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {t.clubs.length > 1 && (
                        <select className="input !py-1.5 !text-sm w-auto" value={retard.club} onChange={(e) => setRetard({ ...retard, club: e.target.value })}>
                          {t.clubs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                        </select>
                      )}
                      <select className="input !py-1.5 !text-sm w-auto" value={retard.niveau} onChange={(e) => setRetard({ ...retard, niveau: e.target.value })}>
                        {(t.niveaux?.length ? t.niveaux : [...INTERCLUB_NIVEAUX]).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <select className="input !py-1.5 !text-sm w-auto" value={retard.poule || courante.poules[0]?.id} onChange={(e) => setRetard({ ...retard, poule: e.target.value })}>
                        {courante.poules.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.equipes.length} équipes)</option>)}
                      </select>
                      <button onClick={ajouterRetard} disabled={busy || !retard.j1.trim() || !retard.j2.trim()} className="btn-primary !text-xs !px-4 !py-2 disabled:opacity-50">Ajouter</button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {programme[phases.length] && (
                    <button onClick={terminer} disabled={busy} className="btn-ghost !text-xs !px-4 !py-2"><Flag className="w-4 h-4" /> Terminer le tournoi maintenant</button>
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
              <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-white flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-bold text-sm">⏹ Arrêter le jour J (fausse manip, tout recommencer)</p>
                  <p className="text-xs text-white/70">Efface les poules et tous les scores. Les binômes inscrits sont conservés et les inscriptions se rouvrent : tu pourras relancer quand tu veux. Le site garde la version effacée et propose de la remettre.</p>
                </div>
                {t.liveAvantReset?.origine === "restauration" && (
                  <button
                    onClick={() => restaurer(t.liveAvantReset!.live, `tel qu'il était avant la restauration du ${new Date(t.liveAvantReset!.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`)}
                    disabled={busy}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-amber-950 hover:bg-amber-300 inline-flex items-center gap-1.5"
                  >
                    ↩️ Annuler la restauration du {new Date(t.liveAvantReset.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </button>
                )}
                <button onClick={() => fichierPdf.current?.click()} disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 inline-flex items-center gap-1.5" title="Remettre le tournoi tel qu'il était dans un PDF « Tous les scores »">
                  📥 Restaurer depuis le PDF des scores
                </button>
                <button onClick={reinitialiser} className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 inline-flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> Arrêter et réinitialiser
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
