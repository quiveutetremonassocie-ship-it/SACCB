"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { publicResetCodeWithToken } from "@/lib/db";

// 🔑 Ouvert depuis le lien « Code oublié ? » reçu par email (?reset=<jeton>&email=<email>) :
// l'adhérent choisit directement son nouveau code (lettres et/ou chiffres).
export default function ResetCodeLinkModal({
  email,
  token,
  onClose,
  onLoginRequest,
}: {
  email: string;
  token: string;
  onClose: () => void;
  onLoginRequest: () => void;
}) {
  const [code1, setCode1] = useState("");
  const [code2, setCode2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (code1.length < 4) { setError("Le code doit contenir au moins 4 caractères."); return; }
    if (code1 !== code2) { setError("Les deux codes ne correspondent pas."); return; }
    setLoading(true);
    const r = await publicResetCodeWithToken(email, token, code1);
    setLoading(false);
    if (!r.ok) { setError(r.reason || "Erreur."); return; }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        {done ? (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-display text-2xl tracking-wider text-slate-800 mb-2">Code modifié</h3>
            <p className="text-sm text-slate-500 mb-5">Vous pouvez maintenant vous connecter avec votre nouveau code.</p>
            <button onClick={onLoginRequest} className="btn-primary w-full">Se connecter</button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="w-5 h-5 text-blue-600" />
              <h3 className="font-display text-2xl tracking-wider text-slate-800">Nouveau code</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 break-all">{email}</p>
            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <input
                  className="input pr-10"
                  type={show ? "text" : "password"}
                  placeholder="Nouveau code (4 caractères min., lettres et/ou chiffres)"
                  value={code1}
                  onChange={(e) => setCode1(e.target.value)}
                  autoFocus
                  required
                />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <input
                className="input"
                type={show ? "text" : "password"}
                placeholder="Confirmer le nouveau code"
                value={code2}
                onChange={(e) => setCode2(e.target.value)}
                required
              />
              {error && <p className="text-xs text-red-500 text-center font-semibold">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Enregistrement..." : "Enregistrer mon nouveau code"}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost w-full">Annuler</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
