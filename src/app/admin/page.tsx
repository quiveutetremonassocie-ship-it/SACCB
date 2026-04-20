"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Eye, EyeOff, ArrowLeft, RefreshCw } from "lucide-react";
import { DB } from "@/lib/types";
import { emptyDB, fetchAdminDBByMember, saveDBByMember } from "@/lib/db";
import { getMemberSession, MemberSession, setMemberSession } from "@/lib/useMemberSession";
import { verifyMembre } from "@/lib/db";
import AdminPanel from "@/components/admin/AdminPanel";
import Link from "next/link";

export default function AdminPage() {
  const [memberSession, setMemberSessionState] = useState<MemberSession | null>(null);
  const [db, setDb] = useState<DB>(emptyDB());
  const [adminReady, setAdminReady] = useState(false);
  const memberAdminCode = useRef<string | null>(null);

  // Form
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Restaurer session depuis sessionStorage/localStorage
  useEffect(() => {
    const session = getMemberSession();
    const savedCode = sessionStorage.getItem("saccb_admin_code");
    if (session?.isAdmin && savedCode) {
      memberAdminCode.current = savedCode;
      setMemberSessionState(session);
      fetchAdminDBByMember(session.email, savedCode).then((data) => {
        if (data) {
          setDb(data);
          setAdminReady(true);
        }
      });
    }
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
      if (data) setDb(data);
    }
  }, [memberSession]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await verifyMembre(email.trim().toLowerCase(), code.trim());
    setLoading(false);

    if (!r.ok || !r.membre) {
      setError(r.reason || "Email ou code incorrect.");
      return;
    }
    if (!r.isAdmin) {
      setError("Ce compte n'a pas accès à l'administration.");
      return;
    }

    const sess: MemberSession = {
      membreId: r.membre.id,
      nom: r.membre.nom,
      type: r.membre.type,
      email: r.membre.email,
      paid: r.paid !== false,
      isAdmin: true,
      expiry: Date.now() + 365 * 24 * 60 * 60 * 1000,
    };
    setMemberSession(sess);
    sessionStorage.setItem("saccb_admin_code", code.trim());
    memberAdminCode.current = code.trim();
    setMemberSessionState(sess);

    const data = await fetchAdminDBByMember(sess.email, code.trim());
    if (data) {
      setDb(data);
      setAdminReady(true);
    } else {
      setError("Impossible de charger les données admin.");
    }
  }

  function handleClose() {
    setAdminReady(false);
    setMemberSessionState(null);
    memberAdminCode.current = null;
    sessionStorage.removeItem("saccb_admin_code");
    setDb(emptyDB());
  }

  if (adminReady && memberSession) {
    return (
      <AdminPanel
        db={db}
        onClose={handleClose}
        onPersist={persist}
        onRefresh={refresh}
        adminEmail={memberSession.email}
      />
    );
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

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl tracking-wider text-slate-800">Admin SACCB</h1>
              <p className="text-xs text-slate-400">Accès réservé aux administrateurs</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">
                Email
              </label>
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
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 block">
                Code personnel
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

            {error && (
              <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Connexion...</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Accéder à l'admin</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          SACCB · Panneau d'administration
        </p>
      </div>
    </div>
  );
}
