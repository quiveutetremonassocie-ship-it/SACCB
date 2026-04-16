"use client";

import { BarChart3 } from "lucide-react";

export default function StatsVisites({
  pageviews,
}: {
  pageviews: Record<string, number>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  const todayCount = pageviews[today] || 0;

  const last7 = Array.from({ length: 7 }, (_, i) => daysAgo(i))
    .reduce((sum, d) => sum + (pageviews[d] || 0), 0);

  const last30 = Array.from({ length: 30 }, (_, i) => daysAgo(i))
    .reduce((sum, d) => sum + (pageviews[d] || 0), 0);

  return (
    <div className="glass p-4 md:p-6 border border-purple-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-display text-xl md:text-2xl tracking-wider text-slate-800">Visites du site</h3>
          <p className="text-xs text-slate-400">Nombre de chargements de page</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <StatBox label="Aujourd'hui" value={todayCount} color="text-purple-600" />
        <StatBox label="7 derniers jours" value={last7} color="text-violet-600" />
        <StatBox label="30 derniers jours" value={last30} color="text-indigo-600" />
      </div>

      <p className="text-xs text-slate-400 mt-3">
        ⚠️ Comptage approximatif — chaque chargement de page est compté, visites répétées incluses.
      </p>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-display ${color}`}>{value}</p>
    </div>
  );
}
