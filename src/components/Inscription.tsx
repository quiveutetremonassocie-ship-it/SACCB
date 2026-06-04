"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, Lock, CreditCard, Banknote, Clock, MessageCircle, Eye, EyeOff, Plus, X } from "lucide-react";
import confetti from "canvas-confetti";
import { DB } from "@/lib/types";
import { publicAddMembre, publicMarkPaid } from "@/lib/db";

// 🎫 3 campagnes HelloAsso selon les types de personnes inscrites :
//  - tarif-adulte    = MIXTE (adulte + étudiant dans la même inscription)
//  - tarif-adulte-1  = ADULTE seul
//  - tarif-etudiant  = ÉTUDIANT seul
const HELLOASSO_BASE = "https://www.helloasso.com/associations/sainte-adresse-club-de-competition-du-badminton-s-a-c-c-b/evenements";
const HELLOASSO_BACK = encodeURIComponent("https://saccb.fr/?payment=success");
const DEFAULT_HELLOASSO_URLS = {
  mixte: `${HELLOASSO_BASE}/tarif-adulte?backUrl=${HELLOASSO_BACK}`,
  adulte: `${HELLOASSO_BASE}/tarif-adulte-1?backUrl=${HELLOASSO_BACK}`,
  etudiant: `${HELLOASSO_BASE}/tarif-etudiant?backUrl=${HELLOASSO_BACK}`,
} as const;

function pickHelloAssoUrl(
  personnes: { type: "Adulte" | "Etudiant" }[],
  customUrls?: { mixte?: string; adulte?: string; etudiant?: string },
): string {
  const urls = {
    mixte: customUrls?.mixte || DEFAULT_HELLOASSO_URLS.mixte,
    adulte: customUrls?.adulte || DEFAULT_HELLOASSO_URLS.adulte,
    etudiant: customUrls?.etudiant || DEFAULT_HELLOASSO_URLS.etudiant,
  };
  const hasAdulte = personnes.some((p) => p.type === "Adulte");
  const hasEtudiant = personnes.some((p) => p.type === "Etudiant");
  if (hasAdulte && hasEtudiant) return urls.mixte;
  if (hasEtudiant) return urls.etudiant;
  return urls.adulte; // adulte seul (ou fallback)
}

type PaymentMode = "online" | "virement";
type PersonType = "Adulte" | "Etudiant";
type Personne = {
  prenom: string;
  nom: string;
  type: PersonType;
  email?: string; // utilisé seulement si sameAccount = false
  code?: string;  // utilisé seulement si sameAccount = false
  tel?: string;   // utilisé seulement si sameAccount = false (sinon tel partagé)
};

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
  const [done, setDone] = useState<{ personnes: Personne[]; mode: PaymentMode } | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("online");
  const [showCode, setShowCode] = useState(false);
  const [showCodePerso, setShowCodePerso] = useState<Record<number, boolean>>({});
  const [newsOptIn, setNewsOptIn] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [rgpdOk, setRgpdOk] = useState(false);
  const [personnes, setPersonnes] = useState<Personne[]>([{ prenom: "", nom: "", type: "Adulte" }]);
  // Email + mot de passe partagés (utilisés par défaut)
  const [sharedEmail, setSharedEmail] = useState("");
  const [sharedTel, setSharedTel] = useState("");
  const [sharedCode, setSharedCode] = useState("");
  // Si décoché : chaque personne a son propre email + mot de passe
  const [sameAccount, setSameAccount] = useState(true);
  // 🛡️ Anti-bot
  const [honeypot, setHoneypot] = useState("");
  const [formOpenedAt] = useState(Date.now());
  // ⚠️ Modale d'avertissement "parler au bureau" — affichée 1 fois avant 1ère validation
  const [bureauWarningOpen, setBureauWarningOpen] = useState(false);
  const [bureauWarningAccepted, setBureauWarningAccepted] = useState(false);
  const whatsappLink = db.whatsappLink || null;

  const remaining = quota - membresCount;
  const progress = Math.min((membresCount / quota) * 100, 100);
  const totalPrice = personnes.reduce((sum, p) => sum + prix[p.type], 0);

  function updatePersonne(idx: number, field: keyof Personne, value: string) {
    setPersonnes(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function addPersonne() {
    if (personnes.length >= 5) return;
    setPersonnes(prev => [...prev, { prenom: "", nom: "", type: "Adulte", email: "", code: "", tel: "" }]);
  }

  function removePersonne(idx: number) {
    setPersonnes(prev => prev.filter((_, i) => i !== idx));
  }

  // Détection du retour depuis HelloAsso après paiement réussi
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;

    // Nouvelle clé (tableau) + rétrocompatibilité ancienne clé (scalaire)
    const rawIds = localStorage.getItem("saccb_pending_membre_ids");
    const rawOldId = localStorage.getItem("saccb_pending_membre_id");
    const pendingIds: string[] = rawIds
      ? JSON.parse(rawIds)
      : rawOldId
      ? [rawOldId]
      : [];
    const pendingPersonnes: Personne[] = JSON.parse(
      localStorage.getItem("saccb_pending_personnes") || "[]"
    );

    if (pendingIds.length === 0) {
      window.history.replaceState({}, "", window.location.pathname + "#inscription");
      return;
    }

    Promise.all(pendingIds.map(id => publicMarkPaid(id))).then((results) => {
      localStorage.removeItem("saccb_pending_membre_ids");
      localStorage.removeItem("saccb_pending_membre_id");
      localStorage.removeItem("saccb_pending_membre_nom");
      localStorage.removeItem("saccb_pending_membre_type");
      localStorage.removeItem("saccb_pending_personnes");

      if (results.some(r => r.ok)) {
        const validPersonnes = pendingPersonnes.length > 0
          ? pendingPersonnes
          : [{ prenom: localStorage.getItem("saccb_pending_membre_nom") || "", nom: "", type: "Adulte" as PersonType }];
        setDone({ personnes: validPersonnes, mode: "online" });
        confetti({ particleCount: 130, spread: 75, origin: { y: 0.6 } });
        results.filter(r => r.ok).forEach(() => onMembreAdded());
      }
      window.history.replaceState({}, "", window.location.pathname + "#inscription");
      setTimeout(() => {
        document.getElementById("inscription")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
  }, [onMembreAdded]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!db.insc_open) return;

    // ⚠️ Si la modale "parler au bureau" n'a pas encore été acceptée, on l'affiche.
    // Le formulaire ne sera soumis qu'après confirmation.
    if (!bureauWarningAccepted) {
      setBureauWarningOpen(true);
      return;
    }

    // 🛡️ Anti-bot : honeypot rempli ou soumission trop rapide (<3s)
    if (honeypot) return;
    if (Date.now() - formOpenedAt < 3000) {
      alert("Veuillez prendre quelques secondes pour vérifier vos informations avant de valider.");
      return;
    }

    const tel = sharedTel.trim();

    if (!rgpdOk) {
      alert("Vous devez accepter les CGU et la politique de confidentialité.");
      return;
    }

    for (const p of personnes) {
      if (!p.prenom.trim() || !p.nom.trim()) {
        alert("Veuillez remplir le prénom et le nom de chaque personne.");
        return;
      }
    }

    // Validation des emails/codes selon le mode
    const useSharedAccount = sameAccount || personnes.length === 1;
    if (useSharedAccount) {
      if (!sharedEmail.trim() || !/\S+@\S+\.\S+/.test(sharedEmail.trim())) {
        alert("Email invalide.");
        return;
      }
      if (sharedCode.length < 4) {
        alert("Le mot de passe doit contenir au moins 4 caractères.");
        return;
      }
      if (/^(.)\1+$/.test(sharedCode)) {
        alert("Le mot de passe ne peut pas être composé uniquement du même caractère.");
        return;
      }
    } else {
      // Comptes séparés : chaque personne doit avoir email + mdp + téléphone
      for (let i = 0; i < personnes.length; i++) {
        const p = personnes[i];
        const email = (p.email || "").trim();
        const code = (p.code || "").trim();
        const personTel = (p.tel || "").trim();
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
          alert(`Email invalide pour la personne ${i + 1} (${p.prenom || "?"}).`);
          return;
        }
        if (code.length < 4) {
          alert(`Le mot de passe de la personne ${i + 1} (${p.prenom || "?"}) doit faire au moins 4 caractères.`);
          return;
        }
        if (/^(.)\1+$/.test(code)) {
          alert(`Le mot de passe de la personne ${i + 1} ne peut pas être composé uniquement du même caractère.`);
          return;
        }
        if (personTel.length < 8) {
          alert(`Téléphone invalide pour la personne ${i + 1} (${p.prenom || "?"}).`);
          return;
        }
      }
      // Détecter doublons d'emails entre les personnes
      const emails = personnes.map((p) => (p.email || "").trim().toLowerCase());
      const uniqueEmails = new Set(emails);
      if (uniqueEmails.size !== emails.length) {
        alert("Chaque personne doit avoir une adresse email différente. Si vous voulez utiliser la même adresse, cochez « Mêmes identifiants pour tous ».");
        return;
      }
    }

    if (membresCount + personnes.length > quota) {
      alert(`Il ne reste que ${remaining} place${remaining > 1 ? "s" : ""} disponible${remaining > 1 ? "s" : ""} pour ${personnes.length} personne${personnes.length > 1 ? "s" : ""}.`);
      return;
    }

    // Téléphone partagé requis SEULEMENT en mode compte partagé (sinon chaque personne a le sien)
    if (useSharedAccount && (!tel || tel.length < 8)) {
      alert("Téléphone invalide.");
      return;
    }

    setLoading(true);

    // Si comptes séparés : pas "grouped" car chaque email est unique
    // Si compte partagé et plusieurs personnes : "grouped" (même email)
    const isGrouped = useSharedAccount && personnes.length > 1;
    const results: { ok: boolean; reason?: string; membreId?: string }[] = [];

    // Séquentiel pour éviter les collisions en DB
    for (const p of personnes) {
      const personEmail = useSharedAccount ? sharedEmail.trim() : (p.email || "").trim();
      const personCode = useSharedAccount ? sharedCode : (p.code || "");
      const personTel = useSharedAccount ? tel : (p.tel || "").trim();
      const r = await publicAddMembre({
        nom: `${p.prenom.trim()} ${p.nom.trim()}`.trim(),
        email: personEmail,
        tel: personTel,
        type: p.type,
        paymentMethod: mode,
        code: personCode,
        newsOptIn,
        photoConsent,
        grouped: isGrouped,
        website: honeypot,
      });
      results.push(r);
      if (!r.ok) break;
    }

    const failed = results.find(r => !r.ok);
    if (failed) {
      setLoading(false);
      alert(failed.reason || "Erreur lors de l'inscription.");
      return;
    }

    if (mode === "online") {
      const ids = results.map(r => r.membreId || "").filter(Boolean);
      localStorage.setItem("saccb_pending_membre_ids", JSON.stringify(ids));
      localStorage.setItem("saccb_pending_personnes", JSON.stringify(personnes));
      window.location.href = pickHelloAssoUrl(personnes, db.clubConfig?.helloassoUrls);
      return;
    }

    setLoading(false);
    setDone({ personnes, mode: "virement" });
    personnes.forEach(() => onMembreAdded());
    confetti({ particleCount: 130, spread: 75, origin: { y: 0.6 } });
  }

  return (
    <section id="inscription" className="bg-section-wrap bg-signup relative">
      <div className="section-pad relative">
        <div className="text-center mb-14">
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-emerald-600">Adhésion</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">
            Saison {db.y1}–{db.y2}
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Rejoignez l&apos;aventure SACCB. Quelques minutes suffisent.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-strong p-8 md:p-10 max-w-2xl mx-auto"
        >
          {/* Barre de progression */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-500">Places restantes</span>
              <span className={`font-semibold ${progress >= 90 ? "text-red-500 animate-pulse" : progress >= 75 ? "text-amber-500" : "text-emerald-600"}`}>
                {remaining} / {quota}
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ${
                  progress >= 90
                    ? "bg-gradient-to-r from-red-500 to-red-400 animate-pulse"
                    : progress >= 75
                    ? "bg-gradient-to-r from-amber-500 to-orange-400"
                    : "bg-gradient-to-r from-blue-500 to-emerald-500"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress >= 90 && remaining > 0 && (
              <p className="text-xs text-red-500 font-semibold mt-1.5 animate-pulse">
                ⚠️ Plus que {remaining} place{remaining > 1 ? "s" : ""} disponible{remaining > 1 ? "s" : ""} !
              </p>
            )}
            {progress >= 75 && progress < 90 && (
              <p className="text-xs text-amber-600 font-semibold mt-1.5">
                🏃 L’association se remplit vite, ne tardez pas !
              </p>
            )}
          </div>

          {!db.insc_open ? (
            <div className="text-center py-10">
              <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-red-500 mb-2">Inscriptions closes</h3>
              <p className="text-slate-500 text-sm">
                La période d&apos;inscription est terminée ou l’association est complète. À bientôt !
              </p>
            </div>
          ) : done ? (
            done.mode === "online" ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Paiement confirmé !</h3>
                <p className="text-slate-600 text-sm mb-4">
                  Merci, {done.personnes.length > 1 ? "vos adhésions sont validées" : "votre adhésion est validée"} !
                </p>
                <div className="space-y-3">
                  {done.personnes.map((p, i) => (
                    <Badge key={i} nom={`${p.prenom} ${p.nom}`} type={p.type} y1={db.y1} y2={db.y2} />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-4 mb-4">
                  Pensez à faire une capture d&apos;écran de votre badge.
                </p>
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold px-5 py-3 rounded-xl transition">
                    <MessageCircle className="w-5 h-5" />
                    Rejoindre le groupe WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <Clock className="w-14 h-14 text-amber-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  Inscription{done.personnes.length > 1 ? "s" : ""} enregistrée{done.personnes.length > 1 ? "s" : ""} !
                </h3>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-left">
                  <p className="text-amber-700 text-sm font-semibold mb-1">Paiement en attente</p>
                  <p className="text-slate-600 text-sm mb-2">
                    Merci. Pour finaliser {done.personnes.length > 1 ? "vos adhésions" : "votre adhésion"}, veuillez vous
                    rapprocher d&apos;un membre du bureau au prochain
                    entraînement afin de procéder au règlement.
                  </p>
                  <a href="/contact" className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition">
                    📩 Nous contacter
                  </a>
                </div>
                <div className="space-y-3">
                  {done.personnes.map((p, i) => (
                    <Badge key={i} nom={`${p.prenom} ${p.nom}`} type={p.type} y1={db.y1} y2={db.y2} />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-4 mb-4">
                  Pensez à faire une capture d&apos;écran de votre badge.
                </p>
                {whatsappLink && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
                    🔒 Le lien du groupe WhatsApp vous sera transmis une fois votre paiement validé par le bureau.
                  </div>
                )}
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 🛡️ Honeypot anti-bot — invisible pour les humains */}
              <div style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                <label>Ne pas remplir : <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
              </div>

              {/* ── Adhérents ── */}
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">
                  Adhérent{personnes.length > 1 ? "s" : ""}
                </p>
                <div className="space-y-3">
                  {personnes.map((p, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      {personnes.length > 1 && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Personne {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removePersonne(idx)}
                            className="text-slate-300 hover:text-red-400 transition"
                            title="Supprimer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          className="input"
                          placeholder="Prénom"
                          value={p.prenom}
                          onChange={e => updatePersonne(idx, "prenom", e.target.value)}
                          required
                        />
                        <input
                          className="input"
                          placeholder="Nom"
                          value={p.nom}
                          onChange={e => updatePersonne(idx, "nom", e.target.value)}
                          required
                        />
                      </div>
                      <select
                        className="input w-full"
                        value={p.type}
                        onChange={e => updatePersonne(idx, "type", e.target.value as PersonType)}
                      >
                        <option value="Adulte">Adulte ({prix.Adulte}€)</option>
                        <option value="Etudiant">Étudiant ({prix.Etudiant}€)</option>
                      </select>

                      {/* Email + mdp + tel individuels (uniquement si comptes séparés et plusieurs personnes) */}
                      {!sameAccount && personnes.length > 1 && (
                        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                            Coordonnées & identifiants
                          </p>
                          <input
                            className="input !text-sm"
                            type="email"
                            placeholder="Email pour cette personne"
                            value={p.email || ""}
                            onChange={(e) => updatePersonne(idx, "email", e.target.value)}
                            required
                          />
                          <input
                            className="input !text-sm"
                            type="tel"
                            placeholder="Téléphone"
                            value={p.tel || ""}
                            onChange={(e) => updatePersonne(idx, "tel", e.target.value)}
                            required
                          />
                          <div className="relative">
                            <input
                              className="input !text-sm pr-10"
                              type={showCodePerso[idx] ? "text" : "password"}
                              placeholder="Mot de passe (min. 4 caractères)"
                              minLength={4}
                              value={p.code || ""}
                              onChange={(e) => updatePersonne(idx, "code", e.target.value)}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowCodePerso({ ...showCodePerso, [idx]: !showCodePerso[idx] })}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              tabIndex={-1}
                            >
                              {showCodePerso[idx] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {personnes.length < 5 && (
                  <button
                    type="button"
                    onClick={addPersonne}
                    className="mt-2 w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl py-2.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter une personne
                  </button>
                )}

                {personnes.length > 1 && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total pour {personnes.length} personnes</span>
                    <span className="font-bold text-blue-700 text-lg">{totalPrice}€</span>
                  </div>
                )}
              </div>

              {/* ── Choix mode compte unique / séparé ── */}
              {personnes.length > 1 && (
                <label className="flex items-start gap-3 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="relative mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={sameAccount}
                      onChange={(e) => setSameAccount(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${sameAccount ? "bg-blue-500 border-blue-500" : "border-slate-300 bg-white"}`}>
                      {sameAccount && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <span className="text-sm text-slate-600 leading-snug">
                    <span className="font-medium text-slate-800">Mêmes identifiants pour tous</span>
                    <br />
                    <span className="text-xs text-slate-500">
                      Toutes les personnes utilisent le même email et le même mot de passe pour se connecter à leur espace membre. Décochez pour que chaque personne ait son propre compte.
                    </span>
                  </span>
                </label>
              )}

              {/* ── Email + téléphone + mot de passe partagés (si compte unique ou 1 seule personne) ── */}
              {(sameAccount || personnes.length === 1) && (
                <div className="space-y-3">
                  <input
                    className="input"
                    type="email"
                    placeholder="Email"
                    value={sharedEmail}
                    onChange={(e) => setSharedEmail(e.target.value)}
                    required
                  />
                  <input
                    className="input"
                    type="tel"
                    placeholder="Téléphone"
                    value={sharedTel}
                    onChange={(e) => setSharedTel(e.target.value)}
                    required
                  />
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-slate-500 mb-1">
                      Mot de passe personnel
                    </label>
                    <div className="relative">
                      <input
                        className="input pr-10"
                        type={showCode ? "text" : "password"}
                        placeholder="Minimum 4 caractères"
                        minLength={4}
                        value={sharedCode}
                        onChange={(e) => setSharedCode(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCode(!showCode)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        tabIndex={-1}
                      >
                        {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Ce mot de passe vous permettra de vous connecter à votre espace membre.
                      {personnes.length > 1 && " Partagé entre toutes les personnes inscrites."}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Mode de paiement ── */}
              <div className="pt-2">
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Mode de paiement</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setMode("online")}
                    className={`relative text-left rounded-xl border p-4 transition-all ${mode === "online" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className={`w-4 h-4 ${mode === "online" ? "text-emerald-500" : "text-slate-400"}`} />
                      <span className="font-semibold text-sm text-slate-800">Payer en ligne</span>
                    </div>
                    <p className="text-xs text-slate-500">Carte bancaire via HelloAsso (sécurisé)</p>
                  </button>
                  <button type="button" onClick={() => setMode("virement")}
                    className={`relative text-left rounded-xl border p-4 transition-all ${mode === "virement" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className={`w-4 h-4 ${mode === "virement" ? "text-amber-500" : "text-slate-400"}`} />
                      <span className="font-semibold text-sm text-slate-800">Virement bancaire</span>
                    </div>
                    <p className="text-xs text-slate-500">Règlement auprès d&apos;un membre du bureau</p>
                  </button>
                </div>
              </div>

              {/* RGPD */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative mt-0.5 shrink-0">
                  <input type="checkbox" checked={rgpdOk} onChange={e => setRgpdOk(e.target.checked)} className="sr-only" required />
                  <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${rgpdOk ? "bg-blue-500 border-blue-500" : "border-red-300 bg-white"}`}>
                    {rgpdOk && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-sm text-slate-600 leading-snug">
                  <span className="font-medium text-slate-800">J&apos;accepte les conditions <span className="text-red-500">*</span></span>
                  <br />
                  <span className="text-xs text-slate-500">
                    En m&apos;inscrivant, j&apos;accepte les{" "}
                    <a href="/cgu" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-700">CGU</a>
                    {" "}et la{" "}
                    <a href="/politique-confidentialite" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-700">politique de confidentialité</a>.
                    Mes données sont utilisées uniquement pour la gestion de l’association.
                  </span>
                </span>
              </label>

              {/* Newsletter */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative mt-0.5 shrink-0">
                  <input type="checkbox" checked={newsOptIn} onChange={e => setNewsOptIn(e.target.checked)} className="sr-only" />
                  <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${newsOptIn ? "bg-emerald-500 border-emerald-500" : "border-slate-300 bg-white"}`}>
                    {newsOptIn && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-sm text-slate-600 leading-snug">
                  <span className="font-medium text-slate-800">Recevoir les news de l’association</span>
                  <br />
                  <span className="text-xs text-slate-400">Nouveaux tournois, rappels d&apos;inscription, infos association</span>
                </span>
              </label>

              {/* Droit à l'image */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="relative mt-0.5 shrink-0">
                  <input type="checkbox" checked={photoConsent} onChange={e => setPhotoConsent(e.target.checked)} className="sr-only" />
                  <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${photoConsent ? "bg-violet-500 border-violet-500" : "border-slate-300 bg-white"}`}>
                    {photoConsent && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-sm text-slate-600 leading-snug">
                  <span className="font-medium text-slate-800">Droit à l&apos;image</span>
                  <br />
                  <span className="text-xs text-slate-400">
                    J&apos;autorise le SACCB à utiliser les photos et vidéos prises lors des événements de l'association (tournois, entraînements) à des fins de communication. Les photos publiées seront accessibles <strong>uniquement aux adhérents connectés</strong> à leur espace membre.
                  </span>
                </span>
              </label>

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading
                  ? "Envoi..."
                  : mode === "online"
                  ? `Continuer vers le paiement${personnes.length > 1 ? ` (${totalPrice}€)` : ""}`
                  : `Valider ${personnes.length > 1 ? "les inscriptions" : "mon inscription"}`}
              </button>

              {mode === "online" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">
                    Vous serez redirigé vers HelloAsso pour finaliser le paiement.
                    {personnes.length > 1 && (
                      <> Sélectionnez la quantité <strong>{personnes.length}</strong> sur HelloAsso.</>
                    )}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Un don à HelloAsso est pré-sélectionné lors du paiement.
                    Celui-ci est facultatif et peut être modifié ou mis à 0€.
                  </p>
                </div>
              )}
            </form>
          )}
        </motion.div>
      </div>

      {/* ⚠️ Modale d'avertissement "parler au bureau" — affichée 1 fois avant 1ère validation */}
      {bureauWarningOpen && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-7">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h3 className="font-display text-xl text-slate-800 tracking-wide leading-tight">Avant de continuer</h3>
                <p className="text-xs text-slate-500 mt-1">Une étape importante</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-sm text-slate-700 leading-relaxed">
                Avant de finaliser votre inscription, merci de prendre contact avec un <strong>membre du bureau</strong> pour qu&apos;il puisse <strong>accepter ou refuser</strong> votre adhésion.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                Cela nous permet de discuter avec vous, vérifier la disponibilité des créneaux et vous accueillir au mieux. Sans cet accord préalable, votre paiement pourrait être annulé.
              </p>
              <p className="text-xs text-amber-700 mt-3">
                👉 Contactez-nous via la <a href="/contact" className="underline font-semibold">page contact</a> si ce n&apos;est pas déjà fait.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setBureauWarningOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setBureauWarningAccepted(true);
                  setBureauWarningOpen(false);
                  // Re-soumettre le formulaire (l'utilisateur a déjà cliqué Valider)
                  setTimeout(() => {
                    const form = document.querySelector("form") as HTMLFormElement | null;
                    if (form) form.requestSubmit();
                  }, 50);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition shadow-sm"
              >
                ✓ J&apos;ai compris, continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Badge({ nom, type, y1, y2 }: { nom: string; type: string; y1: number; y2: number }) {
  return (
    <div className="relative max-w-sm mx-auto bg-gradient-to-br from-[#1e3a5f] to-[#0f2440] border-2 border-blue-400/60 rounded-2xl p-6 shadow-2xl shadow-blue-500/20 overflow-hidden">
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
        <span className="font-display text-lg text-white/70">ST-ADRESSE</span>
      </div>
    </div>
  );
}
