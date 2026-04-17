"use client";

import { useState } from "react";
import { CalendarCog, RefreshCw, Lock, Unlock, UserPlus, MessageCircle, Archive, Sparkles } from "lucide-react";
import { DB, QUOTA_DEFAULT } from "@/lib/types";
import { adminNotifyNewSeason } from "@/lib/db";

export default function SeasonSettings({
  db,
  onPersist,
  onRefresh,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [y1, setY1] = useState(db.y1);
  const [y2, setY2] = useState(db.y2);
  const currentQuota = db.quota ?? QUOTA_DEFAULT;
  const [quota, setQuota] = useState(currentQuota);
  const [whatsappLink, setWhatsappLink] = useState(db.whatsappLink || "");
  const [inscCloseDate, setInscCloseDate] = useState(db.insc_close_date || "");

  async function update() {
    await onPersist({
      ...db,
      y1: Number(y1),
      y2: Number(y2),
      quota: Number(quota),
      whatsappLink: whatsappLink.trim() || undefined,
      insc_close_date: inscCloseDate.trim() || undefined,
    });
    alert("Paramètres mis à jour !");
  }

  async function toggle() {
    await onPersist({ ...db, insc_open: !db.insc_open });
  }

  async function reset() {
    if (!confirm("Supprimer TOUS les adhérents ? Action irréversible.")) return;
    await onPersist({ ...db, membres: [] });
  }

  async function newSeason() {
    const newY1 = Number(prompt(`Année de début de la nouvelle saison (actuel: ${db.y1}) :`, String(db.y1 + 1)));
    if (!newY1 || isNaN(newY1)) return;
    const newY2 = newY1 + 1;
    if (!confirm(
      `Démarrer la saison ${newY1}–${newY2} ?\n\n` +
      `• Les ${db.membres.length} adhérents sont conservés mais remis en "non payé"\n` +
      `• Ils pourront se reconnecter et renouveler leur adhésion\n` +
      `• Ceux qui ne paient pas avant la date limite seront supprimés automatiquement`
    )) return;

    // Archive la saison actuelle
    const archive = {
      y1: db.y1, y2: db.y2,
      membresCount: db.membres.filter((m) => m.ok).length,
      config_tournois: db.config_tournois,
      inscrits_tournoi: db.inscrits_tournoi,
    };
    const prevArchives = db.archives ?? [];
    const filtered = prevArchives.filter((a) => !(a.y1 === db.y1 && a.y2 === db.y2));

    await onPersist({
      ...db,
      y1: newY1,
      y2: newY2,
      archives: [...filtered, archive],
      membres: db.membres.map((m) => ({ ...m, ok: false, paymentDate: undefined })),
      config_tournois: [],
      inscrits_tournoi: [],
      insc_open: true,
      insc_close_date: undefined,
    });
    alert(`✅ Nouvelle saison ${newY1}–${newY2} démarrée ! Tous les adhérents sont en attente de renouvellement.`);

    // Proposer d'envoyer un email à tous les anciens adhérents
    if (confirm(`Envoyer un email à tous les ${db.membres.length} adhérents pour les prévenir que la nouvelle saison est ouverte ?`)) {
      const r = await adminNotifyNewSeason();
      if (r.ok) alert(`✅ Email envoyé à ${r.sent} adhérent${(r.sent ?? 0) > 1 ? "s" : ""} !`);
      else alert("Erreur lors de l'envoi : " + r.reason);
    }
  }

  async function archiveSeason() {
    if (!confirm(`Archiver la saison ${db.y1}–${db.y2} ? Cela sauvegarde les tournois et résultats dans l'historique.`)) return;
    const archive = {
      y1: db.y1,
      y2: db.y2,
      membresCount: db.membres.length,
      config_tournois: db.config_tournois,
      inscrits_tournoi: db.inscrits_tournoi,
    };
    const prevArchives = db.archives ?? [];
    // Évite les doublons de saison
    const filtered = prevArchives.filter((a) => !(a.y1 === db.y1 && a.y2 === db.y2));
    await onPersist({
      ...db,
      archives: [...filtered, archive],
    });
    alert(`✅ Saison ${db.y1}–${db.y2} archivée !`);
  }

  return (
    <div className="glass p-4 md:p-6 border border-emerald-200">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <CalendarCog className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-slate-800">Paramètres saison</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input
          type="number"
          className="input"
          value={y1}
          onChange={(e) => setY1(Number(e.target.value))}
          placeholder="Année 1"
        />
        <input
          type="number"
          className="input"
          value={y2}
          onChange={(e) => setY2(Number(e.target.value))}
          placeholder="Année 2"
        />
      </div>

      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 block">
          Places disponibles
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            className="input flex-1"
            value={quota}
            min={db.membres.length}
            onChange={(e) => setQuota(Number(e.target.value))}
          />
          <span className="text-slate-400 text-sm whitespace-nowrap">
            {db.membres.length} / {quota} inscrits
          </span>
        </div>
        {db.membres.length >= currentQuota && (
          <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
            <UserPlus className="w-3 h-3" />
            Club complet — augmentez le quota pour accepter de nouveaux membres
          </p>
        )}
      </div>

      {/* Date de fermeture des inscriptions */}
      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          📅 Date limite d&apos;inscription
        </label>
        <input
          type="date"
          className="input w-full"
          value={inscCloseDate}
          onChange={(e) => setInscCloseDate(e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">
          Des rappels automatiques seront envoyés aux abonnés aux news à J-30 et J-15.
        </p>
      </div>

      {/* Lien WhatsApp */}
      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          <MessageCircle className="w-3 h-3" /> Lien groupe WhatsApp
        </label>
        <input
          type="url"
          className="input w-full"
          placeholder="https://chat.whatsapp.com/..."
          value={whatsappLink}
          onChange={(e) => setWhatsappLink(e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">
          Affiché après paiement et dans l&apos;espace membre.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={toggle}
          className={db.insc_open ? "btn-danger w-full" : "btn-accent w-full"}
        >
          {db.insc_open ? (
            <>
              <Lock className="w-4 h-4" /> Fermer les inscriptions
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4" /> Ouvrir les inscriptions
            </>
          )}
        </button>
        <button onClick={update} className="btn-accent w-full">
          <RefreshCw className="w-4 h-4" /> Mettre à jour les paramètres
        </button>
        <button onClick={archiveSeason} className="btn-ghost w-full">
          <Archive className="w-4 h-4" /> Archiver cette saison
        </button>
        <button onClick={newSeason} className="btn-accent w-full">
          <Sparkles className="w-4 h-4" /> Démarrer une nouvelle saison
        </button>
        <button onClick={reset} className="btn-danger w-full">
          Réinitialiser les adhérents
        </button>
      </div>
    </div>
  );
}
