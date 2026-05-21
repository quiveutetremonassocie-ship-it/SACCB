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
  // Champs editables avant impression
  const [mandataire, setMandataire] = useState("");
  const [agDate, setAgDate] = useState(""); // YYYY-MM-DD
  const [lieu, setLieu] = useState("Sainte-Adresse");
  const [showPreview, setShowPreview] = useState(false);

  const todayFormatted = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const agDateFormatted = agDate
    ? new Date(agDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "______________________________";

  function handlePrepare(e: React.FormEvent) {
    e.preventDefault();
    if (!mandataire.trim()) return;
    setShowPreview(true);
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      {!showPreview ? (
        // ─── ÉTAPE 1 : formulaire ───
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
            Génère une procuration pour te faire représenter à l&apos;Assemblée Générale du club
            si tu ne peux pas y assister.
          </p>

          <form onSubmit={handlePrepare} className="space-y-4">
            <div>
              <label className="label">Vos informations (auto-remplies)</label>
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
                Laisse vide si tu ne connais pas encore la date — tu pourras l&apos;écrire à la main.
              </p>
            </div>

            <div>
              <label className="label">Fait à</label>
              <input
                type="text"
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                className="input"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1">
                Aperçu & imprimer
              </button>
              <button type="button" onClick={onClose} className="btn-ghost">
                Annuler
              </button>
            </div>
          </form>
        </div>
      ) : (
        // ─── ÉTAPE 2 : prévisualisation du document imprimable ───
        <div className="printable bg-white text-black rounded-md max-w-2xl w-full p-10 shadow-2xl my-8">
          {/* En-tête avec logo */}
          <div className="flex items-center gap-4 border-b-2 border-blue-500 pb-3 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo SACCB"
              className="w-20 h-20 object-contain shrink-0"
            />
            <div className="text-center flex-1">
              <h1 className="text-2xl text-blue-600 font-bold">SACCB - SAINTE ADRESSE</h1>
              <p className="text-xs">Sainte-Adresse Club de Compétition de Badminton</p>
              <p className="text-xs text-slate-600">Salle Paul Vatine — 76310 Sainte-Adresse</p>
            </div>
          </div>

          {/* Titre */}
          <h2 className="text-center underline font-bold text-xl mb-2">
            POUVOIR — ASSEMBLÉE GÉNÉRALE
          </h2>
          <p className="text-center text-sm text-slate-600 mb-8">
            Saison {y1}–{y2}
          </p>

          {/* Corps du document */}
          <div className="space-y-5 text-justify leading-relaxed">
            <p>
              Je soussigné(e), <strong>{session.nom}</strong>, membre adhérent(e) à jour de cotisation
              de l&apos;association <strong>SACCB</strong> (Sainte-Adresse Club de Compétition de
              Badminton) pour la saison <strong>{y1}–{y2}</strong>,
            </p>

            <p>
              donne par la présente <strong>pouvoir</strong> à&nbsp;:
            </p>

            <p className="text-center text-lg">
              <strong className="border-b border-slate-400 px-4 pb-1">{mandataire}</strong>
            </p>

            <p>
              également membre de l&apos;association SACCB, à l&apos;effet de me représenter à
              l&apos;Assemblée Générale du club qui se tiendra le{" "}
              <strong>{agDateFormatted}</strong>, et de prendre part en mon nom à toutes les
              délibérations et à tous les votes portés à l&apos;ordre du jour.
            </p>

            <p>
              Le/la mandataire désigné(e) est autorisé(e) à voter en mon nom sur l&apos;ensemble des
              résolutions présentées, qu&apos;elles concernent l&apos;approbation des rapports, le
              vote du budget, l&apos;élection des membres du bureau, ou toute autre question
              soumise à l&apos;Assemblée.
            </p>

            <p className="text-xs text-slate-600 italic">
              Conformément aux statuts de l&apos;association, un membre ne peut détenir plus de
              deux pouvoirs en plus du sien.
            </p>
          </div>

          {/* Signature */}
          <div className="flex justify-between items-end mt-12 pt-6 border-t border-slate-200">
            <div>
              <p className="text-sm">
                Fait à <strong>{lieu}</strong>,
              </p>
              <p className="text-sm">
                Le <strong>{todayFormatted}</strong>
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm mb-2">
                Signature du mandant (faire précéder
                <br />
                de la mention &laquo;&nbsp;Bon pour pouvoir&nbsp;&raquo;) :
              </p>
              <div className="w-48 h-20 border border-slate-300 rounded" />
            </div>
          </div>

          {/* Pied de page */}
          <div className="mt-10 pt-4 border-t border-slate-200 text-center">
            <p className="text-[10px] text-slate-500">
              SACCB · Sainte-Adresse Club de Compétition de Badminton · contact@saccb.fr · saccb.fr
            </p>
          </div>

          {/* Boutons d'action (cachés à l'impression) */}
          <div className="no-print mt-10 flex gap-3">
            <button onClick={() => window.print()} className="btn-primary flex-1">
              <Printer className="w-4 h-4" /> Imprimer / Enregistrer en PDF
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="btn-ghost"
            >
              ← Modifier
            </button>
            <button onClick={onClose} className="btn-ghost">
              <X className="w-4 h-4" /> Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
