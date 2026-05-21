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
  // Champs à remplir avant l'aperçu
  const [mandataire, setMandataire] = useState("");
  const [agDate, setAgDate] = useState(""); // YYYY-MM-DD
  const [showPreview, setShowPreview] = useState(false);

  const todayFormatted = new Date().toLocaleDateString("fr-FR");
  const agDateFormatted = agDate
    ? new Date(agDate).toLocaleDateString("fr-FR")
    : "..................................";

  function handlePrepare(e: React.FormEvent) {
    e.preventDefault();
    if (!mandataire.trim()) return;
    setShowPreview(true);
  }

  // ─── ÉTAPE 1 : petit formulaire ───
  if (!showPreview) {
    return (
      <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="no-print bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-md my-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center">
                <FileSignature className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display text-xl tracking-wider text-slate-800">
                Procuration AG
              </h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Génère une procuration officielle pour te faire représenter à l&apos;Assemblée Générale
            si tu ne peux pas y assister.
          </p>

          <form onSubmit={handlePrepare} className="space-y-4">
            <div>
              <label className="label">Vos informations</label>
              <input
                type="text"
                value={session.nom}
                readOnly
                className="input bg-slate-50 cursor-not-allowed"
              />
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
                autoFocus
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
                Laisse vide si tu ne la connais pas — tu pourras l&apos;écrire à la main sur le PDF.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1">
                Aperçu &amp; imprimer
              </button>
              <button type="button" onClick={onClose} className="btn-ghost">
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── ÉTAPE 2 : document imprimable (même style que le reçu) ───
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 p-4 overflow-y-auto">
      <div className="printable bg-white text-black rounded-md max-w-2xl w-full p-10 shadow-2xl my-8">
        {/* En-tête identique au reçu */}
        <div className="flex items-center gap-4 border-b-2 border-blue-500 pb-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo SACCB" className="w-20 h-20 object-contain shrink-0" />
          <div className="text-center flex-1">
            <h1 className="text-2xl text-blue-600 font-bold">SACCB - SAINTE ADRESSE</h1>
            <p className="text-xs">Club de Badminton — Salle Paul Vatine</p>
          </div>
        </div>

        <h2 className="text-center underline font-bold text-lg mb-8">
          POUVOIR — ASSEMBLÉE GÉNÉRALE
        </h2>

        <p className="mb-4">
          Je soussigné(e), <strong>{session.nom}</strong>, membre adhérent(e) à jour de cotisation
          de l&apos;association <strong>SACCB</strong> pour la saison <strong>{y1}–{y2}</strong>,
          donne pouvoir à&nbsp;:
        </p>

        <p className="text-center text-2xl font-bold mb-6">{mandataire}</p>

        <p className="mb-4">
          également membre de l&apos;association, à l&apos;effet de me représenter à
          l&apos;Assemblée Générale du club qui se tiendra le{" "}
          <strong>{agDateFormatted}</strong>.
        </p>

        <p className="mb-8">
          Le/la mandataire est autorisé(e) à voter en mon nom sur l&apos;ensemble des résolutions
          portées à l&apos;ordre du jour (approbation des rapports, vote du budget, élection des
          membres du bureau, etc.).
        </p>

        <div className="flex justify-between mt-12">
          <p>
            Fait à Sainte-Adresse,
            <br />
            Le {todayFormatted}
          </p>
          <div className="text-center">
            <p>Signature (mandant)</p>
            <p className="text-[10px] text-slate-500 italic mb-1">
              précédée de « Bon pour pouvoir »
            </p>
            <div className="mt-2 font-bold text-blue-600 border border-blue-600 px-6 py-6 inline-block">
              &nbsp;
            </div>
          </div>
        </div>

        {/* Boutons d'action (cachés à l'impression) */}
        <div className="no-print mt-10 flex gap-3">
          <button onClick={() => window.print()} className="btn-primary flex-1">
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <button onClick={() => setShowPreview(false)} className="btn-ghost">
            ← Modifier
          </button>
          <button onClick={onClose} className="btn-ghost flex-1">
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
