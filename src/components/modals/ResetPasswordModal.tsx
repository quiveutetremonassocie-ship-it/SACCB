"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabaseClient } from "@/lib/supabase";

export default function ResetPasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  if (!open) return null;

  async function submit() {
    if (!p1 || p1.length < 12) {
      alert("Le mot de passe doit faire au moins 12 caractères.");
      return;
    }
    if (!/[A-Z]/.test(p1) || !/[a-z]/.test(p1) || !/[0-9]/.test(p1)) {
      alert("Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.");
      return;
    }
    if (p1 !== p2) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }
    const { error } = await supabaseClient.auth.updateUser({ password: p1 });
    if (error) {
      alert("Erreur : " + error.message);
    } else {
      alert("✅ Mot de passe mis à jour !");
      history.replaceState(null, "", window.location.pathname);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <KeyRound className="w-10 h-10 text-blue-600 mx-auto mb-3" />
        <h3 className="font-display text-2xl tracking-wider text-slate-800 mb-2">Nouveau mot de passe</h3>
        <p className="text-xs text-slate-400 mb-5">Choisissez un nouveau mot de passe pour votre compte admin.</p>
        <div className="space-y-3">
          <input
            type="password"
            className="input"
            placeholder="Nouveau mot de passe"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
          />
          <input
            type="password"
            className="input"
            placeholder="Confirmer"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
          />
          <button onClick={submit} className="btn-primary w-full">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
