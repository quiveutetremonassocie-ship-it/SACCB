"use client";

import { TrendingUp } from "lucide-react";

export default function StatsAdhesions({
  totals,
}: {
  totals: { totalRecolte: number; aPayes: number; aTotal: number; ePayes: number; eTotal: number; reste: number };
}) {
  return (
    <div className="glass p-4 md:p-6 border border-blue-200 text-center">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-xl md:text-2xl tracking-wider text-slate-800">Stats Adhésions</h3>
      </div>
      <p className="text-4xl md:text-5xl font-display text-emerald-600 my-3">{totals.totalRecolte}€</p>
      <div className="grid grid-cols-2 gap-3">
        <Pill label="Adultes payés" value={`${totals.aPayes} / ${totals.aTotal}`} />
        <Pill label="Étudiants payés" value={`${totals.ePayes} / ${totals.eTotal}`} />
      </div>
      <p className="text-xs text-slate-400 mt-4">Reste à percevoir : {totals.reste}€</p>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl text-blue-600 font-bold">{value}</p>
    </div>
  );
}
