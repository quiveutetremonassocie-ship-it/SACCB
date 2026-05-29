"use client";

import { TrendingUp } from "lucide-react";

export default function StatsAdhesions({
  totals,
}: {
  totals: { totalRecolte: number; aPayes: number; aTotal: number; ePayes: number; eTotal: number; reste: number };
}) {
  const total = totals.aTotal + totals.eTotal;
  const adultePct = total > 0 ? Math.round((totals.aTotal / total) * 100) : 0;
  const etudiantPct = total > 0 ? 100 - adultePct : 0;

  return (
    <div className="glass p-4 md:p-6 border border-blue-200 text-center">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-xl md:text-2xl tracking-wider text-slate-800">Stats Adhesions</h3>
      </div>
      <p className="text-4xl md:text-5xl font-display text-emerald-600 my-3">{totals.totalRecolte}&euro;</p>
      <div className="grid grid-cols-2 gap-3">
        <Pill label="Adultes payes" value={`${totals.aPayes} / ${totals.aTotal}`} />
        <Pill label="Etudiants payes" value={`${totals.ePayes} / ${totals.eTotal}`} />
      </div>

      {/* Camembert adultes / étudiants */}
      {total > 0 && (
        <div className="mt-5 flex items-center justify-center gap-6">
          <PieChart adultePct={adultePct} />
          <div className="text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
              <span className="text-xs text-slate-600">Adultes <strong className="text-blue-600">{adultePct}%</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs text-slate-600">Etudiants <strong className="text-emerald-600">{etudiantPct}%</strong></span>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">Reste a percevoir : {totals.reste}&euro;</p>
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

function PieChart({ adultePct }: { adultePct: number }) {
  // SVG donut chart
  const r = 40;
  const c = 2 * Math.PI * r;
  const adulteLen = (adultePct / 100) * c;
  const etudiantLen = c - adulteLen;

  return (
    <svg width="90" height="90" viewBox="0 0 100 100" className="shrink-0">
      {/* Cercle étudiant (fond) */}
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke="#10b981"
        strokeWidth="18"
      />
      {/* Arc adulte */}
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="18"
        strokeDasharray={`${adulteLen} ${etudiantLen}`}
        strokeDashoffset={c / 4}
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
      {/* Texte central */}
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-slate-700 text-xs font-bold" fontSize="14">
        {adultePct}%
      </text>
    </svg>
  );
}
