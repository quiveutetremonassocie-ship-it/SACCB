"use client";

import { LogOut, MessageCircle, UserCircle2, Trophy, KeyRound, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { MemberSession, clearMemberSession } from "@/lib/useMemberSession";
import { memberChangeCode } from "@/lib/db";

export default function MemberPanel({
  session,
  y1,
  y2,
  whatsappLink,
  onClose,
}: {
  session: MemberSession;
  y1: number;
  y2: number;
  whatsappLink?: string | null;
  onClose: () => void;
}) {
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [oldCode, setOldCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  function logout() {
    clearMemberSession();
    onClose();
  }

  async function handleChangeCode(e: React.FormEvent) {
    e.preventDefault();
    if (newCode !== confirmCode) {
      setCodeMsg({ ok: false, text: "Les deux nouveaux codes ne correspondent pas." });
      return;
    }
    setCodeLoading(true);
    setCodeMsg(null);
    const r = await memberChangeCode(session.email, oldCode, newCode);
    setCodeLoading(false);
    if (r.ok) {
      setCodeMsg({ ok: true, text: "Code modifié avec succès !" });
      setOldCode(""); setNewCode(""); setConfirmCode("");
      setTimeout(() => setShowCodeForm(false), 1500);
    } else {
      setCodeMsg({ ok: false, text: r.reason || "Erreur." });
    }
  }

  return (
    <div className="fixed inset-0 z-[4500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center">
              <UserCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-xl tracking-wider text-slate-800">Espace membre</h3>
              <p className="text-xs text-slate-400">Saison {y1}–{y2}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>

        {/* Renouvellement si non payé pour cette saison */}
        {session.paid === false && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 font-semibold text-sm mb-1">⏳ Adhésion à renouveler</p>
            <p className="text-amber-700 text-xs mb-3">
              Votre adhésion pour la saison {y1}–{y2} n&apos;est pas encore réglée.
              Renouvelez-la pour conserver votre accès.
            </p>
            <a
              href="https://www.helloasso.com/associations/sainte-adresse-club-de-competition-du-badminton-s-a-c-c-b/evenements/tarif-adulte"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2.5 rounded-xl transition text-sm w-full"
            >
              <RefreshCw className="w-4 h-4" />
              Renouveler mon adhésion
            </a>
          </div>
        )}

        {/* Badge membre */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> Votre carte membre
          </p>
          <Badge nom={session.nom} type={session.type} y1={y1} y2={y2} />
          <p className="text-xs text-slate-400 text-center mt-2">
            Faites une capture d&apos;écran pour la conserver.
          </p>
        </div>

        {/* Changer le code */}
        <div className="mb-4">
          <button
            onClick={() => { setShowCodeForm(!showCodeForm); setCodeMsg(null); }}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition w-full justify-center border border-slate-200 rounded-xl py-2 hover:bg-slate-50"
          >
            <KeyRound className="w-4 h-4" />
            Changer mon code personnel
          </button>
          {showCodeForm && (
            <form onSubmit={handleChangeCode} className="mt-3 space-y-2">
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showOld ? "text" : "password"}
                  inputMode="numeric"
                  placeholder="Code actuel"
                  value={oldCode}
                  onChange={(e) => setOldCode(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showNew ? "text" : "password"}
                  inputMode="numeric"
                  placeholder="Nouveau code (min. 4 chiffres)"
                  pattern="\d{4,}"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                placeholder="Confirmer le nouveau code"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                required
              />
              {codeMsg && (
                <p className={`text-xs text-center font-semibold ${codeMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
                  {codeMsg.text}
                </p>
              )}
              <button type="submit" className="btn-primary w-full !text-sm" disabled={codeLoading}>
                {codeLoading ? "Enregistrement..." : "Enregistrer le nouveau code"}
              </button>
            </form>
          )}
        </div>

        {/* WhatsApp */}
        {whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold px-5 py-3 rounded-xl transition w-full"
          >
            <MessageCircle className="w-5 h-5" />
            Rejoindre le groupe WhatsApp
          </a>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <MessageCircle className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">
              Le lien WhatsApp sera disponible prochainement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ nom, type, y1, y2 }: { nom: string; type: string; y1: number; y2: number }) {
  return (
    <div className="relative max-w-sm mx-auto bg-gradient-to-br from-[#1e3a5f] to-[#0f2440] border-2 border-blue-400/60 rounded-2xl p-6 shadow-2xl shadow-blue-500/20 overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
      <div className="font-display text-xl text-blue-400 tracking-widest border-b border-white/10 pb-2 mb-4">
        MEMBRE OFFICIEL SACCB
      </div>
      <div className="text-2xl font-bold uppercase text-white">{nom}</div>
      <div className="text-xs uppercase tracking-widest text-white/50 mt-1">
        Saison {y1}–{y2}
      </div>
      <div className="flex items-end justify-between mt-6">
        <span className="text-xs uppercase tracking-widest text-white/60">{type}</span>
        <span className="font-display text-lg text-white/40">ST-ADRESSE</span>
      </div>
    </div>
  );
}
