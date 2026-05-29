"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Eye, EyeOff, ArrowLeft, RefreshCw, LogOut, Users } from "lucide-react";
import { DB } from "@/lib/types";
import { emptyDB, fetchAdminDBByMember, saveDBByMember, clearTrustToken, fetchPublicDB } from "@/lib/db";
import { getMemberSession, MemberSession, setMemberSession, clearMemberSession, sessionDurationMs } from "@/lib/useMemberSession";
import { verifyMembre } from "@/lib/db";
import AdminPanel from "@/components/admin/AdminPanel";
import Link from "next/link";

// 🔒 SÉCURITÉ : le code admin n'est PLUS persistant.
// Il vit uniquement en mémoire (React ref) tant que la page admin est ouverte.
// Dès qu'on quitte /admin ou recharge → re-saisie obligatoire du mot de passe.
// Cleanup d'anciens caches au démarrage de la page (migration douce).
function cleanupOldAdminCodeCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("saccb_admin_code");
  sessionStorage.removeItem("saccb_admin_code");
}

export default function AdminPage() {
  const [memberSession, setMemberSessionState] = useState<MemberSession | null>(null);
  const [db, setDb] = useState<DB>(emptyDB());
  const [adminReady, setAdminReady] = useState(false);
  const [bootChecking, setBootChecking] = useState(true); // évite un flash de la page de login
  const memberAdminCode = useRef<string | null>(null);

  // Form
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // 🔑 2FA
  const [needs2FA, setNeeds2FA] = useState(false);
  const [code2fa, setCode2fa] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  // 🚀 Mode "déjà connecté en tant qu'admin mais pas de code admin en cache" :
  // l'utilisateur saisit juste son mot de passe pour ré-authentifier
  const [quickAuthMode, setQuickAuthMode] = useState(false);
  // 🎤 Mode visiteur (présentation) : admin en lecture seule sans login
  const [presentationMode, setPresentationMode] = useState(false);
  const [visitorMode, setVisitorMode] = useState(false);

  // 🔄 Au chargement : tenter d'utiliser la session existante + vérifier mode présentation
  useEffect(() => {
    cleanupOldAdminCodeCache();
    const session = getMemberSession();

    if (session?.isAdmin) {
      setEmail(session.email);
      setMemberSessionState(session);
      setQuickAuthMode(true);
    }

    // Vérifier si le mode présentation est actif
    fetchPublicDB().then((d) => {
      if (d.presentationMode) setPresentationMode(true);
    }).catch(() => {});

    setBootChecking(false);
  }, []);

  const persist = useCallback(async (next: DB) => {
    setDb(next);
    if (memberSession && memberAdminCode.current) {
      await saveDBByMember(memberSession.email, memberAdminCode.current, next);
    }
  }, [memberSession]);

  const refresh = useCallback(async () => {
    if (memberSession && memberAdminCode.current) {
      const data = await fetchAdminDBByMember(memberSession.email, memberAdminCode.current);
      if (data) setDb(data.db);
    }
  }, [memberSession]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await verifyMembre(email.trim().toLowerCase(), code.trim(), code2fa.trim());
    setLoading(false);

    if (r.requires2FA) {
      setNeeds2FA(true);
      setError(r.reason || "Un code de connexion vous a été envoyé par email.");
      if (!needs2FA) startResendCooldown();
      return;
    }

    if (!r.ok || !r.membre) {
      setError(r.reason || "Email ou code incorrect.");
      return;
    }
    if (!r.isAdmin) {
      setError("Ce compte n'a pas accès à l'administration.");
      return;
    }
    setNeeds2FA(false);
    setCode2fa("");

    const sess: MemberSession = {
      membreId: r.membre.id,
      nom: r.membre.nom,
      type: r.membre.type,
      email: r.membre.email,
      paid: r.paid !== false,
      isAdmin: true,
      expiry: Date.now() + sessionDurationMs(true),
    };
    setMemberSession(sess);
    // 🔒 PAS de cache du code admin — il reste UNIQUEMENT en mémoire
    memberAdminCode.current = code.trim();
    setMemberSessionState(sess);

    const data = await fetchAdminDBByMember(sess.email, code.trim());
    if (data) {
      setDb(data.db);
      setAdminReady(true);
      setQuickAuthMode(false);
    } else {
      setError("Impossible de charger les données admin.");
    }
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((s) => { if (s <= 1) { clearInterval(interval); return 0; } return s - 1; });
    }, 1000);
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setError("");
    setCode2fa("");
    const r = await verifyMembre(email.trim().toLowerCase(), code.trim(), "", true);
    if (r.requires2FA) {
      setError(r.reason || "Nouveau code envoyé.");
      startResendCooldown();
    } else if (!r.ok) {
      setError(r.reason || "Erreur lors de l'envoi du nouveau code.");
    }
  }

  function handleClose() {
    // Ferme le panel admin et oublie le code en mémoire → re-saisie au prochain accès
    memberAdminCode.current = null;
    setAdminReady(false);
    setCode("");
  }

  function handleFullLogout() {
    // Déconnexion totale : session + code admin + trust token 2FA
    cleanupOldAdminCodeCache();
    clearTrustToken(); // tous les comptes
    clearMemberSession();
    setAdminReady(false);
    setMemberSessionState(null);
    setQuickAuthMode(false);
    memberAdminCode.current = null;
    setDb(emptyDB());
    setEmail("");
    setCode("");
    setNeeds2FA(false);
    setCode2fa("");
  }

  // 🟢 Accès admin OK
  if (adminReady && memberSession) {
    return (
      <AdminPanel
        db={db}
        onClose={handleClose}
        onPersist={persist}
        onRefresh={refresh}
        adminEmail={memberSession.email}
        adminCode={memberAdminCode.current ?? undefined}
      />
    );
  }

  // 🎤 Mode visiteur : admin en lecture seule (présentation)
  if (visitorMode) {
    return (
      <AdminPanel
        db={db}
        onClose={() => { setVisitorMode(false); setDb(emptyDB()); }}
        onPersist={async () => {}}
        onRefresh={async () => {}}
        readOnly={true}
      />
    );
  }

  // ⏳ Pendant le boot (évite le flash de la page de login)
  if (bootChecking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // 🚧 Cas "membre simple" connecté mais pas admin → on bloque clairement
  if (memberSession && !memberSession.isAdmin && !quickAuthMode) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-slate-700 font-semibold mb-2">Accès admin réservé</p>
          <p className="text-sm text-slate-500 mb-6">Ton compte membre n&apos;a pas les droits d&apos;administration.</p>
          <Link href="/" className="btn-primary">← Retour au site</Link>
        </div>
      </div>
    );
  }

  async function enterVisitorMode() {
    setLoading(true);
    const d = await fetchPublicDB();
    setDb({ ...emptyDB(), ...d } as DB);
    setVisitorMode(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au site
        </Link>

        {/* Bouton mode visiteur si présentation active */}
        {presentationMode && (
          <button
            onClick={enterVisitorMode}
            disabled={loading}
            className="w-full mb-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-2xl p-5 shadow-lg transition flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Mode visiteur</p>
              <p className="text-[11px] text-white/80">Voir l&apos;admin en consultation uniquement</p>
            </div>
          </button>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl tracking-wider text-slate-800">Admin SACCB</h1>
              <p className="text-xs text-slate-400">
                {quickAuthMode ? `Connecté en tant que ${email}` : "Accès réservé aux administrateurs"}
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {!quickAuthMode && (
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">Email</label>
                <input
                  type="email"
                  className="input w-full"
                  placeholder="votre@email.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">
                {quickAuthMode ? "Confirmer votre mot de passe" : "Code personnel"}
              </label>
              <div className="relative">
                <input
                  type={showCode ? "text" : "password"}
                  className="input w-full pr-10"
                  placeholder="Votre code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoComplete="current-password"
                  autoFocus={quickAuthMode}
                />
                <button
                  type="button"
                  onClick={() => setShowCode((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

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
                    onClick={handleResendCode}
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

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Connexion...</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Accéder à l&apos;admin</>
              )}
            </button>

            {quickAuthMode && (
              <button
                type="button"
                onClick={handleFullLogout}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition flex items-center justify-center gap-1 mt-2"
              >
                <LogOut className="w-3 h-3" /> Se déconnecter de ce compte
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          SACCB · Panneau d&apos;administration
        </p>
      </div>
    </div>
  );
}
