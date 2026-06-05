"use client";

import { useState } from "react";
import { UserCircle2, X, KeyRound, ShieldCheck } from "lucide-react";
import { verifyMembre, publicForgotCode, memberChangeCode } from "@/lib/db";
import { MemberSession, setMemberSession, sessionDurationMs } from "@/lib/useMemberSession";

type View = "login" | "forgot" | "resetPrompt" | "changeCode";

export default function MemberLoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (session: MemberSession, adminCode?: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("login");
  // 🔑 2FA admin (déclenché côté serveur si le compte est admin + require2FA activé)
  const [needs2FA, setNeeds2FA] = useState(false);
  const [code2fa, setCode2fa] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Code oublié
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Session en attente d'être finalisée (après reset)
  const [pendingSession, setPendingSession] = useState<{ session: Omit<MemberSession, "expiry">; adminCode?: string } | null>(null);

  // Changement de code post-reset
  const [newCode, setNewCode] = useState("");
  const [newCode2, setNewCode2] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState("");

  if (!open) return null;

  function resetAll() {
    setEmail("");
    setCode("");
    setError("");
    setView("login");
    setForgotEmail("");
    setForgotMsg(null);
    setPendingSession(null);
    setNewCode("");
    setNewCode2("");
    setChangeError("");
    setNeeds2FA(false);
    setCode2fa("");
    setResendCooldown(0);
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const i = setInterval(() => {
      setResendCooldown((s) => { if (s <= 1) { clearInterval(i); return 0; } return s - 1; });
    }, 1000);
  }

  async function handleResend2FA() {
    if (resendCooldown > 0) return;
    setError("");
    setCode2fa("");
    const r = await verifyMembre(email, code, "", true);
    if (r.requires2FA) {
      setError(r.reason || "Nouveau code envoyé.");
      startResendCooldown();
    } else if (!r.ok) {
      setError(r.reason || "Erreur lors de l'envoi.");
    }
  }

  function finalizeLogin() {
    if (!pendingSession) return;
    const { session, adminCode } = pendingSession;
    // 🔑 Pour les membres non-admin, on persiste le code dans la session localStorage
    // pour qu'il survive aux nouveaux onglets/pages (charger les actus privees, FAQ, etc.)
    const finalSession = !session.isAdmin ? { ...session, memberCode: code } : session;
    setMemberSession(finalSession);
    if (!session.isAdmin) sessionStorage.setItem("saccb_member_code", code);
    onSuccess({ ...finalSession, expiry: Date.now() + sessionDurationMs(session.isAdmin === true) }, adminCode);
    resetAll();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await verifyMembre(email, code, code2fa);
    setLoading(false);

    // 🔑 Le serveur demande un code 2FA (compte admin avec require2FA activé)
    if (r.requires2FA) {
      const wasAlreadyShown = needs2FA;
      setNeeds2FA(true);
      setError(r.reason || "Un code de connexion vous a été envoyé par email.");
      if (!wasAlreadyShown) startResendCooldown();
      return;
    }

    if (!r.ok || !r.membre) {
      setError(r.reason || "Email ou code incorrect.");
      return;
    }
    const session: Omit<MemberSession, "expiry"> = {
      membreId: r.membre.id,
      nom: r.membre.nom,
      type: r.membre.type,
      email: r.membre.email,
      paid: r.paid !== false,
      isAdmin: r.isAdmin === true,
      adminCode: r.isAdmin ? code : undefined,
      newsOptIn: r.membre.newsOptIn !== false,
    };
    const adminCode = r.isAdmin ? code : undefined;

    // 🔑 Si la connexion fait suite à une réinitialisation → proposer de personnaliser le code
    if (r.codeJustReset === true && !r.isAdmin) {
      setPendingSession({ session, adminCode });
      setView("resetPrompt");
      return;
    }

    // Sinon connexion normale
    const finalSession = !session.isAdmin ? { ...session, memberCode: code } : session;
    setMemberSession(finalSession);
    if (!session.isAdmin) sessionStorage.setItem("saccb_member_code", code);
    onSuccess({ ...finalSession, expiry: Date.now() + sessionDurationMs(session.isAdmin === true) }, adminCode);
    resetAll();
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMsg(null);
    await publicForgotCode(forgotEmail);
    setForgotLoading(false);
    setForgotMsg({
      ok: true,
      text: "Si cet email correspond à un compte actif, vous allez recevoir votre code par email dans quelques instants.",
    });
  }

  async function submitChangeCode(e: React.FormEvent) {
    e.preventDefault();
    setChangeError("");
    if (newCode.length < 4) {
      setChangeError("Le code doit contenir au moins 4 caractères.");
      return;
    }
    if (newCode !== newCode2) {
      setChangeError("Les deux codes ne correspondent pas.");
      return;
    }
    if (newCode === code) {
      setChangeError("Le nouveau code doit être différent de celui reçu par email.");
      return;
    }
    setChangeLoading(true);
    const r = await memberChangeCode(email.toLowerCase().trim(), code, newCode);
    setChangeLoading(false);
    if (!r.ok) {
      setChangeError(r.reason || "Erreur lors du changement de code.");
      return;
    }
    // Met à jour le code en sessionStorage avec le nouveau
    setCode(newCode);
    if (pendingSession && !pendingSession.session.isAdmin) {
      sessionStorage.setItem("saccb_member_code", newCode);
    }
    // Et on finalise la connexion
    if (!pendingSession) return;
    const finalSession = !pendingSession.session.isAdmin ? { ...pendingSession.session, memberCode: newCode } : pendingSession.session;
    setMemberSession(finalSession);
    onSuccess({ ...finalSession, expiry: Date.now() + sessionDurationMs(pendingSession.session.isAdmin === true) }, pendingSession.adminCode);
    resetAll();
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center">
              {view === "resetPrompt" || view === "changeCode" ? (
                <KeyRound className="w-5 h-5 text-white" />
              ) : (
                <UserCircle2 className="w-5 h-5 text-white" />
              )}
            </div>
            <h3 className="font-display text-xl tracking-wider text-slate-800">
              {view === "forgot"
                ? "Code oublié"
                : view === "resetPrompt"
                ? "Personnaliser le code"
                : view === "changeCode"
                ? "Nouveau code"
                : "Espace membre"}
            </h3>
          </div>
          {view !== "resetPrompt" && view !== "changeCode" && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {view === "login" && (
          <>
            <p className="text-xs text-slate-400 mb-5">
              Connectez-vous avec votre email et le code choisi lors de votre inscription.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                type="email"
                className="input w-full"
                placeholder="Votre email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="input w-full"
                placeholder="Votre code personnel"
                inputMode="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={needs2FA}
              />

              {/* 🔑 Champ 2FA : affiché uniquement quand le serveur le réclame (admins) */}
              {needs2FA && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-emerald-600 mb-1.5 block">
                    🔑 Code reçu par email
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    className="input w-full text-center text-2xl tracking-[8px] font-mono"
                    placeholder="000000"
                    value={code2fa}
                    onChange={(e) => setCode2fa(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                    required
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px] text-slate-500">Code valable 10 min.</p>
                    <button
                      type="button"
                      onClick={handleResend2FA}
                      disabled={resendCooldown > 0}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 disabled:text-slate-300 disabled:cursor-not-allowed underline"
                    >
                      {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : "📩 Renvoyer un code"}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className={`text-xs rounded-lg px-3 py-2 ${needs2FA ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-red-500 bg-red-50 border border-red-200"}`}>
                  {error}
                </p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Vérification..." : "Se connecter"}
              </button>
            </form>
            <button
              onClick={() => { setView("forgot"); setForgotMsg(null); setForgotEmail(""); }}
              className="block text-xs text-slate-400 hover:text-slate-600 text-center mt-3 w-full transition"
            >
              Code oublié ?
            </button>
          </>
        )}

        {view === "forgot" && (
          <>
            <p className="text-xs text-slate-400 mb-5">
              Entrez votre email d&apos;adhérent et nous vous enverrons un nouveau code par email.
            </p>
            <form onSubmit={submitForgot} className="space-y-3">
              <input
                type="email"
                className="input w-full"
                placeholder="Votre email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              {forgotMsg && (
                <p className={`text-xs rounded-lg px-3 py-2 border ${forgotMsg.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-500 bg-red-50 border-red-200"}`}>
                  {forgotMsg.text}
                </p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={forgotLoading}>
                {forgotLoading ? "Envoi..." : "Recevoir mon code par email"}
              </button>
            </form>
            <button
              onClick={() => setView("login")}
              className="block text-xs text-slate-400 hover:text-slate-600 text-center mt-3 w-full transition"
            >
              ← Retour à la connexion
            </button>
          </>
        )}

        {view === "resetPrompt" && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">
                Votre code a été réinitialisé par email. Pour plus de sécurité, nous vous recommandons de le <strong>personnaliser maintenant</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setNewCode(""); setNewCode2(""); setChangeError(""); setView("changeCode"); }}
                className="btn-primary w-full"
              >
                Oui, choisir un nouveau code
              </button>
              <button
                onClick={finalizeLogin}
                className="btn-ghost w-full"
              >
                Plus tard
              </button>
            </div>
          </>
        )}

        {view === "changeCode" && (
          <>
            <p className="text-xs text-slate-400 mb-5">
              Choisissez un nouveau code personnel (minimum 4 caractères). Vous l&apos;utiliserez à chaque connexion.
            </p>
            <form onSubmit={submitChangeCode} className="space-y-3">
              <input
                type="password"
                className="input w-full"
                placeholder="Nouveau code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                minLength={4}
                required
                autoFocus
              />
              <input
                type="password"
                className="input w-full"
                placeholder="Confirmer le nouveau code"
                value={newCode2}
                onChange={(e) => setNewCode2(e.target.value)}
                minLength={4}
                required
              />
              {changeError && (
                <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {changeError}
                </p>
              )}
              <button type="submit" className="btn-primary w-full" disabled={changeLoading}>
                {changeLoading ? "Enregistrement..." : "Enregistrer mon nouveau code"}
              </button>
            </form>
            <button
              onClick={finalizeLogin}
              className="block text-xs text-slate-400 hover:text-slate-600 text-center mt-3 w-full transition"
            >
              ← Plus tard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
