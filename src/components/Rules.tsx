"use client";

import { motion } from "framer-motion";
import { ScrollText, Lock, FileDown } from "lucide-react";
import { MemberSession } from "@/lib/useMemberSession";

export default function Rules({
  clubRules = "",
  clubRulesPdfUrl,
  clubRulesPdfName,
  memberSession,
  onLoginRequest,
}: {
  clubRules?: string;
  clubRulesPdfUrl?: string;
  clubRulesPdfName?: string;
  memberSession: MemberSession | null;
  onLoginRequest: () => void;
}) {
  const hasRules = !!clubRules.trim() || !!clubRulesPdfUrl;
  const isLoggedIn = !!memberSession;

  if (!hasRules && !isLoggedIn) return null;

  return (
    <section id="rules" className="bg-section-wrap">
      <div className="section-pad">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-slate-700">Vie de l’association</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Règles de l'association</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Le règlement intérieur du SACCB. Bonne lecture !
          </p>
        </motion.div>

        {/* 🔒 Visible uniquement aux membres connectés */}
        {!isLoggedIn ? (
          <div className="max-w-2xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
            <Lock className="w-10 h-10 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-700 font-semibold text-lg mb-2">Espace réservé aux adhérents</p>
            <p className="text-slate-500 text-sm mb-5 max-w-md mx-auto">
              Connectez-vous à votre espace membre pour consulter les règles de l'association.
            </p>
            <button onClick={onLoginRequest} className="btn-primary">
              <Lock className="w-4 h-4" /> Se connecter
            </button>
          </div>
        ) : !hasRules ? (
          <div className="max-w-2xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            Aucune règle n'a encore été publiée par le bureau.
          </div>
        ) : (
          <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 flex-wrap">
              <div className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-slate-600" />
                <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                  Règlement intérieur
                </span>
              </div>
              {clubRulesPdfUrl && (
                <a
                  href={clubRulesPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-xs font-semibold transition"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {clubRulesPdfName || "Télécharger le PDF"}
                </a>
              )}
            </div>
            {clubRules.trim() ? (
              <p className="text-sm md:text-base text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                {clubRules}
              </p>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Le règlement complet est disponible dans le PDF ci-dessus.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
