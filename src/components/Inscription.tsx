"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Lock,
  CreditCard,
  Banknote,
  Clock,
  MessageCircle,
  Eye,
  EyeOff,
  ArrowUpRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { DB } from "@/lib/types";
import { publicAddMembre, publicMarkPaid } from "@/lib/db";

const HELLOASSO_BASE_URL =
  "https://www.helloasso.com/associations/sainte-adresse-club-de-competition-du-badminton-s-a-c-c-b/evenements/tarif-adulte";
const HELLOASSO_URL = `${HELLOASSO_BASE_URL}?backUrl=${encodeURIComponent("https://saccb.fr/?payment=success")}`;

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
  const [done, setDone] = useState<{
    nom: string;
    type: string;
    mode: PaymentMode;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("online");
  const [showCode, setShowCode] = useState(false);
  const [newsOptIn, setNewsOptIn] = useState(false);
  const [rgpdOk, setRgpdOk] = useState(false);
  const whatsappLink = db.whatsappLink || null;

  const remaining = quota - membresCount;
  const progress = Math.min((membresCount / quota) * 100, 100);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;

    const pendingId = localStorage.getItem("saccb_pending_membre_id");
    const pendingNom = localStorage.getItem("saccb_pending_membre_nom");
    const pendingType = localStorage.getItem("saccb_pending_membre_type");
    if (!pendingId) {
      window.history.replaceState(
        {},
        "",
        window.location.pathname + "#inscription",
      );
      return;
    }

    publicMarkPaid(pendingId).then((r) => {
      localStorage.removeItem("saccb_pending_membre_id");
      localStorage.removeItem("saccb_pending_membre_nom");
      localStorage.removeItem("saccb_pending_membre_type");
      if (r.ok) {
        setDone({
          nom: pendingNom || "",
          type: pendingType || "Adulte",
          mode: "online",
        });
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        onMembreAdded();
      }
      window.history.replaceState(
        {},
        "",
        window.location.pathname + "#inscription",
      );
      setTimeout(() => {
        document
          .getElementById("inscription")
          ?.scrollIntoView({ behavior: "smooth" });
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
    const code = String(fd.get("code") || "").trim();

    if (!rgpdOk) {
      alert("Vous devez accepter les CGU et la politique de confidentialité.");
      setLoading(false);
      return;
    }
    if (membresCount >= quota) {
      alert("Le club est complet !");
      setLoading(false);
      return;
    }
    if (/^(.)\1+$/.test(code)) {
      alert(
        "Le code ne peut pas être composé uniquement du même chiffre (ex: 1111). Choisissez un code plus sécurisé.",
      );
      setLoading(false);
      return;
    }

    const r = await publicAddMembre({
      nom,
      email,
      tel,
      type,
      paymentMethod: mode,
      code,
      newsOptIn,
    });
    if (!r.ok) {
      setLoading(false);
      alert(r.reason || "Erreur");
      return;
    }

    if (mode === "online") {
      localStorage.setItem("saccb_pending_membre_id", r.membreId || "");
      localStorage.setItem("saccb_pending_membre_nom", nom);
      localStorage.setItem("saccb_pending_membre_type", type);
      window.location.href = HELLOASSO_URL;
      return;
    }

    setLoading(false);
    setDone({ nom, type, mode: "virement" });
    onMembreAdded();
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }

  return (
    <section id="inscription" className="bg-section-wrap bg-signup">
      <div className="section-pad">
        <header className="section-head">
          <div>
            <span className="section-index">06 — Adhésion</span>
            <h2 className="h-title text-5xl md:text-7xl lg:text-8xl mt-4">
              Rejoindre{" "}
              <span className="font-editorial italic font-normal">
                la saison {db.y1}–{db.y2}.
              </span>
            </h2>
          </div>
          <p className="hidden md:block text-[color:var(--muted)] max-w-xs text-right text-sm leading-relaxed">
            Adhésion en ligne ou par virement, quelques minutes suffisent.
          </p>
        </header>

        <div className="grid md:grid-cols-12 gap-12 md:gap-16">
          {/* Left side — form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-7"
          >
            {/* Progress */}
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-3">
                <span
                  className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted)] font-semibold"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                >
                  Places restantes
                </span>
                <span
                  className={`font-display text-3xl tabular-nums ${progress >= 90 ? "text-[color:var(--danger)]" : progress >= 75 ? "text-[color:var(--gold)]" : "text-[color:var(--ink)]"}`}
                >
                  {remaining}
                  <span className="text-[color:var(--muted)] text-lg">
                    {" "}
                    / {quota}
                  </span>
                </span>
              </div>
              <div className="h-[2px] bg-[color:var(--line)] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${progress}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  className={`h-full ${
                    progress >= 90
                      ? "bg-[color:var(--danger)]"
                      : progress >= 75
                        ? "bg-[color:var(--gold)]"
                        : "bg-[color:var(--ink)]"
                  }`}
                />
              </div>
              {progress >= 90 && remaining > 0 && (
                <p
                  className="text-xs text-[color:var(--danger)] mt-2 uppercase tracking-[0.22em] font-semibold"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                >
                  Plus que {remaining} place{remaining > 1 ? "s" : ""}
                </p>
              )}
              {progress >= 75 && progress < 90 && (
                <p
                  className="text-xs text-[color:var(--gold)] mt-2 uppercase tracking-[0.22em] font-semibold"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                >
                  Le club se remplit — ne tardez pas
                </p>
              )}
            </div>

            {!db.insc_open ? (
              <div className="py-20 text-center border-y border-[color:var(--line-strong)]">
                <Lock className="w-10 h-10 text-[color:var(--muted)] mx-auto mb-5" />
                <h3 className="font-display text-3xl text-[color:var(--ink)] tracking-tight mb-2">
                  Inscriptions closes
                </h3>
                <p className="text-[color:var(--muted)] text-sm max-w-sm mx-auto">
                  La période d&apos;inscription est terminée ou le club est
                  complet. À bientôt !
                </p>
              </div>
            ) : done ? (
              done.mode === "online" ? (
                <div className="py-10 border-t border-[color:var(--line)]">
                  <CheckCircle2 className="w-10 h-10 text-[color:var(--forest)] mb-5" />
                  <h3 className="font-display text-4xl text-[color:var(--ink)] tracking-tight mb-3">
                    Paiement confirmé.
                  </h3>
                  <p className="text-[color:var(--ink)]/75 mb-6">
                    Merci {done.nom}, votre adhésion est validée.
                  </p>
                  <Badge
                    nom={done.nom}
                    type={done.type}
                    y1={db.y1}
                    y2={db.y2}
                  />
                  <p className="text-xs text-[color:var(--muted)] mt-4 mb-6">
                    Pensez à faire une capture d&apos;écran de votre badge.
                  </p>
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white text-[12px] uppercase font-semibold tracking-[0.22em]"
                      style={{ fontFamily: "Oswald, sans-serif" }}
                    >
                      <MessageCircle className="w-4 h-4" />
                      Rejoindre WhatsApp
                    </a>
                  )}
                </div>
              ) : (
                <div className="py-10 border-t border-[color:var(--line)]">
                  <Clock className="w-10 h-10 text-[color:var(--gold)] mb-5" />
                  <h3 className="font-display text-4xl text-[color:var(--ink)] tracking-tight mb-3">
                    Inscription enregistrée.
                  </h3>
                  <div className="border-l-2 border-[color:var(--gold)] pl-5 mb-6">
                    <p
                      className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--gold)] font-semibold mb-2"
                      style={{ fontFamily: "Oswald, sans-serif" }}
                    >
                      Paiement en attente
                    </p>
                    <p className="text-[color:var(--ink)]/80 text-sm leading-relaxed">
                      Merci {done.nom}. Pour finaliser votre adhésion,
                      rapprochez-vous de{" "}
                      <strong className="font-semibold">Hernan</strong> au
                      prochain entraînement pour le virement bancaire.
                    </p>
                  </div>
                  <Badge
                    nom={done.nom}
                    type={done.type}
                    y1={db.y1}
                    y2={db.y2}
                  />
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white text-[12px] uppercase font-semibold tracking-[0.22em]"
                      style={{ fontFamily: "Oswald, sans-serif" }}
                    >
                      <MessageCircle className="w-4 h-4" />
                      Rejoindre WhatsApp
                    </a>
                  )}
                </div>
              )
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Nom et prénom</label>
                    <input
                      className="input"
                      name="nom"
                      placeholder="Jean Dupont"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      className="input"
                      name="email"
                      type="email"
                      placeholder="vous@email.fr"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Téléphone</label>
                    <input
                      className="input"
                      name="tel"
                      type="tel"
                      placeholder="06 00 00 00 00"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Tarif</label>
                    <select className="input" name="type" defaultValue="Adulte">
                      <option value="Adulte">Adulte — {prix.Adulte}€</option>
                      <option value="Etudiant">
                        Étudiant — {prix.Etudiant}€
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Code personnel</label>
                  <div className="relative">
                    <input
                      className="input pr-10"
                      name="code"
                      type={showCode ? "text" : "password"}
                      placeholder="Minimum 4 chiffres (ex : 1234)"
                      pattern="\d{4,}"
                      inputMode="numeric"
                      title="Le code doit contenir au moins 4 chiffres"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[color:var(--muted)] hover:text-[color:var(--ink)] transition-colors"
                      tabIndex={-1}
                      aria-label={
                        showCode ? "Masquer le code" : "Afficher le code"
                      }
                    >
                      {showCode ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-[color:var(--muted)] mt-2">
                    Pour vous connecter à votre espace membre depuis un autre
                    appareil.
                  </p>
                </div>

                <div>
                  <p className="label">Mode de paiement</p>
                  <div className="grid sm:grid-cols-2 gap-px bg-[color:var(--line-strong)] border border-[color:var(--line-strong)]">
                    <button
                      type="button"
                      onClick={() => setMode("online")}
                      className={`relative text-left p-5 transition-colors ${
                        mode === "online"
                          ? "bg-[color:var(--ink)] text-[color:var(--bone)]"
                          : "bg-[color:var(--paper)] hover:bg-[color:var(--bone-2)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <CreditCard className="w-4 h-4" />
                        <span
                          className="text-[11px] uppercase tracking-[0.22em] font-semibold"
                          style={{ fontFamily: "Oswald, sans-serif" }}
                        >
                          Paiement en ligne
                        </span>
                      </div>
                      <p
                        className={`text-xs ${mode === "online" ? "text-[color:var(--bone)]/80" : "text-[color:var(--muted)]"}`}
                      >
                        Carte bancaire via HelloAsso
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("virement")}
                      className={`relative text-left p-5 transition-colors ${
                        mode === "virement"
                          ? "bg-[color:var(--ink)] text-[color:var(--bone)]"
                          : "bg-[color:var(--paper)] hover:bg-[color:var(--bone-2)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Banknote className="w-4 h-4" />
                        <span
                          className="text-[11px] uppercase tracking-[0.22em] font-semibold"
                          style={{ fontFamily: "Oswald, sans-serif" }}
                        >
                          Virement bancaire
                        </span>
                      </div>
                      <p
                        className={`text-xs ${mode === "virement" ? "text-[color:var(--bone)]/80" : "text-[color:var(--muted)]"}`}
                      >
                        Règlement auprès de Hernan
                      </p>
                    </button>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-4 pt-2">
                  <CheckRow
                    checked={rgpdOk}
                    onChange={setRgpdOk}
                    required
                    accent="ink"
                    title={
                      <>
                        J&apos;accepte les conditions{" "}
                        <span className="text-[color:var(--danger)]">*</span>
                      </>
                    }
                    subtitle={
                      <>
                        En m&apos;inscrivant, j&apos;accepte les{" "}
                        <a
                          href="/cgu"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-reveal"
                        >
                          CGU
                        </a>{" "}
                        et la{" "}
                        <a
                          href="/politique-confidentialite"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-reveal"
                        >
                          politique de confidentialité
                        </a>
                        .
                      </>
                    }
                  />
                  <CheckRow
                    checked={newsOptIn}
                    onChange={setNewsOptIn}
                    accent="gold"
                    title="Recevoir les news du club"
                    subtitle="Nouveaux tournois, rappels d'inscription, infos club."
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full group inline-flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  <span>
                    {loading
                      ? "Envoi…"
                      : mode === "online"
                        ? "Continuer vers le paiement"
                        : "Valider mon inscription"}
                  </span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </button>

                {mode === "online" && (
                  <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                    Vous serez redirigé vers HelloAsso pour finaliser le
                    paiement. Un don est pré-sélectionné par la plateforme : il
                    est facultatif et peut être modifié ou mis à 0€.
                  </p>
                )}
              </form>
            )}
          </motion.div>

          {/* Right side — visual accent */}
          <aside className="md:col-span-5">
            <div className="md:sticky md:top-28">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="border border-[color:var(--line-strong)] p-10 bg-[color:var(--card)]"
              >
                <p
                  className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--gold)] font-semibold mb-6"
                  style={{ fontFamily: "Oswald, sans-serif" }}
                >
                  Ce qui est compris
                </p>
                <ul className="space-y-5">
                  {[
                    {
                      k: "Accès illimité",
                      v: "Trois créneaux hebdomadaires, toute la saison.",
                    },
                    {
                      k: "Volants fournis",
                      v: "Plumes de qualité pour l'entraînement.",
                    },
                    {
                      k: "Tournois internes",
                      v: "Doubles hommes, dames et mixtes toute l'année.",
                    },
                    {
                      k: "Vie du club",
                      v: "Groupe WhatsApp, événements, convivialité.",
                    },
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-4 pb-5 border-b border-[color:var(--line)] last:border-0 last:pb-0"
                    >
                      <span
                        className="text-[10px] tracking-[0.28em] text-[color:var(--muted)] font-semibold pt-1"
                        style={{ fontFamily: "Oswald, sans-serif" }}
                      >
                        0{i + 1}
                      </span>
                      <div>
                        <p className="font-display text-xl text-[color:var(--ink)] tracking-tight">
                          {item.k}
                        </p>
                        <p className="text-sm text-[color:var(--muted)] mt-1 leading-relaxed">
                          {item.v}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-10 pt-8 border-t border-[color:var(--line-strong)]">
                  <p
                    className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--muted)] font-semibold mb-4"
                    style={{ fontFamily: "Oswald, sans-serif" }}
                  >
                    Tarif de
                  </p>
                  <p className="flex items-baseline gap-2">
                    <span className="font-display text-7xl text-[color:var(--ink)] tracking-tight leading-none">
                      {prix.Adulte}
                    </span>
                    <span className="text-lg text-[color:var(--muted)]">
                      € / an
                    </span>
                  </p>
                  <p className="text-sm text-[color:var(--muted)] mt-2">
                    Tarif étudiant : {prix.Etudiant}€.
                  </p>
                </div>
              </motion.div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function CheckRow({
  checked,
  onChange,
  title,
  subtitle,
  required,
  accent = "ink",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  required?: boolean;
  accent?: "ink" | "gold";
}) {
  const borderClass = checked
    ? accent === "gold"
      ? "bg-[color:var(--gold)] border-[color:var(--gold)]"
      : "bg-[color:var(--ink)] border-[color:var(--ink)]"
    : required && !checked
      ? "border-[color:var(--danger)]"
      : "border-[color:var(--line-strong)]";

  return (
    <label className="flex items-start gap-4 cursor-pointer select-none group">
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          required={required}
        />
        <span
          className={`w-5 h-5 border-2 transition-colors flex items-center justify-center ${borderClass}`}
        >
          {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
        </span>
      </span>
      <span className="text-sm leading-snug">
        <span className="font-semibold text-[color:var(--ink)]">{title}</span>
        <span className="block text-xs text-[color:var(--muted)] mt-1">
          {subtitle}
        </span>
      </span>
    </label>
  );
}

function Badge({
  nom,
  type,
  y1,
  y2,
}: {
  nom: string;
  type: string;
  y1: number;
  y2: number;
}) {
  return (
    <div className="relative max-w-sm bg-[color:var(--ink)] text-[color:var(--bone)] p-7 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[color:var(--gold)]" />
      </div>
      <p
        className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--gold)] font-semibold mb-4"
        style={{ fontFamily: "Oswald, sans-serif" }}
      >
        Membre officiel · SACCB
      </p>
      <p className="font-display text-3xl tracking-tight">{nom}</p>
      <p
        className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--bone)]/60 mt-1"
        style={{ fontFamily: "Oswald, sans-serif" }}
      >
        Saison {y1}–{y2}
      </p>
      <div className="flex items-end justify-between mt-8 pt-4 border-t border-[color:var(--bone)]/15">
        <span
          className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--bone)]/70"
          style={{ fontFamily: "Oswald, sans-serif" }}
        >
          {type}
        </span>
        <span className="font-display text-sm text-[color:var(--bone)]/50 tracking-[0.15em]">
          ST-ADRESSE · 76310
        </span>
      </div>
    </div>
  );
}
