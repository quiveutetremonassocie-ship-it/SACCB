"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, HelpCircle, Search, MessageCircleQuestion, Send, CheckCircle2, Eye, EyeOff } from "lucide-react";
import type { FaqItem } from "@/lib/types";
import type { MemberSession } from "@/lib/useMemberSession";
import { memberAskFaqQuestion } from "@/lib/db";

export default function FAQ({
  items,
  mode = "preview",
  memberSession,
}: {
  items: FaqItem[];
  // preview = section sur la home (5 questions max + lien)
  // full = page dédiée /faq (toutes les questions + recherche + catégories)
  mode?: "preview" | "full";
  memberSession?: MemberSession | null;
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

        {/* Formulaire "poser une question" — uniquement mode full + membre connecté */}
        {mode === "full" && (
          <AskQuestionBlock memberSession={memberSession} />
        )}
      </div>
    </section>
  );
}

// 💬 Bloc "Poser une question" — visible sur /faq pour les membres connectés
function AskQuestionBlock({ memberSession }: { memberSession?: MemberSession | null }) {
  const [question, setQuestion] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Pré-remplit le code si on a une session valide avec code en mémoire
  // (cas où l'utilisateur vient juste de se connecter dans le même onglet)
  const cachedCode = typeof window !== "undefined"
    ? (memberSession?.adminCode || sessionStorage.getItem("saccb_member_code") || "")
    : "";

  if (!memberSession) {
    return (
      <div className="mt-12 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
        <MessageCircleQuestion className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-semibold mb-1">Vous avez une autre question ?</p>
        <p className="text-xs text-slate-500 mb-3">Connectez-vous à votre espace membre pour la poser au bureau.</p>
        <Link href="/?member=1" className="inline-block bg-[#1e3a5f] hover:bg-[#2d5a8e] text-white text-xs font-semibold px-4 py-2 rounded-lg transition">
          Se connecter
        </Link>
      </div>
    );
  }
  if (memberSession.paid === false) {
    return (
      <div className="mt-12 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
        <p className="text-sm text-amber-800">⏳ Votre adhésion doit être validée pour poser une question au bureau.</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberSession) return;
    // 🔑 Priorité : code saisi manuellement, sinon code en cache de la session
    const finalCode = code.trim() || cachedCode;
    if (!finalCode) {
      setError("Saisissez votre mot de passe pour confirmer votre identité.");
      return;
    }
    if (question.trim().length < 5) {
      setError("Question trop courte.");
      return;
    }
    setSending(true);
    setError("");
    const r = await memberAskFaqQuestion(memberSession.email, finalCode, memberSession.membreId, question.trim());
    setSending(false);
    if (r.ok) {
      setSent(true);
      setQuestion("");
      setCode("");
    } else {
      setError(r.reason || "Erreur lors de l'envoi.");
    }
  }

  if (sent) {
    return (
      <div className="mt-12 bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
        <p className="text-sm text-emerald-800 font-semibold mb-1">Question envoyée !</p>
        <p className="text-xs text-emerald-700">Le bureau y répondra prochainement et la question apparaîtra ici une fois traitée. Vous recevrez un email dès que la réponse sera publiée.</p>
        <button onClick={() => setSent(false)} className="mt-3 text-xs text-emerald-700 underline hover:text-emerald-900">Poser une autre question</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-12 bg-blue-50 border border-blue-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircleQuestion className="w-5 h-5 text-blue-600" />
        <h3 className="text-base font-bold text-slate-800">Une autre question ?</h3>
      </div>
      <p className="text-sm text-slate-600 mb-3">Posez-la au bureau. La question et sa réponse seront ajoutées à la FAQ pour tous les adhérents.</p>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        placeholder="Ex: Est-ce qu'on peut amener un invité à un entraînement ?"
        className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white resize-none"
        maxLength={500}
        required
      />
      <div className="flex items-center justify-between mt-1.5 mb-3">
        <p className="text-[11px] text-slate-500">{question.length}/500 — Connecté en tant que <strong>{memberSession.nom}</strong></p>
      </div>

      {/* 🔒 Code de confirmation : visible uniquement si pas de code en cache (page d'arrivée directe) */}
      {!cachedCode && (
        <div className="mb-3">
          <label className="text-xs text-slate-600 font-medium block mb-1">
            Confirmez votre mot de passe pour valider votre identité
          </label>
          <div className="relative">
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Votre code personnel"
              className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-blue-500 bg-white"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCode((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <button
        type="submit"
        disabled={sending || question.trim().length < 5}
        className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm"
      >
        <Send className="w-4 h-4" />
        {sending ? "Envoi…" : "Envoyer ma question"}
      </button>
    </form>
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
