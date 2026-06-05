"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, HelpCircle, Search } from "lucide-react";
import type { FaqItem } from "@/lib/types";

export default function FAQ({
  items,
  mode = "preview",
}: {
  items: FaqItem[];
  // preview = section sur la home (5 questions max + lien)
  // full = page dédiée /faq (toutes les questions + recherche + catégories)
  mode?: "preview" | "full";
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | "all">("all");

  // Tri par ordre puis par question
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const oa = a.order ?? 999, ob = b.order ?? 999;
      if (oa !== ob) return oa - ob;
      return (a.question || "").localeCompare(b.question || "");
    });
  }, [items]);

  // Catégories uniques
  const categories = useMemo(() => {
    const set = new Set<string>();
    sorted.forEach((i) => { if (i.category) set.add(i.category); });
    return Array.from(set).sort();
  }, [sorted]);

  // Filtrage selon la recherche et la catégorie active
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((i) => {
      if (activeCat !== "all" && i.category !== activeCat) return false;
      if (!q) return true;
      return (
        i.question.toLowerCase().includes(q) ||
        i.answer.toLowerCase().includes(q)
      );
    });
  }, [sorted, query, activeCat]);

  // En preview, on limite à 5 questions
  const displayed = mode === "preview" ? filtered.slice(0, 5) : filtered;

  if (sorted.length === 0 && mode === "preview") return null;

  return (
    <section id="faq" className={mode === "full" ? "max-w-3xl mx-auto px-6 py-16" : "bg-section-wrap bg-rules"}>
      <div className={mode === "preview" ? "section-pad relative" : ""}>
        <div className={mode === "full" ? "text-center mb-10" : "text-center mb-10"}>
          {mode === "preview" && (
            <div className="sport-label mb-5">
              <span className="sport-label-dot" />
              <span className="sport-label-text text-blue-600">Aide</span>
            </div>
          )}
          <div className="inline-flex items-center gap-3 mb-4">
            <HelpCircle className="w-8 h-8 text-blue-600" />
            <h2 className={`font-display ${mode === "full" ? "text-5xl md:text-6xl" : "text-5xl md:text-6xl"} h-display`}>
              Questions fréquentes
            </h2>
          </div>
          <p className="text-slate-500 max-w-2xl mx-auto">
            {mode === "preview"
              ? "Tout ce qu'il faut savoir pour vivre votre saison sereinement."
              : "Retrouvez les réponses aux questions les plus courantes des adhérents."}
          </p>
        </div>

        {/* Recherche + catégories — uniquement en mode full */}
        {mode === "full" && (
          <>
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher une question…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-blue-500 bg-white text-sm shadow-sm"
              />
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <CategoryPill active={activeCat === "all"} onClick={() => setActiveCat("all")}>
                  Toutes
                </CategoryPill>
                {categories.map((cat) => (
                  <CategoryPill key={cat} active={activeCat === cat} onClick={() => setActiveCat(cat)}>
                    {cat}
                  </CategoryPill>
                ))}
              </div>
            )}
          </>
        )}

        {/* Liste des questions */}
        {displayed.length === 0 ? (
          <p className="text-center text-slate-400 italic py-8">
            {query.trim() ? `Aucune question ne correspond à « ${query} »` : "Aucune question pour le moment."}
          </p>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {displayed.map((item) => {
              const isOpen = openId === item.id;
              return (
                <div
                  key={item.id}
                  className={`bg-white border ${isOpen ? "border-blue-300 shadow-md" : "border-slate-200"} rounded-2xl overflow-hidden transition`}
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-slate-50 transition"
                  >
                    <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      ?
                    </div>
                    <p className="flex-1 text-sm md:text-base font-semibold text-slate-800 leading-snug">
                      {item.question}
                    </p>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pl-[68px]">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{item.answer}</p>
                      {item.category && (
                        <span className="inline-block mt-3 text-[10px] uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 font-semibold">
                          {item.category}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Lien vers la page complète en mode preview */}
        {mode === "preview" && filtered.length > displayed.length && (
          <div className="text-center mt-8">
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-sm transition"
            >
              Voir toutes les questions
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
        active
          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
      }`}
    >
      {children}
    </button>
  );
}
