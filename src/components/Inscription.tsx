"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import confetti from "canvas-confetti";
import { DB } from "@/lib/types";
import { publicAddMembre } from "@/lib/db";

export default function Inscription({
  db,
  membresCount,
  quota,
  prix,
  onMembreAdded,
}: {
  db: DB;
  membresCount: number;
  quota: number;
  prix: { Adulte: number; Etudiant: number };
  onMembreAdded: () => void;
}) {
  const [done, setDone] = useState<{ nom: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const remaining = quota - membresCount;
  const progress = Math.min((membresCount / quota) * 100, 100);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db.insc_open) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const nom = String(fd.get("nom") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const tel = String(fd.get("tel") || "").trim();
    const type = String(fd.get("type") || "Adulte") as "Adulte" | "Etudiant";

    if (membresCount >= quota) {
      alert("Le club est complet !");
      setLoading(false);
      return;
    }

    const r = await publicAddMembre({
      id: Date.now().toString(),
      nom,
      email,
      tel,
      type,
      ok: false,
    });
    setLoading(false);
    if (!r.ok) {
      alert(r.reason || "Erreur");
      return;
    }
    setDone({ nom, type });
    onMembreAdded();
    confetti({ particleCount: 130, spread: 75, origin: { y: 0.6 } });
  }

  return (
    <section id="inscription" className="bg-section-wrap bg-signup relative">
      <div className="section-pad relative">
      <div className="text-center mb-14">
        <div className="sport-label mb-5">
          <span className="sport-label-dot" />
          <span className="sport-label-text text-emerald-300">Adhésion</span>
        </div>
        <h2 className="font-display text-5xl md:text-6xl h-display mb-4">
          Saison {db.y1}–{db.y2}
        </h2>
        <p className="text-white/60 max-w-2xl mx-auto">
          Rejoignez l&apos;aventure SACCB. Quelques minutes suffisent.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-strong p-8 md:p-10 max-w-2xl mx-auto"
      >
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-white/70">Places restantes</span>
            <span className="text-emerald-400 font-semibold">
              {remaining} / {quota}
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {!db.insc_open ? (
          <div className="text-center py-10">
            <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-red-400 mb-2">Inscriptions closes</h3>
            <p className="text-white/60 text-sm">
              La période d&apos;inscription est terminée ou le club est complet. À bientôt !
            </p>
          </div>
        ) : done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-4">Inscription enregistrée !</h3>
            <Badge nom={done.nom} type={done.type} y1={db.y1} y2={db.y2} />
            <p className="text-xs text-white/50 mt-4">Pensez à faire une capture d&apos;écran de votre badge.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input className="input" name="nom" placeholder="Nom et prénom" required />
            <input className="input" name="email" type="email" placeholder="Email" required />
            <input className="input" name="tel" type="tel" placeholder="Téléphone" required />
            <select className="input" name="type" defaultValue="Adulte">
              <option value="Adulte">Adulte ({prix.Adulte}€)</option>
              <option value="Etudiant">Étudiant ({prix.Etudiant}€)</option>
            </select>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Envoi..." : "Valider mon inscription"}
            </button>
          </form>
        )}
      </motion.div>
      </div>
    </section>
  );
}

function Badge({ nom, type, y1, y2 }: { nom: string; type: string; y1: number; y2: number }) {
  return (
    <div className="relative max-w-sm mx-auto bg-gradient-to-br from-bgcard to-bgdark border-2 border-blue-500/60 rounded-2xl p-6 shadow-2xl shadow-blue-500/20 overflow-hidden">
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
