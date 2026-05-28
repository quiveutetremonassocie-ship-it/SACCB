"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const JOURS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const MOIS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];

function parseDateForCalendar(dateStr: string): Date | null {
  if (!dateStr) return null;
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const months: Record<string, number> = {
    janvier: 0, fevrier: 1, "février": 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, aout: 7, "août": 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11, "décembre": 11,
  };
  const m = s.toLowerCase().match(/(\d{1,2})(?:er|e|ème)?\s+([a-zéû]+)\s+(\d{4})/i);
  if (m) {
    const day = parseInt(m[1]);
    const month = months[m[2]];
    const year = parseInt(m[3]);
    if (month !== undefined) return new Date(year, month, day);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function CalendarGrid({
  targetDate,
  displayMonth,
  displayYear,
}: {
  targetDate: Date;
  displayMonth: number;
  displayYear: number;
}) {
  const firstDay = new Date(displayYear, displayMonth, 1);
  const lastDay = new Date(displayYear, displayMonth + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Lundi = 0
  const daysInMonth = lastDay.getDate();

  const targetDay = targetDate.getDate();
  const targetMonth = targetDate.getMonth();
  const targetYear = targetDate.getFullYear();
  const isTargetMonth = displayMonth === targetMonth && displayYear === targetYear;

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const isTodayMonth = displayMonth === todayMonth && displayYear === todayYear;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {JOURS.map((j) => (
          <div key={j} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">
            {j}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const isTarget = isTargetMonth && day === targetDay;
          const isToday = isTodayMonth && day === todayDay;
          return (
            <div
              key={day}
              className={`text-center text-xs py-1.5 rounded-lg transition ${
                isTarget
                  ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold shadow-sm"
                  : isToday
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Mini version (inline sur la carte tournoi)
export function MiniCalendarBadge({ dateStr }: { dateStr: string }) {
  const [expanded, setExpanded] = useState(false);
  const date = parseDateForCalendar(dateStr);
  if (!date) return null;

  const day = date.getDate();
  const monthShort = MOIS[date.getMonth()].slice(0, 3).toUpperCase();

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 hover:border-emerald-400 hover:shadow-md transition shrink-0 group"
        title="Voir le calendrier"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none">
          {monthShort}
        </span>
        <span className="text-xl font-bold text-slate-800 leading-tight group-hover:text-emerald-700 transition">
          {day}
        </span>
      </button>

      {expanded && <CalendarModal date={date} onClose={() => setExpanded(false)} />}
    </>
  );
}

// Modal calendrier agrandi
function CalendarModal({ date, onClose }: { date: Date; onClose: () => void }) {
  const [displayMonth, setDisplayMonth] = useState(date.getMonth());
  const [displayYear, setDisplayYear] = useState(date.getFullYear());

  function prev() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(displayYear - 1); }
    else setDisplayMonth(displayMonth - 1);
  }
  function next() {
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(displayYear + 1); }
    else setDisplayMonth(displayMonth + 1);
  }
  function goToTarget() {
    setDisplayMonth(date.getMonth());
    setDisplayYear(date.getFullYear());
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <button onClick={prev} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button onClick={goToTarget} className="font-display text-lg tracking-wider text-slate-800 hover:text-emerald-600 transition">
            {MOIS[displayMonth]} {displayYear}
          </button>
          <button onClick={next} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <CalendarGrid targetDate={date} displayMonth={displayMonth} displayYear={displayYear} />
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Tournoi le <strong>{date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</strong>
          </p>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
