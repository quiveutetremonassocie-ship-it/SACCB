"use client";

import { useState } from "react";
import { UserCircle2, X } from "lucide-react";
import { verifyMembre } from "@/lib/db";
import { MemberSession, setMemberSession } from "@/lib/useMemberSession";

export default function MemberLoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (session: MemberSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await verifyMembre(email, code);
    setLoading(false);
    if (!r.ok || !r.membre) {
      setError(r.reason || "Email ou code incorrect.");
      return;
    }
    const sess = { membreId: r.membre.id, nom: r.membre.nom, type: r.membre.type, email: r.membre.email };
    const stored = setMemberSession(sess);
    onSuccess({ ...sess, expiry: Date.now() + 365 * 24 * 60 * 60 * 1000 });
    setEmail("");
    setCode("");
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center">
              <UserCircle2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-display text-xl tracking-wider text-slate-800">Espace membre</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
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
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          {error && (
            <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Vérification..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
