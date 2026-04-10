"use client";

import { useState } from "react";
import { Shield, X } from "lucide-react";
import { supabaseClient } from "@/lib/supabase";

export default function LoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    setLoading(false);
    if (error) alert("Accès refusé : " + error.message);
    else onSuccess();
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-strong p-8 w-full max-w-sm relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/40 hover:text-white p-2"
          aria-label="Fermer"
        >
          <X />
        </button>
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h3 className="font-display text-2xl tracking-wider text-white">Espace Admin</h3>
          <p className="text-xs text-white/50 mt-1">Connexion sécurisée Supabase</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="input"
            type="email"
            placeholder="Email admin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Connexion..." : "Entrer"}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={onClose}>
            Retour
          </button>
        </form>
      </div>
    </div>
  );
}
