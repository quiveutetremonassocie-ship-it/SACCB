"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DB } from "@/lib/types";
import { adminJournalAnnuler } from "@/lib/db";

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
