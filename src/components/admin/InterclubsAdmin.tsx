"use client";

import { useState } from "react";
import { Plus, Trash2, Copy, Check, RefreshCw, ExternalLink, Upload, ChevronDown, ChevronUp, Lock, Unlock, ClipboardList } from "lucide-react";
import { DB, InterClub, InterClubClub, INTERCLUB_NIVEAUX, getEffectiveConfig } from "@/lib/types";
import { EDGE_FUNCTION_URL, SUPA_KEY } from "@/lib/supabase";
import InterclubLiveAdmin from "./InterclubLiveAdmin";
import { imprimerQrCodes } from "@/lib/interclubQr";

const SITE = "https://saccb.fr";

function nouveauJeton(): string {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...Array.from(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// Code d'accès lisible (sans 0/O, 1/I/L pour éviter les confusions)
function nouveauCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
}
// 📝 Modèle de déroulement pré-rempli : il suffit de compléter les pointillés
const MODELE_DEROULEMENT = `🕗 HORAIRES
• ...h... : accueil des joueurs et pointage
• ...h... : échauffement
• ...h... : début des matchs de poules
• ...h... : pause déjeuner
• ...h... : phases finales
• ...h... : remise des récompenses

🏸 FORMAT
• Poules de ... équipes, puis tableau à élimination directe
• Matchs en ... set(s) de ... points
• Volants fournis : ............ (plumes / plastique)

📋 À SAVOIR
• Arrivée au plus tard à ...h... pour le pointage
• Tenue de sport et chaussures de salle obligatoires
• Buvette sur place : ............
• Parking : ............

📞 CONTACT LE JOUR J
• ............ — ... .. .. .. ..`;

const lienClub = (c: InterClubClub) => `${SITE}/interclub/#${c.token}`;
function messageClub(t: InterClub, c: InterClubClub): string {
  return [
    `Bonjour ${c.nom},`,
    "",
    `Voici votre accès pour inscrire vos binômes au tournoi « ${t.name} »${t.date ? ` du ${new Date(t.date + "T12:00:00").toLocaleDateString("fr-FR")}` : ""} :`,
    `🔗 Lien : ${lienClub(c)}`,
    ...(c.code ? [`🔑 Code d'accès : ${c.code}`] : []),
    `👥 Jusqu'à ${c.quota} binôme${c.quota > 1 ? "s" : ""}${t.dateLimit ? `, inscriptions jusqu'au ${new Date(t.dateLimit + "T12:00:00").toLocaleDateString("fr-FR")}` : ""}.`,
    "",
    "Sportivement,",
    "Le SACCB",
  ].join("\n");
}
const uid = () => (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));

export default function InterclubsAdmin({
  db,
  onPersist,
  adminEmail,
  adminCode,
  readOnly,
  onRefresh,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
  onRefresh?: () => Promise<void>;
}) {
  const list = db.interclubs || [];
  // 🏁 Tournoi dont la table de marque (jour J) est ouverte
  const [jourJ, setJourJ] = useState<string | null>(null);
  // 📂 Clubs dépliés dans la fiche du tournoi
  const [clubsOuverts, setClubsOuverts] = useState<Set<string>>(new Set());
  const basculerClub = (id: string) => setClubsOuverts((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tJourJ = list.find((x) => x.id === jourJ);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [draft, setDraft] = useState<InterClub | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cfg = getEffectiveConfig(db);

  async function persist(next: InterClub[]) {
    await onPersist({ ...db, interclubs: next });
  }

  // 🧪 Tournoi de démonstration : 4 clubs × 5 binômes fictifs, pour essayer le jour J
  async function creerDemo() {
    if (!confirm("Créer un tournoi de démonstration avec 20 équipes fictives (4 clubs) ?\n\nTu pourras le supprimer ensuite.")) return;
    const prenoms = [
      ["Lucas", "Emma"], ["Hugo", "Léa"], ["Louis", "Chloé"], ["Nathan", "Manon"], ["Enzo", "Camille"],
      ["Théo", "Sarah"], ["Tom", "Inès"], ["Maxime", "Jade"], ["Paul", "Lola"], ["Axel", "Zoé"],
      ["Noah", "Clara"], ["Jules", "Alice"], ["Victor", "Anaïs"], ["Gabriel", "Lucie"], ["Arthur", "Julie"],
      ["Raphaël", "Margaux"], ["Adam", "Eva"], ["Antoine", "Pauline"], ["Martin", "Océane"], ["Simon", "Mathilde"],
    ];
    const noms = ["Martin", "Bernard", "Dubois", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier"];
    const clubsDemo = ["SACCB", "Badminton Club Le Havre", "Montivilliers Bad", "Fécamp BC"];
    const dans = (j: number) => new Date(Date.now() + j * 86_400_000).toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const precedent = list.find((x) => x.sallePhotoUrl) || list[0];
    const t: InterClub = {
      id: uid(),
      name: "DÉMO — Tournoi SACCB (à supprimer)",
      date: dans(14),
      type: "Mixte",
      niveaux: [...INTERCLUB_NIVEAUX],
      dateLimit: dans(7),
      deroulement: MODELE_DEROULEMENT,
      salleNom: precedent?.salleNom || cfg.salleName,
      salleAdresse: precedent?.salleAdresse || cfg.salleAdresse,
      sallePhotoUrl: precedent?.sallePhotoUrl,
      sallePhotoPath: precedent?.sallePhotoPath,
      clubs: clubsDemo.map((nom, ci) => ({
        id: uid(),
        nom,
        token: nouveauJeton(),
        code: nouveauCode(),
        quota: 5,
        binomes: Array.from({ length: 5 }, (_, k) => {
          const i = ci * 5 + k;
          return {
            id: uid(),
            joueur1: `${prenoms[i][0]} ${noms[i]}`,
            joueur2: `${prenoms[i][1]} ${noms[(i + 7) % noms.length]}`,
            niveau: INTERCLUB_NIVEAUX[(i + ci) % INTERCLUB_NIVEAUX.length],
            createdAt: now,
          };
        }),
        updatedAt: now,
      })),
      createdAt: now,
    };
    await persist([t, ...list]);
    setOuvert(t.id);
    setDraft(JSON.parse(JSON.stringify(t)));
  }

  async function creer() {
    // 🏟 Reprend la salle et la photo du dernier tournoi (modifiables ensuite)
    const precedent = list.find((x) => x.sallePhotoUrl) || list[0];
    const t: InterClub = {
      id: uid(),
      name: "Tournoi SACCB",
      date: "",
      type: "",
      niveaux: [...INTERCLUB_NIVEAUX],
      dateLimit: "",
      deroulement: MODELE_DEROULEMENT,
      salleNom: precedent?.salleNom || cfg.salleName,
      salleAdresse: precedent?.salleAdresse || cfg.salleAdresse,
      sallePhotoUrl: precedent?.sallePhotoUrl,
      sallePhotoPath: precedent?.sallePhotoPath,
      clubs: [],
      createdAt: new Date().toISOString(),
    };
    await persist([t, ...list]);
    setOuvert(t.id);
    setDraft(t);
  }

  function ouvrir(t: InterClub) {
    if (ouvert === t.id) { setOuvert(null); setDraft(null); return; }
    setOuvert(t.id);
    setDraft(JSON.parse(JSON.stringify(t)));
  }

  // Compare uniquement ce que l'admin modifie dans la fiche (pas les binômes ni le jour J, qui
  // évoluent côté serveur), clés triées : la base peut renvoyer les champs dans un autre ordre.
  const empreinte = (x: InterClub) => {
    const tri = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(tri)
      : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, tri((v as Record<string, unknown>)[k])]))
      : v;
    const { live: _l, closed: _c, ...reste } = x;
    return JSON.stringify(tri({ ...reste, clubs: x.clubs.map(({ binomes: _b, updatedAt: _u, ...c }) => c) }));
  };
  const modifie = (t: InterClub) => !!draft && draft.id === t.id && empreinte(draft) !== empreinte(t);

  async function enregistrer(): Promise<boolean> {
    if (!draft) return false;
    if (!draft.name.trim()) { alert("Donne un nom au tournoi."); return false; }
    if (!draft.type) { alert("Choisis le type du tournoi (mixte, hommes, dames ou libre)."); return false; }
    const bad = draft.clubs.find((c) => !c.nom.trim());
    if (bad) { alert("Chaque club doit avoir un nom."); return false; }
    setBusy(true);
    try {
      // On n'écrase pas les binômes saisis par les clubs entre-temps
      const actuel = list.find((x) => x.id === draft.id);
      const clubs = draft.clubs.map((c) => {
        const live = actuel?.clubs.find((x) => x.id === c.id);
        return live ? { ...c, binomes: live.binomes, updatedAt: live.updatedAt } : c;
      });
      // Le jour J et l'ouverture/fermeture sont gérés à part : on garde la version actuelle
      await persist(list.map((x) => (x.id === draft.id ? { ...draft, clubs, live: actuel?.live, closed: actuel?.closed } : x)));
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function supprimer(t: InterClub) {
    const n = t.clubs.reduce((s, c) => s + c.binomes.length, 0);
    if (!confirm(`Supprimer « ${t.name} » ?${n ? `\n\n⚠️ ${n} binôme(s) inscrit(s) seront perdus.` : ""}\nLes liens envoyés aux clubs ne fonctionneront plus.`)) return;
    await persist(list.filter((x) => x.id !== t.id));
    setOuvert(null);
    setDraft(null);
  }

  async function basculerFerme(t: InterClub) {
    await persist(list.map((x) => (x.id === t.id ? { ...x, closed: !x.closed } : x)));
    if (draft?.id === t.id) setDraft({ ...draft, closed: !t.closed });
  }

  function majDraft(p: Partial<InterClub>) {
    if (draft) setDraft({ ...draft, ...p });
  }
  function majClub(id: string, p: Partial<InterClubClub>) {
    if (draft) setDraft({ ...draft, clubs: draft.clubs.map((c) => (c.id === id ? { ...c, ...p } : c)) });
  }

  async function copier(texte: string, cle: string) {
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      window.prompt("Copie ce texte :", texte);
    }
    setCopie(cle);
    setTimeout(() => setCopie((c) => (c === cle ? null : c)), 2000);
  }

  async function envoyerPhoto(file: File | undefined) {
    if (!file || !draft || !adminEmail || !adminCode) return;
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({
          action: "upload_image", email: adminEmail, code: adminCode, fileData: btoa(bin),
          fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "_"), contentType: file.type || "image/jpeg",
          bucket: "actualities", pathPrefix: "interclub",
        }),
      });
      const r = await res.json();
      if (!r.ok) { alert("Erreur photo : " + (r.reason || "inconnue")); return; }
      majDraft({ sallePhotoUrl: r.url, sallePhotoPath: r.path });
    } finally {
      setBusy(false);
    }
  }

  function texteBinomes(t: InterClub): string {
    const lignes: string[] = [`${t.name}${t.date ? " — " + t.date : ""}`];
    const niveaux = t.niveaux.length ? t.niveaux : [""];
    for (const n of niveaux) {
      const items = t.clubs.flatMap((c) => c.binomes.filter((b) => !n || b.niveau === n).map((b) => `${b.joueur1} / ${b.joueur2} (${c.nom})`));
      if (!items.length) continue;
      lignes.push("", n ? `── ${n} (${items.length}) ──` : `── Binômes (${items.length}) ──`, ...items);
    }
    return lignes.join("\n");
  }

  return (
    <div className="glass p-6 border border-amber-200">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <p className="text-sm text-slate-600 max-w-xl">
          Crée un tournoi, ajoute les clubs invités : chacun reçoit <strong>un lien unique</strong> vers une page où il inscrit
          ses binômes, dans la limite que tu fixes, jusqu&apos;à la date limite.
        </p>
        {!readOnly && (
          <button onClick={creer} className="btn-primary !px-4 !py-2 !text-xs">
            <Plus className="w-4 h-4" /> Nouveau tournoi inter-clubs
          </button>
        )}
        {!readOnly && (
          <button onClick={creerDemo} className="btn-ghost !px-4 !py-2 !text-xs" title="20 équipes fictives réparties dans 4 clubs, pour essayer">
            🧪 Tournoi de démonstration
          </button>
        )}
      </div>

      <div className="space-y-3 mt-4">
        {list.length === 0 && <p className="text-center text-slate-400 py-6 text-sm">Aucun tournoi inter-clubs pour le moment</p>}
        {list.map((t) => {
          const isOpen = ouvert === t.id;
          const d = isOpen && draft?.id === t.id ? draft : t;
          const nbEquipes = t.clubs.reduce((s, c) => s + c.binomes.length, 0);
          const nbPlaces = t.clubs.reduce((s, c) => s + (c.quota || 0), 0);
          return (
            <div key={t.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => ouvrir(t)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 transition text-left">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                  <p className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                    {t.date && <span>📅 {t.date}</span>}
                    <span>🏟 {t.clubs.length} club{t.clubs.length > 1 ? "s" : ""}</span>
                    <span>👥 {nbEquipes}/{nbPlaces} binômes</span>
                    {t.closed && <span className="text-red-600 font-semibold">🔒 Fermé</span>}
                    {t.live && !t.live.termine && <span className="text-red-600 font-bold">🔴 En cours</span>}
                    {t.live?.termine && <span className="text-amber-600 font-bold">🏆 Terminé</span>}
                  </p>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {isOpen && draft && (
                <div className="border-t border-slate-200 p-4 space-y-5">
                  {/* ── Infos du tournoi ── */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <Champ label="Nom du tournoi">
                      <input className="input w-full !text-sm" value={d.name} disabled={readOnly} onChange={(e) => majDraft({ name: e.target.value })} />
                    </Champ>
                    <Champ label="Type">
                      <select className={`input w-full !text-sm ${!d.type ? "!border-red-400 !text-slate-400" : ""}`} value={d.type || ""} disabled={readOnly} onChange={(e) => majDraft({ type: e.target.value })}>
                        <option value="" disabled>— Choisir le type (obligatoire) —</option>
                        <option value="Mixte">👫 Double mixte</option>
                        <option value="Hommes">👬 Double hommes</option>
                        <option value="Femmes">👭 Double dames</option>
                        <option value="Libre">🏸 Double libre</option>
                      </select>
                    </Champ>
                    <Champ label="Date du tournoi">
                      <input type="date" className="input w-full !text-sm" value={d.date} disabled={readOnly} onChange={(e) => majDraft({ date: e.target.value })} />
                    </Champ>
                    <Champ label="Inscriptions jusqu'au (inclus)">
                      <input type="date" className="input w-full !text-sm" value={d.dateLimit || ""} disabled={readOnly} onChange={(e) => majDraft({ dateLimit: e.target.value })} />
                    </Champ>
                  </div>

                  <Champ label="Niveaux proposés (les clubs choisissent un niveau par binôme)">
                    <div className="flex flex-wrap gap-2">
                      {INTERCLUB_NIVEAUX.map((n) => {
                        const on = d.niveaux.includes(n);
                        return (
                          <button
                            key={n}
                            disabled={readOnly}
                            onClick={() => majDraft({ niveaux: on ? d.niveaux.filter((x) => x !== n) : INTERCLUB_NIVEAUX.filter((x) => x === n || d.niveaux.includes(x)) })}
                            className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition ${on ? "bg-[#1e3a5f] text-white border-[#1e3a5f]" : "bg-white text-slate-500 border-slate-300"}`}
                          >
                            {on ? "✓ " : ""}{n}
                          </button>
                        );
                      })}
                    </div>
                  </Champ>

                  <Champ label="Déroulement (horaires, format, règles…) — remplace les pointillés">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          if ((d.deroulement || "").trim() && !confirm("Remplacer le texte actuel par le modèle ?")) return;
                          majDraft({ deroulement: MODELE_DEROULEMENT });
                        }}
                        className="mb-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 hover:bg-blue-100"
                      >
                        📝 Insérer le modèle à compléter
                      </button>
                    )}
                    <textarea
                      className="input w-full !text-sm min-h-[260px] resize-y font-mono"
                      value={d.deroulement || ""}
                      disabled={readOnly}
                      placeholder={"8h30 : accueil des joueurs\n9h : début des poules\n…"}
                      onChange={(e) => majDraft({ deroulement: e.target.value })}
                    />
                  </Champ>

                  {/* ── Salle ── */}
                  <div className="grid md:grid-cols-[1fr_auto] gap-3 items-start">
                    <div className="grid gap-3">
                      <Champ label="Salle">
                        <input className="input w-full !text-sm" value={d.salleNom || ""} disabled={readOnly} onChange={(e) => majDraft({ salleNom: e.target.value })} />
                      </Champ>
                      <Champ label="Adresse (sert pour la carte et l'itinéraire)">
                        <input className="input w-full !text-sm" value={d.salleAdresse || ""} disabled={readOnly} onChange={(e) => majDraft({ salleAdresse: e.target.value })} />
                      </Champ>
                    </div>
                    <div className="w-full md:w-48">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Photo de la salle</p>
                      {d.sallePhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.sallePhotoUrl} alt="" className="w-full h-28 object-cover rounded-lg border border-slate-200" />
                      ) : (
                        <div className="w-full h-28 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">Aucune photo</div>
                      )}
                      {!readOnly && (
                        <div className="flex gap-2 mt-1.5">
                          <label className="flex-1 text-center text-[11px] text-blue-600 cursor-pointer bg-blue-50 border border-blue-200 rounded-md py-1 hover:bg-blue-100">
                            <Upload className="w-3 h-3 inline mr-1" />{d.sallePhotoUrl ? "Changer" : "Ajouter"}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => envoyerPhoto(e.target.files?.[0])} />
                          </label>
                          {d.sallePhotoUrl && (
                            <button onClick={() => majDraft({ sallePhotoUrl: undefined, sallePhotoPath: undefined })} className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-md px-2 hover:bg-red-100">
                              Retirer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Clubs invités ── */}
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Clubs invités</p>
                      {!readOnly && (
                        <button
                          onClick={() => {
                            const id = uid();
                            majDraft({ clubs: [...d.clubs, { id, nom: "", token: nouveauJeton(), code: nouveauCode(), quota: 4, binomes: [] }] });
                            setClubsOuverts((s) => new Set(s).add(id));
                          }}
                          className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Ajouter un club
                        </button>
                      )}
                    </div>
                    {d.clubs.length === 0 && <p className="text-sm text-slate-400 text-center py-3">Aucun club invité</p>}
                    {d.clubs.length > 1 && (
                      <div className="flex justify-end gap-3 mb-2 text-[11px]">
                        <button onClick={() => setClubsOuverts(new Set(d.clubs.map((c) => c.id)))} className="text-blue-600 hover:underline">Tout déplier</button>
                        <button onClick={() => setClubsOuverts(new Set())} className="text-blue-600 hover:underline">Tout replier</button>
                      </div>
                    )}
                    <div className="space-y-2">
                      {d.clubs.map((c) => {
                        const live = t.clubs.find((x) => x.id === c.id);
                        const binomes = live?.binomes || [];
                        const nouveau = !live;
                        const deplie = clubsOuverts.has(c.id);
                        const complet = binomes.length >= c.quota;
                        return (
                          <div key={c.id} className={"bg-white rounded-xl border overflow-hidden " + (deplie ? "border-[#1e3a5f]/40 shadow-sm" : "border-slate-200")}>
                            {/* En-tête du club (toujours visible) */}
                            <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer" onClick={() => basculerClub(c.id)}>
                              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-emerald-600 text-white font-bold flex items-center justify-center">
                                {(c.nom.trim()[0] || "?").toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{c.nom.trim() || <span className="text-slate-400 italic">Nouveau club</span>}</p>
                                <p className="text-[11px] text-slate-500 flex flex-wrap gap-x-2">
                                  <span className={complet ? "text-emerald-600 font-semibold" : ""}>👥 {binomes.length}/{c.quota} binômes</span>
                                  {c.code && <span>🔑 {c.code}</span>}
                                  {nouveau && <span className="text-amber-600 font-semibold">à enregistrer</span>}
                                </p>
                              </div>
                              {live && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); copier(messageClub(t, live), "msg-" + c.id); }}
                                  className="hidden sm:flex text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 items-center gap-1 hover:bg-emerald-100"
                                  title="Message prêt à envoyer au club (lien + code)"
                                >
                                  {copie === "msg-" + c.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copie === "msg-" + c.id ? "Copié" : "Message"}
                                </button>
                              )}
                              {deplie ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                            </div>

                            {deplie && (
                            <div className="border-t border-slate-100 p-3">
                            <div className="grid sm:grid-cols-[1fr_90px_1fr_auto] gap-2 items-end">
                              <Champ label="Club">
                                <input className="input w-full !text-sm" value={c.nom} placeholder="Nom du club" disabled={readOnly} onChange={(e) => majClub(c.id, { nom: e.target.value })} />
                              </Champ>
                              <Champ label="Binômes max">
                                <input type="number" min={1} max={99} className="input w-full !text-sm" value={c.quota} disabled={readOnly}
                                  onChange={(e) => majClub(c.id, { quota: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })} />
                              </Champ>
                              <Champ label="Contact (facultatif)">
                                <input className="input w-full !text-sm" value={c.contact || ""} placeholder="email ou téléphone" disabled={readOnly} onChange={(e) => majClub(c.id, { contact: e.target.value })} />
                              </Champ>
                              {!readOnly && (
                                <button
                                  onClick={() => {
                                    if (binomes.length && !confirm(`Retirer ${c.nom || "ce club"} ? ${binomes.length} binôme(s) inscrit(s) seront perdus.`)) return;
                                    majDraft({ clubs: d.clubs.filter((x) => x.id !== c.id) });
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-500"
                                  title="Retirer ce club"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] text-slate-500 font-semibold">🔑 Code d&apos;accès</span>
                              <input
                                className="input !py-1 !px-2 !text-sm font-mono tracking-widest uppercase w-32"
                                value={c.code || ""}
                                placeholder="aucun"
                                maxLength={40}
                                disabled={readOnly}
                                onChange={(e) => majClub(c.id, { code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                              />
                              {!readOnly && (
                                <button onClick={() => majClub(c.id, { code: nouveauCode() })} className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" /> Générer
                                </button>
                              )}
                              {!c.code && <span className="text-[11px] text-amber-600">Sans code, le lien suffit pour accéder</span>}
                              {live && (live.code || "") !== (c.code || "") && <span className="text-[11px] text-amber-600 font-semibold">Enregistre pour appliquer</span>}
                            </div>

                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <code className="text-[11px] bg-slate-100 rounded px-2 py-1 text-slate-600 truncate max-w-full">{lienClub(c)}</code>
                              {nouveau ? (
                                <span className="text-[11px] text-amber-600 font-semibold">Enregistre pour activer ce lien</span>
                              ) : (
                                <>
                                  <button onClick={() => copier(lienClub(c), c.id)} className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-1 flex items-center gap-1 hover:bg-blue-100">
                                    {copie === c.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copie === c.id ? "Copié" : "Copier le lien"}
                                  </button>
                                  {live && (
                                    <button onClick={() => copier(messageClub(t, live), "msg-" + c.id)} className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 flex items-center gap-1 hover:bg-emerald-100" title="Message prêt à envoyer au club (lien + code)">
                                      {copie === "msg-" + c.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copie === "msg-" + c.id ? "Copié" : "Copier le message (lien + code)"}
                                    </button>
                                  )}
                                  <a href={lienClub(c)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 flex items-center gap-1 hover:bg-slate-100">
                                    <ExternalLink className="w-3 h-3" /> Voir la page
                                  </a>
                                </>
                              )}
                              {!readOnly && !nouveau && (
                                <button
                                  onClick={() => { if (confirm("Créer un nouveau lien ? L'ancien lien ne fonctionnera plus (les binômes déjà inscrits sont conservés).")) majClub(c.id, { token: nouveauJeton() }); }}
                                  className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                                  title="Si le lien a été diffusé par erreur"
                                >
                                  <RefreshCw className="w-3 h-3" /> Nouveau lien
                                </button>
                              )}
                            </div>

                            <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
                              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 flex justify-between gap-2">
                                <span>Binômes inscrits ({binomes.length}/{c.quota})</span>
                                {live?.updatedAt && <span className="normal-case tracking-normal font-normal">modifié le {new Date(live.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>}
                              </p>
                              {binomes.length === 0 ? (
                                <p className="text-xs text-slate-400 px-3 py-2">Aucun binôme inscrit pour l&apos;instant</p>
                              ) : (
                                <ol className="divide-y divide-slate-100">
                                  {binomes.map((b, i) => (
                                    <li key={b.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                                      <span className="w-5 text-[11px] text-slate-400 font-semibold">{i + 1}.</span>
                                      <span className="flex-1 min-w-0 truncate text-slate-700">{b.joueur1} / {b.joueur2}</span>
                                      {b.niveau && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">{b.niveau}</span>}
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                            </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Actions ── */}
                  <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                    <button
                      onClick={() => {
                        if (modifie(t)) {
                          if (!confirm("Tu as des modifications non enregistrées. Les enregistrer et ouvrir le jour J ?")) return;
                          enregistrer().then((ok) => { if (ok) setJourJ(t.id); });
                          return;
                        }
                        setJourJ(t.id);
                      }}
                      className="!px-4 !py-2 !text-xs rounded-xl font-bold uppercase tracking-widest text-white bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90 shadow flex items-center gap-1.5"
                    >
                      🏁 {t.live ? (t.live.termine ? "Résultats du jour J" : "Table de marque (jour J)") : "Jour J : poules & scores"}
                    </button>
                    {!readOnly && (
                      <button onClick={enregistrer} disabled={busy || !modifie(t)} className="btn-primary !px-4 !py-2 !text-xs">
                        <Check className="w-4 h-4" /> {modifie(t) ? "Enregistrer" : "Enregistré"}
                      </button>
                    )}
                    <button onClick={() => copier(texteBinomes(t), "liste-" + t.id)} disabled={nbEquipes === 0} className="btn-ghost !px-4 !py-2 !text-xs">
                      {copie === "liste-" + t.id ? <Check className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />} Copier tous les binômes
                    </button>
                    <button
                      onClick={() => {
                        if (modifie(t) && !confirm("Des modifications ne sont pas enregistrées : les QR codes utiliseront les liens et codes déjà enregistrés. Continuer ?")) return;
                        imprimerQrCodes(t);
                      }}
                      disabled={t.clubs.length === 0}
                      className="btn-ghost !px-4 !py-2 !text-xs"
                      title="Une fiche par club avec QR code + code d'accès (et l'écran géant), à imprimer"
                    >
                      🖨 QR codes à imprimer
                    </button>
                    {!readOnly && (
                      <button onClick={() => basculerFerme(t)} className="btn-ghost !px-4 !py-2 !text-xs">
                        {t.closed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />} {t.closed ? "Rouvrir les inscriptions" : "Fermer les inscriptions"}
                      </button>
                    )}
                    {!readOnly && (
                      <button onClick={() => supprimer(t)} className="btn-danger !px-4 !py-2 !text-xs ml-auto">
                        <Trash2 className="w-4 h-4" /> Supprimer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tJourJ && (
        <InterclubLiveAdmin
          t={tJourJ}
          readOnly={readOnly}
          onRefresh={onRefresh}
          onClose={() => setJourJ(null)}
          onSave={async (live) => {
            await persist(list.map((x) => (x.id === tJourJ.id ? { ...x, live } : x)));
          }}
        />
      )}
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1 block">{label}</span>
      {children}
    </label>
  );
}
