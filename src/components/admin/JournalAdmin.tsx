"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DB } from "@/lib/types";
import { adminEspace, adminEspaceAnalyse, adminEspaceCompresser, adminEspaceSupprimer, adminJournalAnnuler, AnalyseEspace, EspaceServeur } from "@/lib/db";
import { SUPA_URL } from "@/lib/supabase";

/** Recompresse une photo (1600 px max) ; null si le gain est trop faible */
async function recompresser(url: string, type: string): Promise<{ base64: string; type: string } | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
  await img.decode();
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const sortie = type === "image/jpeg" ? "image/jpeg" : "image/webp"; // PNG → WebP (garde la transparence)
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, sortie, 0.82));
  if (!blob) return null;
  const o = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < o.length; i += 0x8000) bin += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return { base64: btoa(bin), type: sortie };
}

/** 🧹 Libérer de l'espace : photos recompressées (rien n'est supprimé) + fichiers que plus rien n'utilise */
function LibererEspace({ adminEmail, adminCode, onFini }: { adminEmail: string; adminCode: string; onFini: () => void }) {
  const [a, setA] = useState<AnalyseEspace | null>(null);
  const [enCours, setEnCours] = useState("");
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const cle = (f: { bucket: string; path: string }) => f.bucket + "/" + f.path;

  async function analyser() {
    setEnCours("Analyse…");
    const r = await adminEspaceAnalyse(adminEmail, adminCode);
    setEnCours("");
    setA(r);
    // Factures (justificatifs) jamais cochées d'office
    setCoches(new Set((r.orphelins || []).filter((f) => f.bucket !== "factures").map(cle)));
  }

  async function compresser() {
    const photos = a?.photos || [];
    let gagne = 0, faites = 0;
    const erreurs: string[] = [];
    for (const [i, p] of photos.entries()) {
      setEnCours(`Compression ${i + 1}/${photos.length}…`);
      try {
        const c = await recompresser(`${SUPA_URL}/storage/v1/object/public/actualities/${p.path.split("/").map(encodeURIComponent).join("/")}`, p.type);
        if (!c) continue;
        const r = await adminEspaceCompresser(adminEmail, adminCode, p.path, c.type, c.base64);
        if (r.ok && !r.ignore && r.avant && r.apres) { gagne += r.avant - r.apres; faites++; }
        else if (!r.ok) erreurs.push(p.path);
      } catch { erreurs.push(p.path); }
    }
    setEnCours("");
    alert(`✅ ${faites} photo(s) recompressée(s) : ${mo(gagne)} libérés.${erreurs.length ? `\n⚠️ ${erreurs.length} photo(s) laissée(s) telles quelles.` : ""}`);
    onFini();
    analyser();
  }

  async function supprimer() {
    const choisis = (a?.orphelins || []).filter((f) => coches.has(cle(f)));
    if (!choisis.length) return;
    const total = choisis.reduce((s, f) => s + f.taille, 0);
    if (!confirm(`Supprimer ${choisis.length} fichier(s) que plus rien n'utilise sur le site (${mo(total)}) ?\n\n• ${choisis.slice(0, 10).map((f) => f.path.split("/").pop()).join("\n• ")}${choisis.length > 10 ? "\n…" : ""}\n\nIls restent dans les sauvegardes complètes déjà téléchargées.`)) return;
    setEnCours("Suppression…");
    const r = await adminEspaceSupprimer(adminEmail, adminCode, choisis.map(({ bucket, path }) => ({ bucket, path })));
    setEnCours("");
    if (!r.ok) { alert(r.reason || "Suppression impossible."); return; }
    alert(`✅ ${r.supprimes} fichier(s) supprimé(s) : ${mo(r.octets || 0)} libérés.${r.ignores ? `\n${r.ignores} fichier(s) gardé(s) car ils sont de nouveau utilisés.` : ""}`);
    onFini();
    analyser();
  }

  if (!a) {
    return (
      <button onClick={analyser} disabled={!!enCours} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100">
        {enCours || "🧹 Libérer de l'espace"}
      </button>
    );
  }
  if (!a.ok) return <p className="text-xs text-red-600">{a.reason || "Analyse impossible."}</p>;
  const photos = a.photos || [], orphelins = a.orphelins || [];
  const DOSS: Record<string, string> = { actualities: "Photos", factures: "Factures", reports: "PDF" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-slate-700">🧹 Libérer de l&apos;espace</p>
        <button onClick={() => setA(null)} className="text-xs text-slate-500 hover:text-slate-800">Fermer</button>
      </div>
      {enCours && <p className="text-xs text-blue-700 font-semibold">{enCours}</p>}

      <div className="space-y-1">
        <p className="font-semibold text-slate-700">📷 Photos des actualités trop lourdes</p>
        {photos.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune : toutes les photos sont déjà légères.</p>
        ) : (
          <>
            <p className="text-xs text-slate-500">{photos.length} photo(s) · {mo(photos.reduce((s, p) => s + p.taille, 0))}. Elles sont recompressées et restent au même endroit : rien ne change sur le site, rien n&apos;est supprimé.</p>
            <button onClick={compresser} disabled={!!enCours} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40">Compresser les photos</button>
          </>
        )}
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-slate-700">🗂 Fichiers que plus rien n&apos;utilise</p>
        {orphelins.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun : chaque fichier est utilisé par le site.</p>
        ) : (
          <>
            <p className="text-xs text-slate-500">Fichiers restés sur le serveur alors qu&apos;aucune page ne s&apos;en sert (ex. photo d&apos;une actualité supprimée). Décoche ceux que tu veux garder (les factures ne sont jamais cochées d&apos;office).</p>
            <ul className="max-h-56 overflow-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {orphelins.map((f) => (
                <li key={cle(f)} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                  <input type="checkbox" checked={coches.has(cle(f))} onChange={() => setCoches((s) => { const n = new Set(s); if (n.has(cle(f))) n.delete(cle(f)); else n.add(cle(f)); return n; })} />
                  <span className="text-slate-400 w-14 shrink-0">{DOSS[f.bucket] || f.bucket}</span>
                  {f.bucket === "factures" ? (
                    <span className="flex-1 truncate text-slate-700">{f.path.split("/").pop()}</span>
                  ) : (
                    <a href={`${SUPA_URL}/storage/v1/object/public/${f.bucket}/${f.path.split("/").map(encodeURIComponent).join("/")}`} target="_blank" rel="noopener" className="flex-1 truncate text-blue-700 hover:underline">{f.path.split("/").pop()}</a>
                  )}
                  <span className="text-slate-400 shrink-0">{mo(f.taille)}</span>
                  {f.cree && <span className="text-slate-400 shrink-0 hidden sm:inline">{new Date(f.cree).toLocaleDateString("fr-FR")}</span>}
                </li>
              ))}
            </ul>
            <button onClick={supprimer} disabled={!!enCours || coches.size === 0} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white disabled:opacity-40">
              Supprimer les {coches.size} fichier(s) coché(s)
            </button>
          </>
        )}
      </div>
      <p className="text-[11px] text-slate-400">Les fichiers ajoutés il y a moins de 24 h ne sont jamais proposés (une actualité peut être en cours de rédaction).</p>
    </div>
  );
}

const DOSSIERS: Record<string, string> = { actualities: "Photos des actualités", factures: "Factures (compta)", reports: "PDF (règlements, documents)" };
const nb = (x: number, d: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: d });
const mo = (o: number) => (o < 1_000_000 ? `${nb(Math.max(0.01, o / 1_000_000), 2)} Mo` : o < 1_000_000_000 ? `${nb(o / 1_000_000, 1)} Mo` : `${nb(o / 1_000_000_000, 2)} Go`);

/** 📘 PDF « Fiche du site pour Claude » : description, état actuel et historique des modifications */
function FicheSite({ db, adminEmail, adminCode }: { db: DB; adminEmail?: string; adminCode?: string }) {
  const [enCours, setEnCours] = useState(false);
  async function telecharger() {
    setEnCours(true);
    try {
      const espace = adminEmail && adminCode ? await adminEspace(adminEmail, adminCode).catch(() => null) : null;
      const { telechargerFicheSite } = await import("@/lib/pdfFicheSite");
      await telechargerFicheSite(db, espace);
    } catch {
      alert("Impossible de créer la fiche du site.");
    } finally {
      setEnCours(false);
    }
  }
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-[220px] flex-1">
        <p className="text-sm font-bold text-slate-700">📘 Fiche du site pour Claude</p>
        <p className="text-xs text-slate-500">Un PDF qui explique tout le site (fonctionnement, services utilisés, règles, état actuel, historique des modifications). Donne-le à Claude au début d&apos;une nouvelle conversation. Toujours à jour : il est créé au moment du clic.</p>
      </div>
      <button onClick={telecharger} disabled={enCours} className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#1e3a5f] text-white disabled:opacity-50">
        {enCours ? "Création…" : "📥 Télécharger la fiche (PDF)"}
      </button>
    </div>
  );
}

/** 🚨 Requêtes bloquées par le serveur (trop de requêtes, essais de codes…) */
function RequetesBloquees({ blocages }: { blocages: NonNullable<DB["securiteBlocages"]> }) {
  const [ouvert, setOuvert] = useState(false);
  const [copie, setCopie] = useState(false);
  const semaine = Date.now() - 7 * 86_400_000;
  const recents = blocages.filter((b) => new Date(b.fin).getTime() > semaine);
  const total = recents.reduce((s, b) => s + b.n, 0);
  const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  async function copier() {
    const texte = ["Requêtes bloquées sur saccb.fr :", ...blocages.slice(0, 100).map((b) => `${quand(b.debut)} → ${quand(b.fin)} | ${b.ip} | ${b.action} | ${b.n} fois | ${b.motif}`)].join("\n");
    try { await navigator.clipboard.writeText(texte); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch { alert(texte); }
  }
  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 ${total > 200 ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-bold text-slate-700">
          🚨 Requêtes bloquées{" "}
          <span className="font-normal text-slate-500">
            · {total ? `${total} sur les 7 derniers jours` : "aucune ces 7 derniers jours"}{total > 200 ? " — activité anormale" : ""}
          </span>
        </p>
        <div className="flex gap-3">
          {blocages.length > 0 && <button onClick={copier} className="text-xs text-slate-500 hover:text-slate-800">{copie ? "✔ Copié" : "📋 Copier pour Claude"}</button>}
          {blocages.length > 0 && <button onClick={() => setOuvert((o) => !o)} className="text-xs text-slate-500 hover:text-slate-800">{ouvert ? "Masquer" : `Voir le détail (${blocages.length})`}</button>}
        </div>
      </div>
      {ouvert && (
        <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 sticky top-0">
              <tr><th className="text-left px-2 py-1.5">Quand</th><th className="text-left px-2 py-1.5">Adresse</th><th className="text-left px-2 py-1.5">Demande</th><th className="text-right px-2 py-1.5">Fois</th><th className="text-left px-2 py-1.5">Raison</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {blocages.map((b, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">{quand(b.debut)}{b.fin !== b.debut ? ` → ${new Date(b.fin).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</td>
                  <td className="px-2 py-1.5 font-mono text-slate-600">{b.ip}</td>
                  <td className="px-2 py-1.5 text-slate-700">{b.action}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{b.n}</td>
                  <td className="px-2 py-1.5 text-slate-500">{b.motif}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-400">Le serveur bloque une adresse qui envoie trop de requêtes ou essaie trop de codes. Les blocages sont notés par paquets (toutes les 10 min environ). Adresses partiellement masquées.</p>
    </div>
  );
}

/** 📊 Jauge de place utilisée sur le serveur */
function Jauge({ titre, utilise, limite, details }: { titre: string; utilise: number; limite: number; details?: React.ReactNode }) {
  const pc = Math.min(100, (utilise / limite) * 100);
  const couleur = pc >= 85 ? "bg-red-500" : pc >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex-1 min-w-[240px] rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-slate-700">{titre}</span>
        <span className="text-slate-500 text-xs">{mo(utilise)} / {mo(limite)}</span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${Math.max(pc, 1)}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        <strong className="text-slate-700">{pc < 1 ? "moins de 1" : Math.round(pc)} %</strong> utilisé · reste {mo(Math.max(0, limite - utilise))}
      </p>
      {details}
    </div>
  );
}

function PlaceServeur({ adminEmail, adminCode }: { adminEmail?: string; adminCode?: string }) {
  const [e, setE] = useState<EspaceServeur | null>(null);
  const charger = () => { if (adminEmail && adminCode) { setE(null); adminEspace(adminEmail, adminCode).then(setE); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(charger, [adminEmail, adminCode]);
  if (!adminEmail || !adminCode) return null;
  const fichiers = e?.dossiers ? Object.values(e.dossiers).reduce((s, d) => s + d.octets, 0) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-700">📊 Place sur le serveur</p>
        <button onClick={charger} className="text-xs text-slate-500 hover:text-slate-800">↻ Actualiser</button>
      </div>
      {!e && <p className="text-xs text-slate-500">Calcul en cours…</p>}
      {e && !e.ok && <p className="text-xs text-red-600">{e.reason || "Impossible de lire la place utilisée."}</p>}
      {e?.ok && e.limites && (
        <div className="flex flex-wrap gap-3">
          <Jauge titre="🗄 Base de données" utilise={e.base || 0} limite={e.limites.base}
            details={<p className="text-[11px] text-slate-400 mt-0.5">Adhérents, tournois, scores, réglages, journal… (estimation)</p>} />
          <Jauge titre="📁 Fichiers" utilise={fichiers} limite={e.limites.fichiers}
            details={<ul className="text-[11px] text-slate-500 mt-1 space-y-0.5">
              {Object.entries(e.dossiers || {}).map(([k, d]) => <li key={k}>{DOSSIERS[k] || k} : {d.nombre} fichier{d.nombre > 1 ? "s" : ""} · {mo(d.octets)}</li>)}
            </ul>} />
        </div>
      )}
      {e?.ok && adminEmail && adminCode && <LibererEspace adminEmail={adminEmail} adminCode={adminCode} onFini={charger} />}
      <p className="text-[11px] text-slate-400">Limites de l&apos;offre gratuite Supabase. Le détail officiel est sur supabase.com → ton projet → Usage.</p>
    </div>
  );
}

/** 🕵️ Journal des actions admin — visible uniquement par le propriétaire du site (filtré côté serveur) */
export default function JournalAdmin({ db, adminEmail, adminCode, onRefresh }: { db: DB; adminEmail?: string; adminCode?: string; onRefresh?: () => void | Promise<void> }) {
  const [q, setQ] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);

  async function annuler(at: string, email: string, actions: string[]) {
    if (!adminEmail || !adminCode) { alert("Reconnecte-toi pour annuler une action."); return; }
    const quand = new Date(at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    if (!confirm(`Annuler ce que ${email} a fait le ${quand} ?\n\n• ${actions.slice(0, 8).join("\n• ")}${actions.length > 8 ? "\n…" : ""}\n\nSeul ce changement est remis comme avant. Tout ce qui a été fait ensuite est gardé.`)) return;
    setEnCours(at);
    const r = await adminJournalAnnuler(adminEmail, adminCode, at);
    setEnCours(null);
    if (!r.ok) { alert(r.reason || "Annulation impossible."); return; }
    alert(r.gardes ? `✅ Action annulée. ${r.gardes} élément(s) modifié(s) depuis ont été laissés tels quels pour ne rien écraser.` : "✅ Action annulée : tout est revenu comme avant ce changement.");
    await onRefresh?.();
  }
  const [qui, setQui] = useState("");
  const [voir, setVoir] = useState(100);
  const [avecConnexions, setAvecConnexions] = useState(false);

  // Actions + connexions admin, du plus récent au plus ancien
  const lignes = useMemo(() => {
    const actions = (db.adminJournal || []).map((e) => ({ at: e.at, email: e.email, actions: e.actions, annulable: !!e.annulation && !e.annulee, annulee: e.annulee }));
    const connexions = (db.adminLoginLog || []).map((c) => ({ at: c.date, email: c.email, actions: ["🔑 Connexion à l'administration"], annulable: false, annulee: undefined }));
    return [...actions, ...(avecConnexions ? connexions : [])].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [db.adminJournal, db.adminLoginLog, avecConnexions]);
  const admins = useMemo(() => [...new Set(lignes.map((l) => l.email))].sort(), [lignes]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtres = lignes.filter((l) => (!qui || l.email === qui) && (!q || norm(l.actions.join(" ")).includes(norm(q))));

  const derniere = db.lastBackupExport ? new Date(db.lastBackupExport) : null;
  const heures = derniere ? (Date.now() - derniere.getTime()) / 3_600_000 : Infinity;

  let jourPrec = "";
  return (
    <div className="space-y-4">
      <div className={`rounded-xl px-4 py-3 text-sm border ${heures <= 26 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"}`}>
        💾 <strong>Dernière sauvegarde complète téléchargée :</strong>{" "}
        {derniere ? derniere.toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" }) : "aucune depuis la mise en place du journal"}
        {heures > 26 && <span className="block text-xs mt-0.5">⚠️ Plus de 24 h : vérifie que la sauvegarde de nuit fonctionne toujours.</span>}
      </div>

      <FicheSite db={db} adminEmail={adminEmail} adminCode={adminCode} />
      <PlaceServeur adminEmail={adminEmail} adminCode={adminCode} />
      <RequetesBloquees blocages={db.securiteBlocages || []} />

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input w-full !pl-9 !text-sm" placeholder="Rechercher (nom d'adhérent, facture, tournoi…)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !text-sm w-auto" value={qui} onChange={(e) => setQui(e.target.value)}>
          <option value="">Tous les admins</option>
          {admins.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-600 px-2 cursor-pointer select-none">
          <input type="checkbox" checked={avecConnexions} onChange={(e) => setAvecConnexions(e.target.checked)} />
          Afficher les connexions 🔑
        </label>
      </div>

      {filtres.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-6">Aucune action enregistrée pour l&apos;instant.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {filtres.slice(0, voir).map((l, i) => {
            const d = new Date(l.at);
            const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
            const titre = jour !== jourPrec ? jour : null;
            jourPrec = jour;
            return (
              <div key={i}>
                {titre && <p className="px-4 py-1.5 bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500">{titre}</p>}
                <div className="px-4 py-2 flex gap-3 text-sm">
                  <span className="font-mono text-xs text-slate-400 shrink-0 pt-0.5">{d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#1e3a5f] truncate">{l.email}</p>
                    <ul className={`text-[13px] space-y-0.5 ${l.annulee ? "text-slate-400 line-through" : "text-slate-700"}`}>
                      {l.actions.map((a, k) => <li key={k} className="break-words">{a}</li>)}
                    </ul>
                    {l.annulee && <p className="text-[11px] text-amber-700 mt-0.5">↩️ Annulé le {new Date(l.annulee.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>}
                  </div>
                  {l.annulable && (
                    <button
                      onClick={() => annuler(l.at, l.email, l.actions)}
                      disabled={enCours !== null}
                      className="self-start shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
                      title="Remettre uniquement ce changement comme avant"
                    >
                      {enCours === l.at ? "…" : "↩️ Annuler"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {filtres.length > voir && (
        <button onClick={() => setVoir(voir + 200)} className="btn-ghost w-full !text-xs">Voir plus ({filtres.length - voir} restantes)</button>
      )}
      <p className="text-[11px] text-slate-400">Visible uniquement par toi. Les 1000 dernières actions sont conservées ; les 150 plus récentes peuvent être annulées avec ↩️ (seul ce changement revient en arrière, le reste est gardé). Pour un gros souci : Réglages → Sauvegarde &amp; export → Restaurer.</p>
    </div>
  );
}
