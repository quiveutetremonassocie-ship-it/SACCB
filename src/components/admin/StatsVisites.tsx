"use client";

import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import type { AnalyticsDay } from "@/lib/types";

export default function StatsVisites({
  analyticsDaily,
}: {
  analyticsDaily?: AnalyticsDay[];
}) {
  const [open, setOpen] = useState(false);
  const data = analyticsDaily ?? [];

  const { today, last7, last30, topPaths, topRefs, devices, spark } = useMemo(() => {
    const t = new Date().toISOString().slice(0, 10);
    const daysAgo = (n: number) => {
      const d = new Date(); d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const map = new Map(data.map((e) => [e.date, e]));
    const todayE = map.get(t);
    const sum = (n: number) =>
      Array.from({ length: n }, (_, i) => map.get(daysAgo(i))?.views || 0).reduce((a, b) => a + b, 0);

    // Aggregations sur 30 jours
    const paths: Record<string, number> = {};
    const refs: Record<string, number> = {};
    const devs: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const e = map.get(daysAgo(i));
      if (!e) continue;
      for (const [k, v] of Object.entries(e.paths || {})) paths[k] = (paths[k] || 0) + (v as number);
      for (const [k, v] of Object.entries(e.refs || {})) refs[k] = (refs[k] || 0) + (v as number);
      for (const [k, v] of Object.entries(e.devices || {})) devs[k] = (devs[k] || 0) + (v as number);
    }
    const topPaths = Object.entries(paths).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topRefs = Object.entries(refs).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Sparkline 14 jours
    const spark = Array.from({ length: 14 }, (_, i) => map.get(daysAgo(13 - i))?.views || 0);

    return {
      today: todayE?.views || 0,
      last7: sum(7),
      last30: sum(30),
      topPaths,
      topRefs,
      devices: devs,
      spark,
    };
  }, [data]);

  const maxSpark = Math.max(1, ...spark);
  const totalDev = Math.max(1, (devices.mobile || 0) + (devices.desktop || 0) + (devices.tablet || 0));

  return (
    <div className="glass p-3 md:p-4 border border-purple-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 text-left"
        aria-expanded={open}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base md:text-lg tracking-wider text-slate-800">Analytics</h3>
          <p className="text-[11px] text-slate-500">
            Aujourd&apos;hui <b className="text-purple-600">{today}</b> · 7j <b className="text-violet-600">{last7}</b> · 30j <b className="text-indigo-600">{last30}</b>
          </p>
        </div>
        {/* Sparkline mini */}
        <div className="hidden sm:flex items-end gap-[2px] h-8" aria-hidden>
          {spark.map((v, i) => (
            <div
              key={i}
              className="w-1 rounded-sm bg-gradient-to-t from-purple-300 to-violet-500"
              style={{ height: `${Math.max(2, (v / maxSpark) * 100)}%` }}
              title={`${v}`}
            />
          ))}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-slate-200 grid gap-3 md:grid-cols-3">
          <Panel title="📄 Pages les + vues (30j)">
            {topPaths.length === 0 ? <Empty /> : topPaths.map(([p, n]) => (
              <Row key={p} k={p === "/" ? "Accueil" : p} v={n} />
            ))}
          </Panel>
          <Panel title="🔗 Sources (30j)">
            {topRefs.length === 0 ? <Empty /> : topRefs.map(([r, n]) => (
              <Row key={r} k={r} v={n} />
            ))}
          </Panel>
          <Panel title="📱 Appareils (30j)">
            {(["mobile", "desktop", "tablet"] as const).map((k) => {
              const v = devices[k] || 0;
              const pct = Math.round((v / totalDev) * 100);
              return (
                <div key={k} className="mb-1.5">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span className="capitalize">{k}</span><span>{v} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-400 to-violet-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">{title}</p>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between gap-2 text-xs text-slate-700 truncate">
      <span className="truncate">{k}</span><b className="text-purple-700 shrink-0">{v}</b>
    </div>
  );
}
function Empty() {
  return <p className="text-[11px] text-slate-400 italic">Aucune donnée</p>;
}
