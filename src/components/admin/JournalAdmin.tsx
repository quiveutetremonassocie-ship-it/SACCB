"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DB } from "@/lib/types";

/** 🕵️ Journal des actions admin — visible uniquement par le propriétaire du site (filtré côté serveur) */
export default function JournalAdmin({ db }: { db: DB }) {
  const [q, setQ] = useState("");
  const [qui, setQui] = useState("");
  const [voir, setVoir] = useState(100);

  // Actions + connexions admin, du plus récent au plus ancien
  const lignes = useMemo(() => {
    const actions = (db.adminJournal || []).map((e) => ({ at: e.at, email: e.email, actions: e.actions }));
    const connexions = (db.adminLoginLog || []).map((c) => ({ at: c.date, email: c.email, actions: ["🔑 Connexion à l'administration"] }));
    return [...actions, ...connexions].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [db.adminJournal, db.adminLoginLog]);
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
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1e3a5f] truncate">{l.email}</p>
                    <ul className="text-slate-700 text-[13px] space-y-0.5">
                      {l.actions.map((a, k) => <li key={k} className="break-words">{a}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {filtres.length > voir && (
        <button onClick={() => setVoir(voir + 200)} className="btn-ghost w-full !text-xs">Voir plus ({filtres.length - voir} restantes)</button>
      )}
      <p className="text-[11px] text-slate-400">Visible uniquement par toi. Les 1000 dernières actions sont conservées.</p>
    </div>
  );
}
