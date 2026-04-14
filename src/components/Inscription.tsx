"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, Lock, CreditCard, Banknote, Clock } from "lucide-react";
import confetti from "canvas-confetti";
import { DB } from "@/lib/types";
import { publicAddMembre, publicMarkPaid } from "@/lib/db";

const HELLOASSO_URL =
  "https://www.helloasso.com/associations/sainte-adresse-club-de-competition-du-badminton-s-a-c-c-b/evenements/tarif-adulte";

type PaymentMode = "online" | "virement";

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
  const [done, setDone] = useState<{ nom: string; type: string; mode: PaymentMode } | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("online");

  const remaining = quota - membresCount;
  const progress = Math.min((membresCount / quota) * 100, 100);

  // Détection du retour depuis HelloAsso après paiement réussi
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;

    const pendingId = localStorage.getItem("saccb_pending_membre_id");
    const pendingNom = localStorage.getItem("saccb_pending_membre_nom");
    const pendingType = localStorage.getItem("saccb_pending_membre_type");
    if (!pendingId) {
      // Nettoie l'URL même sans pending pour éviter les ré-déclenchements
      window.history.replaceState({}, "", window.location.pathname + "#inscription");
      return;
    }

    publicMarkPaid(pendingId).then((r) => {
      localStorage.removeItem("saccb_pending_membre_id");
      localStorage.removeItem("saccb_pending_membre_nom");
      localStorage.removeItem("saccb_pending_membre_type");
      if (r.ok) {
        setDone({ nom: pendingNom || "", type: pendingType || "Adulte", mode: "online" });
        confetti({ particleCount: 130, spread: 75, origin: { y: 0.6 } });
        onMembreAdded();
      }
      window.history.replaceState({}, "", window.location.pathname + "#inscription");
      // Scroll vers la section inscription
      setTimeout(() => {
        document.getElementById("inscription")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
  }, [onMembreAdded]);

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
      nom,
      email,
      tel,
      type,
      paymentMethod: mode,
    });
    if (!r.ok) {
      setLoading(false);
      alert(r.reason || "Erreur");
      return;
    }

    if (mode === "online") {
      // On enregistre le membre en attente, puis on redirige vers HelloAsso.
      // Au retour (?payment=success), on retrouve l'id via localStorage et on marque payé.
      localStorage.setItem("saccb_pending_membre_id", r.membreId || "");
      localStorage.setItem("saccb_pending_membre_nom", nom);
      localStorage.setItem("saccb_pending_membre_type", type);
      window.location.href = HELLOASSO_URL;
      return;
    }

    // Paiement par virement : on enregistre simplement, en attente
    setLoading(false);
    setDone({ nom, type, mode: "virement" });
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
          done.mode === "online" ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Paiement confirmé !</h3>
              <p className="text-white/70 text-sm mb-4">
                Merci {done.nom}, votre adhésion est validée.
              </p>
              <Badge nom={done.nom} type={done.type} y1={db.y1} y2={db.y2} />
              <p className="text-xs text-white/50 mt-4">
                Pensez à faire une capture d&apos;écran de votre badge.
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <Clock className="w-14 h-14 text-amber-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Inscription enregistrée !</h3>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 text-left">
                <p className="text-amber-200 text-sm font-semibold mb-1">
                  Paiement en attente
                </p>
                <p className="text-white/70 text-sm">
                  Merci {done.nom}. Pour finaliser votre adhésion, veuillez vous
                  rapprocher de <strong className="text-white">Hernan</strong> au prochain
                  entraînement afin de procéder au règlement par virement bancaire.
                </p>
              </div>
              <Badge nom={done.nom} type={done.type} y1={db.y1} y2={db.y2} />
              <p className="text-xs text-white/50 mt-4">
                Pensez à faire une capture d&apos;écran de votre badge.
              </p>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input className="input" name="nom" placeholder="Nom et prénom" required />
            <input className="input" name="email" type="email" placeholder="Email" required />
            <input className="input" name="tel" type="tel" placeholder="Téléphone" required />
            <select className="input" name="type" defaultValue="Adulte">
              <option value="Adulte">Adulte ({prix.Adulte}€)</option>
              <option value="Etudiant">Étudiant ({prix.Etudiant}€)</option>
            </select>

            <div className="pt-2">
              <p className="text-xs uppercase tracking-widest text-white/50 mb-2">
                Mode de paiement
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("online")}
                  className={`relative text-left rounded-xl border p-4 transition-all ${
                    mode === "online"
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard
                      className={`w-4 h-4 ${
                        mode === "online" ? "text-emerald-400" : "text-white/60"
                      }`}
                    />
                    <span className="text-white font-semibold text-sm">
                      Payer en ligne
                    </span>
                  </div>
                  <p className="text-white/60 text-xs">
                    Carte bancaire via HelloAsso (sécurisé)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("virement")}
                  className={`relative text-left rounded-xl border p-4 transition-all ${
                    mode === "virement"
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote
                      className={`w-4 h-4 ${
                        mode === "virement" ? "text-amber-400" : "text-white/60"
                      }`}
                    />
                    <span className="text-white font-semibold text-sm">
                      Virement bancaire
                    </span>
                  </div>
                  <p className="text-white/60 text-xs">
                    Règlement auprès de Hernan
                  </p>
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading
                ? "Envoi..."
                : mode === "online"
                ? "Continuer vers le paiement"
                : "Valider mon inscription"}
            </button>
            {mode === "online" && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                <p className="text-xs text-white/50">
                  Vous serez redirigé vers HelloAsso pour finaliser le paiement.
                </p>
                <p className="text-xs text-amber-300 mt-1">
                  Un don à HelloAsso est pré-sélectionné lors du paiement.
                  Celui-ci est facultatif et peut être modifié ou mis à 0&euro;.
                </p>
              </div>
            )}
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
