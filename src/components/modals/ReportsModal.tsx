"use client";

import { useState } from "react";
import { X, FileText, Download, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import type { ReunionReport } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  debut_saison: "📋 Début de saison",
  fin_saison: "📋 Fin de saison",
  ag: "🎤 Assemblée générale",
  rapport_financier: "📊 Rapport financier",
  rapport_moral: "📝 Rapport moral",
  charte: "📜 Charte",
  autre: "📄 Autre",
};

const TYPE_COLORS: Record<string, string> = {
  debut_saison: "bg-emerald-100 text-emerald-700 border-emerald-200",
  fin_saison: "bg-amber-100 text-amber-700 border-amber-200",
  ag: "bg-blue-100 text-blue-700 border-blue-200",
  rapport_financier: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rapport_moral: "bg-blue-100 text-blue-700 border-blue-200",
  charte: "bg-purple-100 text-purple-700 border-purple-200",
  autre: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function ReportsModal({
  reports,
  onClose,
}: {
  reports: ReunionReport[];
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  // Tri : plus récent en premier (par date, ou createdAt en fallback)
  const sorted = [...reports].sort((a, b) => {
    const da = a.date || a.createdAt || "";
    const db = b.date || b.createdAt || "";
    return db.localeCompare(da);
  });

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    // ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-");
      return new Date(`${y}-${m}-${d}`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    }
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 md:p-7 w-full max-w-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-xl tracking-wider text-slate-800">Documents officiels</h3>
              <p className="text-xs text-slate-400">{sorted.length} compte{sorted.length > 1 ? "s" : ""}-rendu{sorted.length > 1 ? "s" : ""} disponible{sorted.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" title="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm italic">Aucun compte-rendu disponible pour le moment.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((r) => {
              const isOpen = openId === r.id;
              const typeLabel = TYPE_LABELS[r.type] || r.type;
              const typeColor = TYPE_COLORS[r.type] || TYPE_COLORS.autre;
              return (
                <li key={r.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenId(isOpen ? null : r.id)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${typeColor}`}>
                          {typeLabel}
                        </span>
                        {r.date && (
                          <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(r.date)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{r.title}</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 mt-1" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50">
                      {r.content && (
                        <div className="bg-white border border-slate-200 rounded-lg p-3 my-2">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                        </div>
                      )}
                      {r.pdfUrl && (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Télécharger le PDF {r.pdfName ? `(${r.pdfName})` : ""}
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-xl py-2 hover:bg-slate-50 transition"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
