"use client";

import { useState } from "react";
import { Printer, X, FileSignature } from "lucide-react";
import { MemberSession } from "@/lib/useMemberSession";

export default function ProcurationModal({
  session,
  y1,
  y2,
  onClose,
}: {
  session: MemberSession;
  y1: number;
  y2: number;
  onClose: () => void;
}) {
  // Si session.nom ressemble à un email (cas des admins), on laisse vide pour forcer la saisie
  const looksLikeEmail = /@/.test(session.nom);
  const defaultName = looksLikeEmail ? "" : session.nom;

  // Champs à remplir avant l'aperçu
  const [nomComplet, setNomComplet] = useState(defaultName);
  const [mandataire, setMandataire] = useState("");
  const [agDate, setAgDate] = useState(""); // YYYY-MM-DD
  const [showPreview, setShowPreview] = useState(false);

  const todayFormatted = new Date().toLocaleDateString("fr-FR");
  const agDateFormatted = agDate
    ? new Date(agDate).toLocaleDateString("fr-FR")
    : "..................................";

  function handlePrepare(e: React.FormEvent) {
    e.preventDefault();
    if (!nomComplet.trim() || !mandataire.trim()) return;
    setShowPreview(true);
  }

  // ─── ÉTAPE 1 : formulaire (mobile-first) ───
  if (!showPreview) {
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
        <div className="no-print bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 sm:p-8 w-full max-w-md my-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center shrink-0">
                <FileSignature className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <h3 className="font-display text-lg sm:text-xl tracking-wider text-slate-800 truncate">
                Procuration AG
              </h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Génère une procuration officielle pour te faire représenter à l&apos;Assemblée Générale
            si tu ne peux pas y assister.
          </p>

          <form onSubmit={handlePrepare} className="space-y-4">
            <div>
              <label className="label">
                Vos prénom et nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                placeholder="Prénom Nom"
                className="input"
                required
                autoFocus={!defaultName}
              />
              {looksLikeEmail && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Vérifie que ton prénom et ton nom sont bien renseignés (pas une adresse email).
                </p>
              )}
            </div>

            <div>
              <label className="label">
                Personne qui vous représentera <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={mandataire}
                onChange={(e) => setMandataire(e.target.value)}
                placeholder="Prénom Nom du mandataire"
                className="input"
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                Doit être un autre membre du club présent à l&apos;AG.
              </p>
            </div>

            <div>
              <label className="label">Date de l&apos;Assemblée Générale (optionnel)</label>
              <input
                type="date"
                value={agDate}
                onChange={(e) => setAgDate(e.target.value)}
                className="input"
              />
              <p className="text-xs text-slate-400 mt-1">
                Laisse vide pour l&apos;écrire à la main sur le PDF.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button type="submit" className="btn-primary w-full sm:flex-1">
                Aperçu &amp; imprimer
              </button>
              <button type="button" onClick={onClose} className="btn-ghost w-full sm:w-auto">
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── ÉTAPE 2 : document imprimable (responsive mobile + A4 à l'impression) ───
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 p-2 sm:p-4 overflow-y-auto">
      <div className="printable bg-white text-black rounded-md w-full max-w-2xl p-5 sm:p-8 md:p-10 shadow-2xl my-4 sm:my-8 text-[13px] sm:text-base">
        {/* En-tête */}
        <div className="flex items-center gap-3 sm:gap-4 border-b-2 border-blue-500 pb-3 mb-5 sm:mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo SACCB"
            className="w-14 h-14 sm:w-20 sm:h-20 object-contain shrink-0"
          />
          <div className="text-center flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl text-blue-600 font-bold leading-tight">
              SACCB - SAINTE ADRESSE
            </h1>
            <p className="text-[10px] sm:text-xs">
              Club de Badminton — Salle Paul Vatine
            </p>
          </div>
        </div>

        <h2 className="text-center underline font-bold text-base sm:text-lg mb-6 sm:mb-8">
          POUVOIR — ASSEMBLÉE GÉNÉRALE
        </h2>

        <p className="mb-4 leading-relaxed">
          Je soussigné(e), <strong>{nomComplet}</strong>, membre adhérent(e) à jour de cotisation
          de l&apos;association <strong>SACCB</strong> pour la saison <strong>{y1}–{y2}</strong>,
          donne pouvoir à&nbsp;:
        </p>

        <p className="text-center text-lg sm:text-2xl font-bold mb-5 sm:mb-6 break-words">
          {mandataire}
        </p>

        <p className="mb-4 leading-relaxed">
          également membre de l&apos;association, à l&apos;effet de me représenter à
          l&apos;Assemblée Générale du club qui se tiendra le{" "}
          <strong>{agDateFormatted}</strong>.
        </p>

        <p className="mb-6 sm:mb-8 leading-relaxed">
          Le/la mandataire est autorisé(e) à voter en mon nom sur l&apos;ensemble des résolutions
          portées à l&apos;ordre du jour (approbation des rapports, vote du budget, élection des
          membres du bureau, etc.).
        </p>

        {/* Bas : signature responsive */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-6 sm:gap-4 mt-8 sm:mt-12">
          <p className="text-sm sm:text-base">
            Fait à Sainte-Adresse,
            <br />
            Le {todayFormatted}
          </p>
          <div className="text-center">
            <p className="text-sm sm:text-base">Signature (mandant)</p>
            <p className="text-[10px] text-slate-500 italic mb-1">
              précédée de «&nbsp;Bon pour pouvoir&nbsp;»
            </p>
            <div className="mt-2 border border-blue-600 px-6 py-6 sm:px-10 sm:py-8 inline-block">
              &nbsp;
            </div>
          </div>
        </div>

        {/* Boutons (cachés à l'impression) */}
        <div className="no-print mt-8 sm:mt-10 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button onClick={() => window.print()} className="btn-primary w-full sm:flex-1">
            <Printer className="w-4 h-4" /> Imprimer / PDF
          </button>
          <button onClick={() => setShowPreview(false)} className="btn-ghost w-full sm:w-auto">
            ← Modifier
          </button>
          <button onClick={onClose} className="btn-ghost w-full sm:flex-1">
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
