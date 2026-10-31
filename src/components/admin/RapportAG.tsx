"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { DB } from "@/lib/types";
import { chiffresSaison, telechargerRapportAg, OptionsRapport } from "@/lib/rapportAg";

/** 📄 Rapport d'activité de la saison, prêt pour l'assemblée générale */
export default function RapportAG({ db }: { db: DB }) {
  const [opt, setOpt] = useState<OptionsRapport>({ tournois: true, palmares: true, finances: true, detailDepenses: false });
  const [enCours, setEnCours] = useState(false);
  const c = useMemo(() => chiffresSaison(db), [db]);

  async function generer() {
    setEnCours(true);
    try { await telechargerRapportAg(db, opt); } catch (e) { alert("Impossible de créer le PDF : " + (e instanceof Error ? e.message : "erreur")); }
    setEnCours(false);
  }

  const caseOpt = (k: keyof OptionsRapport, label: string, disabled = false) => (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : "text-slate-700"} cursor-pointer select-none`}>
      <input type="checkbox" checked={opt[k] && !disabled} disabled={disabled} onChange={(e) => setOpt({ ...opt, [k]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] text-white flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>
        <div>
          <p className="font-semibold text-[#1e3a5f]">Rapport d&apos;activité pour l&apos;AG</p>
          <p className="text-xs text-slate-500">Un PDF prêt à présenter, rempli automatiquement avec les chiffres de la saison {db.y1}-{db.y2}.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          [c.payes, "adhérents"],
          [c.participations, "participations en tournoi"],
          [c.organises.length, "tournois organisés"],
          [c.podiums.length, "podiums"],
        ].map(([v, l]) => (
          <div key={String(l)} className="rounded-xl bg-slate-50 px-3 py-2 text-center">
            <p className="text-xl font-bold text-[#1e3a5f]">{v}</p>
            <p className="text-[11px] text-slate-500 leading-tight">{l}</p>
          </div>
        ))}
      </div>

      <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">Contenu du rapport</p>
      <div className="grid sm:grid-cols-2 gap-1.5 mb-4">
        <label className="flex items-center gap-2 text-sm text-slate-400 select-none"><input type="checkbox" checked disabled /> Adhérents et évolution (toujours inclus)</label>
        {caseOpt("tournois", "Tournois joués et organisés")}
        {caseOpt("palmares", "Palmarès (podiums)")}
        <label className="flex items-center gap-2 text-sm text-slate-400 select-none"><input type="checkbox" checked disabled /> Vie du club (toujours incluse)</label>
        {caseOpt("finances", "Bilan financier")}
        {caseOpt("detailDepenses", "Détail des dépenses", !opt.finances)}
      </div>

      <button onClick={generer} disabled={enCours} className="btn-primary !text-sm w-full sm:w-auto disabled:opacity-50">
        {enCours ? "Création du PDF…" : "📄 Télécharger le rapport (PDF)"}
      </button>
      <p className="text-[11px] text-slate-400 mt-2">Astuce : à faire juste avant l&apos;AG et avant de démarrer la nouvelle saison (les chiffres sont ceux de la saison en cours).</p>
    </div>
  );
}
