"use client";

import { useState } from "react";
import { X, FileText, Download, ChevronDown, ChevronUp } from "lucide-react";
import type { OfficialDoc } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  rapport_financier: "Rapport financier",
  charte: "Charte",
  rapport_moral: "Rapport moral",
  autre: "Document",
};
const TYPE_EMOJIS: Record<string, string> = {
  rapport_financier: "📊",
  charte: "📜",
  rapport_moral: "📝",
  autre: "📄",
};
const TYPE_COLORS: Record<string, string> = {
  rapport_financier: "bg-emerald-100 text-emerald-700 border-emerald-200",
  charte: "bg-purple-100 text-purple-700 border-purple-200",
  rapport_moral: "bg-blue-100 text-blue-700 border-blue-200",
  autre: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function OfficialDocsModal({
  docs,
  onClose,
}: {
  docs: OfficialDoc[];
  onClose: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...docs].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 md:p-7 w-full max-w-2xl my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-xl tracking-wider text-slate-800">Documents officiels</h3>
              <p className="text-xs text-slate-400">
                {sorted.length} document{sorted.length > 1 ? "s" : ""} disponible{sorted.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" title="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm italic">Aucun document disponible pour le moment.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((doc) => {
              const isOpen = openId === doc.id;
              const typeLabel = TYPE_LABELS[doc.type] || "Document";
              const typeEmoji = TYPE_EMOJIS[doc.type] || "📄";
              const typeColor = TYPE_COLORS[doc.type] || TYPE_COLORS.autre;
              return (
                <li key={doc.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenId(isOpen ? null : doc.id)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${typeColor}`}>
                          {typeEmoji} {typeLabel}
                        </span>
                        {doc.saison && (
                          <span className="text-[10px] text-slate-400">Saison {doc.saison}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{doc.title}</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 mt-1" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50">
                      {doc.content && (
                        <div className="bg-white border border-slate-200 rounded-lg p-3 my-2">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{doc.content}</p>
                        </div>
                      )}
                      {doc.pdfUrl && (
                        <a
                          href={doc.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Télécharger le PDF {doc.pdfName ? `(${doc.pdfName})` : ""}
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
