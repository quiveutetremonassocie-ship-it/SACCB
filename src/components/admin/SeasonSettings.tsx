"use client";

import { useState } from "react";
import { CalendarCog, RefreshCw, Lock, Unlock, UserPlus, MessageCircle, Archive, Sparkles, Trash2, Pencil, Check, X, RotateCcw, ShieldCheck, Plus, Mail, KeyRound, Settings, Clock, ListChecks, Building2, ChevronDown } from "lucide-react";
import { DB, QUOTA_DEFAULT, SeasonArchive, ADMIN_SECTIONS, ClubConfig, ScheduleSlot, DEFAULT_HORAIRES } from "@/lib/types";
import { adminNotifyNewSeason } from "@/lib/db";
import ArchiveEditModal from "./ArchiveEditModal";

const SUPER_ADMINS = ["gabin.binay@gmail.com", "hernancm68@hotmail.com"];

// 🎭 Rôles prédéfinis avec permissions pré-sélectionnées
const ADMIN_ROLES = [
  {
    key: "president",
    label: "President",
    emoji: "👑",
    permissions: ["membres", "comptabilite", "tournois", "actualites", "inscriptions", "engagement", "rules", "bureau", "emailing", "saison"],
  },
  {
    key: "tresorier",
    label: "Tresorier",
    emoji: "💰",
    permissions: ["membres", "comptabilite", "inscriptions", "saison"],
  },
  {
    key: "secretaire",
    label: "Secretaire",
    emoji: "📝",
    permissions: ["membres", "actualites", "emailing", "engagement", "bureau", "rules"],
  },
  {
    key: "responsable_tournois",
    label: "Resp. tournois",
    emoji: "🏸",
    permissions: ["tournois", "inscriptions", "emailing"],
  },
];

export default function SeasonSettings({
  db,
  onPersist,
  onRefresh,
  adminEmail,
  adminCode,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  onRefresh: () => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
}) {
  const isSuperAdmin = SUPER_ADMINS.includes(adminEmail?.toLowerCase() ?? "");
  const [y1, setY1] = useState(db.y1);
  const [y2, setY2] = useState(db.y2);
  const currentQuota = db.quota ?? QUOTA_DEFAULT;
  const [quota, setQuota] = useState(currentQuota);
  const [whatsappLink, setWhatsappLink] = useState(db.whatsappLink || "");
  const [presidentName, setPresidentName] = useState(db.presidentName || "");
  const [emailSignature, setEmailSignature] = useState(db.emailSignature || "");
  const [inscCloseDate, setInscCloseDate] = useState(db.insc_close_date || "");
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [contactEmailInput, setContactEmailInput] = useState("");
  const [credEmail, setCredEmail] = useState("");
  const [credCode, setCredCode] = useState("");
  const [credReadOnly, setCredReadOnly] = useState(false);

  // Expanded permissions panels
  const [expandedAdminEmail, setExpandedAdminEmail] = useState<string | null>(null);
  const [expandedAdminCred, setExpandedAdminCred] = useState<string | null>(null);

  // Edition archive
  const [editingArchiveIdx, setEditingArchiveIdx] = useState<number | null>(null);
  const [editArchiveY1, setEditArchiveY1] = useState(0);
  const [editArchiveY2, setEditArchiveY2] = useState(0);
  // Modal d'édition complète d'une archive (tournois, inscrits, compte-rendus)
  const [archiveContentIdx, setArchiveContentIdx] = useState<number | null>(null);

  async function update() {
    await onPersist({
      ...db,
      y1: Number(y1),
      y2: Number(y2),
      quota: Number(quota),
      whatsappLink: whatsappLink.trim() || undefined,
      insc_close_date: inscCloseDate.trim() || undefined,
      presidentName: presidentName.trim() || undefined,
      emailSignature: emailSignature.trim() || undefined,
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

  async function restoreFromArchive(archive: SeasonArchive) {
    const count = archive.config_tournois?.length ?? 0;
    if (count === 0) { alert("Cette archive ne contient aucun tournoi."); return; }
    if (!confirm(
      `Restaurer les ${count} tournoi(s) de la saison ${archive.y1}–${archive.y2} dans la saison active ?\n\n` +
      `Les tournois actuels seront remplacés.`
    )) return;
    await onPersist({
      ...db,
      config_tournois: archive.config_tournois ?? [],
      inscrits_tournoi: archive.inscrits_tournoi ?? [],
    });
    alert(`✅ ${count} tournoi(s) restauré(s) !`);
  }

  async function deleteArchive(idx: number) {
    const archive = db.archives![idx];
    if (!confirm(`Supprimer définitivement l'archive de la saison ${archive.y1}–${archive.y2} ?\n\nCette action est irréversible.`)) return;
    const newArchives = (db.archives ?? []).filter((_, i) => i !== idx);
    await onPersist({ ...db, archives: newArchives });
  }

  function startEditArchive(idx: number) {
    const a = db.archives![idx];
    setEditingArchiveIdx(idx);
    setEditArchiveY1(a.y1);
    setEditArchiveY2(a.y2);
  }

  async function saveArchiveEdit(idx: number) {
    const newArchives = (db.archives ?? []).map((a, i) =>
      i === idx ? { ...a, y1: editArchiveY1, y2: editArchiveY2 } : a
    );
    await onPersist({ ...db, archives: newArchives });
    setEditingArchiveIdx(null);
  }

  async function reopenForDays() {
    const daysStr = prompt(
      "Rouvrir les inscriptions pendant combien de jours ?\n\n" +
      "Exemple : 5 → ouvre maintenant et ferme automatiquement dans 5 jours.\n" +
      "Les rappels J-5/J-1 partiront automatiquement aux non-payés.",
      "5"
    );
    if (!daysStr) return;
    const days = parseInt(daysStr.trim(), 10);
    if (isNaN(days) || days < 1 || days > 365) {
      alert("Nombre de jours invalide (entre 1 et 365).");
      return;
    }
    // Calcul de la nouvelle dateLimit = aujourd'hui + N jours (format ISO YYYY-MM-DD)
    const newCloseDate = new Date();
    newCloseDate.setDate(newCloseDate.getDate() + days);
    const isoDate = newCloseDate.toISOString().slice(0, 10);
    const formatted = newCloseDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    if (!confirm(
      `Rouvrir les inscriptions jusqu'au ${formatted} (dans ${days} jour${days > 1 ? "s" : ""}) ?\n\n` +
      `• Les inscriptions seront ouvertes immédiatement\n` +
      `• Elles se fermeront automatiquement à cette date\n` +
      `• Les rappels automatiques aux non-payés sont DÉSACTIVÉS pendant cette période\n` +
      `  (pour ne pas spammer les adhérents existants avec des rappels qui ne les concernent pas)`
    )) return;

    setInscCloseDate(isoDate);
    await onPersist({
      ...db,
      insc_open: true,
      insc_close_date: isoDate,
      seasonRemindersDisabled: true, // pas de rappels J-X aux adhérents existants
    });
    alert(`✅ Inscriptions rouvertes jusqu'au ${formatted}.\n\nLes rappels automatiques sont désactivés pendant cette période.`);
  }

  async function newSeason() {
    const newY1 = Number(prompt(`Année de début de la nouvelle saison (actuel: ${db.y1}) :`, String(db.y1 + 1)));
    if (!newY1 || isNaN(newY1)) return;
    const newY2 = newY1 + 1;

    // Demander la date limite (suggestion : 30 septembre de la nouvelle année)
    const defaultDate = `${newY1}-09-30`;
    const dateLimitInput = prompt(
      `Date limite d'inscription / paiement pour cette saison ?\n\n` +
      `Format : AAAA-MM-JJ (ex: ${defaultDate})\n\n` +
      `Les adhérents non payés à cette date seront supprimés automatiquement.\n` +
      `Laisser vide pour ne pas configurer de date limite.`,
      defaultDate
    );

    let inscCloseDate: string | undefined = undefined;
    if (dateLimitInput && dateLimitInput.trim()) {
      const trimmed = dateLimitInput.trim();
      // Validation basique format ISO YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        alert("Format de date invalide. Utilisez AAAA-MM-JJ (ex: 2027-09-30).\nDémarrage annulé.");
        return;
      }
      inscCloseDate = trimmed;
    }

    const dateInfo = inscCloseDate
      ? `• Date limite : ${new Date(inscCloseDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
      : `• Aucune date limite configurée (à régler plus tard)`;

    const polls = (db.polls ?? []).length;
    const agItems = (db.agItems ?? []).length;
    const archiveNote =
      polls + agItems > 0
        ? `\n• ⚠️ Les ${polls} sondage${polls > 1 ? "s" : ""} et ${agItems} question${agItems > 1 ? "s" : ""} d'AG actuels seront SUPPRIMÉS définitivement\n  (les résultats tournois et compte-rendus sont eux archivés)`
        : "";

    if (!confirm(
      `Démarrer la saison ${newY1}–${newY2} ?\n\n` +
      `• Les ${db.membres.length} adhérents sont conservés mais remis en "non payé"\n` +
      `• Ils pourront se reconnecter et renouveler leur adhésion\n` +
      archiveNote + "\n" +
      `${dateInfo}\n` +
      `• Ceux qui ne paient pas avant la date limite seront supprimés automatiquement`
    )) return;

    // Archive minimaliste : on garde UNIQUEMENT ce qui sert vraiment sur la durée
    // - résultats tournois (historique + classement membres)
    // - comptes-rendus (utiles aux nouveaux adhérents pour les décisions passées)
    // Les sondages et questions AG sont supprimés définitivement : une fois closes,
    // ils n'apportent plus de valeur et encombrent l'admin au fil des saisons.
    const archive = {
      y1: db.y1, y2: db.y2,
      membresCount: db.membres.filter((m) => m.ok).length,
      config_tournois: db.config_tournois,
      inscrits_tournoi: db.inscrits_tournoi,
      reunionReports: db.reunionReports ?? [],
    };
    const prevArchives = db.archives ?? [];
    const filtered = prevArchives.filter((a) => !(a.y1 === db.y1 && a.y2 === db.y2));

    await onPersist({
      ...db,
      y1: newY1,
      y2: newY2,
      archives: [...filtered, archive],
      membres: db.membres.map((m) => ({ ...m, ok: false, paymentDate: undefined })),
      insc_open: true,
      insc_close_date: inscCloseDate,
      // Réactive les rappels automatiques (au cas où ils étaient désactivés par une réouverture temporaire précédente)
      seasonRemindersDisabled: false,
      // Reset engagement pour la nouvelle saison
      polls: [],
      agItems: [],
      reunionReports: [],
    });
    alert(`✅ Nouvelle saison ${newY1}–${newY2} démarrée !${inscCloseDate ? `\nDate limite : ${new Date(inscCloseDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}`);

    if (confirm(`Envoyer un email à tous les ${db.membres.length} adhérents pour les prévenir que la nouvelle saison est ouverte ?`)) {
      if (!adminEmail || !adminCode) {
        alert("Identifiants admin manquants pour envoyer les emails.");
        return;
      }
      const r = await adminNotifyNewSeason(adminEmail, adminCode);
      if (r.ok) alert(`✅ Email envoyé à ${r.sent} adhérent${(r.sent ?? 0) > 1 ? "s" : ""} !`);
      else alert("Erreur lors de l'envoi : " + r.reason);
    }
  }

  return (
    <div className="glass p-4 md:p-6 border border-emerald-200">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <CalendarCog className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-slate-800">Paramètres saison</h3>
      </div>

      {readOnly && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
          Accès en lecture seule pour cette section.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <input type="number" className="input" value={y1} onChange={(e) => setY1(Number(e.target.value))} placeholder="Année 1" disabled={readOnly} />
        <input type="number" className="input" value={y2} onChange={(e) => setY2(Number(e.target.value))} placeholder="Année 2" disabled={readOnly} />
      </div>

      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 block">Places disponibles</label>
        <div className="flex items-center gap-3">
          <input type="number" className="input flex-1" value={quota} min={db.membres.length} onChange={(e) => setQuota(Number(e.target.value))} disabled={readOnly} />
          <span className="text-slate-400 text-sm whitespace-nowrap">{db.membres.length} / {quota} inscrits</span>
        </div>
        {db.membres.length >= currentQuota && (
          <p className="text-amber-600 text-xs mt-1 flex items-center gap-1">
            <UserPlus className="w-3 h-3" /> Association complète — augmentez le quota pour accepter de nouveaux membres
          </p>
        )}
      </div>

      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          📅 Date limite d&apos;inscription
        </label>
        <input type="date" className="input w-full" value={inscCloseDate} onChange={(e) => setInscCloseDate(e.target.value)} disabled={readOnly} />
        <p className="text-xs text-slate-400 mt-1">Des rappels automatiques seront envoyés aux abonnés aux news à J-30 et J-15.</p>
      </div>

      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          <MessageCircle className="w-3 h-3" /> Lien groupe WhatsApp
        </label>
        <input type="url" className="input w-full" placeholder="https://chat.whatsapp.com/..." value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} disabled={readOnly} />
        <p className="text-xs text-slate-400 mt-1">Affiché après paiement et dans l&apos;espace membre.</p>
      </div>

      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Nom du président
        </label>
        <input
          type="text"
          className="input w-full"
          placeholder="Hernan Camara"
          value={presidentName}
          onChange={(e) => setPresidentName(e.target.value)}
          disabled={readOnly}
        />
        <p className="text-xs text-slate-400 mt-1">Apparaît sur les reçus de cotisation. Laisse vide pour conserver le nom par défaut.</p>
      </div>

      {/* ✍️ Signature commune pour les mails manuels */}
      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          ✍️ Signature des emails (commune)
        </label>
        <textarea
          className="input w-full min-h-[90px] resize-y"
          placeholder={"Ex:\nSportivement,\nLe bureau du SACCB"}
          value={emailSignature}
          onChange={(e) => setEmailSignature(e.target.value)}
          disabled={readOnly}
          maxLength={500}
        />
        <p className="text-xs text-slate-400 mt-1">
          Pré-remplie à la fin de chaque nouveau mail manuel (Envoi d&apos;emails). L&apos;admin peut toujours la modifier ou la retirer pour un mail spécifique. Laisse vide pour ne rien pré-remplir.
        </p>
      </div>

      {/* 🔑 Toggle 2FA admin */}
      <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={db.require2FA === true}
            disabled={readOnly}
            onChange={(e) => onPersist({ ...db, require2FA: e.target.checked })}
            className="mt-0.5"
          />
          <div className="flex-1">
            <span className="text-sm font-semibold text-slate-800">🔐 Double authentification admin (2FA)</span>
            <p className="text-xs text-slate-600 mt-0.5">
              Quand activée, chaque connexion admin envoie un code à 6 chiffres par email à saisir avant d&apos;accéder au panneau.
              Très fortement recommandé pour les comptes ayant tous les droits.
            </p>
          </div>
        </label>
      </div>

      {/* ⚙️ Configuration du club */}
      <ClubConfigSection db={db} onPersist={onPersist} readOnly={readOnly} />

      {/* 👁️ Toggles de visibilité des sections du site public */}
      <SectionVisibilityToggles db={db} onPersist={onPersist} readOnly={readOnly} />

      {!readOnly && (
        <div className="space-y-3">
          <button onClick={toggle} className={db.insc_open ? "btn-danger w-full" : "btn-accent w-full"}>
            {db.insc_open ? <><Lock className="w-4 h-4" /> Fermer les inscriptions</> : <><Unlock className="w-4 h-4" /> Ouvrir les inscriptions</>}
          </button>
          {/* Réouverture temporaire avec fermeture auto après N jours */}
          <button onClick={reopenForDays} className="btn-accent w-full !bg-gradient-to-r !from-amber-500 !to-orange-500">
            <Clock className="w-4 h-4" /> Rouvrir temporairement (N jours)
          </button>
          <button onClick={update} className="btn-accent w-full">
            <RefreshCw className="w-4 h-4" /> Mettre à jour les paramètres
          </button>
          <button onClick={newSeason} className="btn-accent w-full">
            <Sparkles className="w-4 h-4" /> Démarrer une nouvelle saison
          </button>
          <button onClick={reset} className="btn-danger w-full">
            Réinitialiser les adhérents
          </button>
        </div>
      )}

      {/* Gestion des archives */}
      {db.archives && db.archives.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
            <Archive className="w-3 h-3" /> Archives des saisons
          </p>
          <div className="space-y-2">
            {db.archives.map((archive, idx) => (
              <div key={`${archive.y1}-${archive.y2}-${idx}`} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                {editingArchiveIdx === idx ? (
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-slate-500 font-medium">Modifier les années de la saison</p>
                    <div className="flex gap-2">
                      <input type="number" className="input !text-sm flex-1" value={editArchiveY1} onChange={(e) => setEditArchiveY1(Number(e.target.value))} placeholder="Année début" />
                      <input type="number" className="input !text-sm flex-1" value={editArchiveY2} onChange={(e) => setEditArchiveY2(Number(e.target.value))} placeholder="Année fin" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveArchiveEdit(idx)} className="btn-primary !px-3 !py-1.5 !text-xs flex-1">
                        <Check className="w-3.5 h-3.5" /> Enregistrer
                      </button>
                      <button onClick={() => setEditingArchiveIdx(null)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                        <X className="w-3.5 h-3.5" /> Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Saison {archive.y1}–{archive.y2}</p>
                      <p className="text-xs text-slate-400">
                        {archive.membresCount} adhérents · {archive.config_tournois?.length ?? 0} tournoi{(archive.config_tournois?.length ?? 0) > 1 ? "s" : ""}
                        {(archive.reunionReports?.length ?? 0) > 0 && ` · ${archive.reunionReports?.length} compte-rendu${(archive.reunionReports?.length ?? 0) > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {(archive.config_tournois?.length ?? 0) > 0 && (
                        <button
                          onClick={() => restoreFromArchive(archive)}
                          className="btn-ghost !px-2 !py-1 !text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                          title="Restaurer les tournois dans la saison active"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setArchiveContentIdx(idx)}
                        className="btn-primary !px-2 !py-1 !text-xs !bg-gradient-to-r !from-sky-500 !to-blue-600"
                        title="Modifier le contenu (tournois, inscrits, compte-rendus)"
                      >
                        <ListChecks className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => startEditArchive(idx)} className="btn-primary !px-2 !py-1 !text-xs" title="Modifier les années">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteArchive(idx)} className="btn-danger !px-2 !py-1 !text-xs" title="Supprimer l'archive entière">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            <RotateCcw className="w-3 h-3 inline mr-1" />= restaurer les tournois dans la saison active
          </p>
        </div>
      )}

      {/* Accès admin via espace membre — visible uniquement par le super-admin */}
      {isSuperAdmin && <div className="mt-6 pt-5 border-t border-slate-200">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Accès admin via espace membre
        </p>
        <p className="text-xs text-slate-400 mb-3">
          Ces emails peuvent accéder au panneau admin en se connectant avec leur code membre.
        </p>
        <div className="space-y-1.5 mb-3">
          {(db.adminEmails ?? []).length === 0 && (
            <p className="text-xs text-slate-300 italic">Aucun email admin configuré.</p>
          )}
          {(db.adminEmails ?? []).map((entry) => {
            const perms = entry.permissions ?? [];
            const isExpanded = expandedAdminEmail === entry.email;
            const permLabel = entry.readOnly
              ? "Lecture seule"
              : perms.length === 0
                ? "Accès complet"
                : `${perms.length}/${ADMIN_SECTIONS.length} sections`;
            return (
              <div key={entry.email} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-slate-700 truncate flex-1 min-w-0">{entry.email}</span>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${entry.readOnly ? "bg-amber-100 text-amber-600" : perms.length === 0 ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                      {permLabel}
                    </span>
                    <button
                      onClick={() => setExpandedAdminEmail(isExpanded ? null : entry.email)}
                      className="p-1 rounded text-slate-500 hover:bg-slate-200 transition"
                      title="Gérer les permissions"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        const conf = prompt(`Tapez CONFIRMER pour retirer ${entry.email} des admins :`);
                        if (conf?.trim().toUpperCase() !== "CONFIRMER") { alert("Action annulée."); return; }
                        const newEmails = (db.adminEmails ?? []).filter((x) => x.email !== entry.email);
                        await onPersist({ ...db, adminEmails: newEmails });
                      }}
                      className="text-red-400 hover:text-red-600 transition"
                      title="Retirer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-white px-3 py-3 space-y-2">
                    {/* Rôles prédéfinis */}
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Role</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                      {ADMIN_ROLES.map((role) => {
                        const isActive = !entry.readOnly && role.permissions.every((p) => perms.includes(p));
                        return (
                          <button
                            key={role.key}
                            onClick={async () => {
                              let newPerms: string[];
                              if (isActive) {
                                // Retirer les permissions de ce rôle
                                newPerms = perms.filter((p) => !role.permissions.includes(p));
                              } else {
                                // Ajouter les permissions de ce rôle (sans doublons)
                                newPerms = [...new Set([...perms, ...role.permissions])];
                              }
                              const newEmails = (db.adminEmails ?? []).map((x) =>
                                x.email === entry.email ? { ...x, readOnly: false, permissions: newPerms } : x
                              );
                              await onPersist({ ...db, adminEmails: newEmails });
                            }}
                            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border-2 transition text-center text-xs ${
                              isActive ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-slate-200 bg-white hover:border-slate-400 text-slate-600"
                            }`}
                          >
                            <span className="text-base">{role.emoji}</span>
                            <span className="font-semibold">{role.label}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{role.permissions.length} sections</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-3">Sections autorisees</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ADMIN_SECTIONS.map((s) => {
                        const checked = !entry.readOnly && perms.includes(s.key);
                        return (
                          <label key={s.key} title={s.hint} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 transition">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={async (e) => {
                                const newPerms = e.target.checked
                                  ? [...perms, s.key]
                                  : perms.filter((p) => p !== s.key);
                                const newEmails = (db.adminEmails ?? []).map((x) =>
                                  x.email === entry.email ? { ...x, readOnly: false, permissions: newPerms } : x
                                );
                                await onPersist({ ...db, adminEmails: newEmails });
                              }}
                              className="w-3.5 h-3.5 accent-blue-500 shrink-0"
                            />
                            <span>{s.emoji} {s.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          const newEmails = (db.adminEmails ?? []).map((x) =>
                            x.email === entry.email ? { ...x, readOnly: false, permissions: ADMIN_SECTIONS.map((s) => s.key) } : x
                          );
                          await onPersist({ ...db, adminEmails: newEmails });
                        }}
                        className="btn-ghost !px-3 !py-1 !text-xs"
                      >
                        Tout cocher
                      </button>
                      <button
                        onClick={async () => {
                          const newEmails = (db.adminEmails ?? []).map((x) =>
                            x.email === entry.email ? { ...x, readOnly: false, permissions: [] } : x
                          );
                          await onPersist({ ...db, adminEmails: newEmails });
                        }}
                        className="btn-ghost !px-3 !py-1 !text-xs"
                      >
                        Tout decocher
                      </button>
                      <button
                        onClick={async () => {
                          const newEmails = (db.adminEmails ?? []).map((x) =>
                            x.email === entry.email ? { ...x, readOnly: true, permissions: [] } : x
                          );
                          await onPersist({ ...db, adminEmails: newEmails });
                        }}
                        className="btn-ghost !px-3 !py-1 !text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                      >
                        <Lock className="w-3 h-3 mr-1" /> Lecture seule
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">Choisis un role pour pre-remplir, puis ajuste les sections si besoin.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            className="input !text-sm flex-1"
            type="email"
            placeholder="email@exemple.fr"
            value={adminEmailInput}
            onChange={(e) => setAdminEmailInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const em = adminEmailInput.trim().toLowerCase();
                if (!em) return;
                const current = db.adminEmails ?? [];
                if (current.some((x) => x.email === em)) { alert("Cet email est déjà admin."); return; }
                const conf = prompt(`Tapez CONFIRMER pour donner l'accès admin à ${em} :`);
                if (conf?.trim().toUpperCase() !== "CONFIRMER") { alert("Action annulée."); return; }
                await onPersist({ ...db, adminEmails: [...current, { email: em, readOnly: false }] });
                setAdminEmailInput("");
              }
            }}
          />
          <button
            onClick={async () => {
              const em = adminEmailInput.trim().toLowerCase();
              if (!em) return;
              const current = db.adminEmails ?? [];
              if (current.some((x) => x.email === em)) { alert("Cet email est déjà admin."); return; }
              const conf = prompt(`Tapez CONFIRMER pour donner l'accès admin à ${em} :`);
              if (conf?.trim().toUpperCase() !== "CONFIRMER") { alert("Action annulée."); return; }
              await onPersist({ ...db, adminEmails: [...current, { email: em, readOnly: false }] });
              setAdminEmailInput("");
            }}
            className="btn-primary !px-3"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Cliquez sur ⚙️ pour configurer les permissions de chaque admin.
        </p>
      </div>}

      {/* Codes admin indépendants (sans être adhérent) */}
      {isSuperAdmin && <div className="mt-6 pt-5 border-t border-slate-200">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          <KeyRound className="w-3 h-3" /> Codes admin (accès sans être adhérent)
        </p>
        <p className="text-xs text-slate-400 mb-3">
          Ces emails+codes donnent accès à l'admin via l'espace membre, même sans être inscrit.
        </p>
        <div className="space-y-1.5 mb-3">
          {(db.adminCredentials ?? []).length === 0 && (
            <p className="text-xs text-slate-300 italic">Aucun code admin configuré.</p>
          )}
          {(db.adminCredentials ?? []).map((cred) => {
            const perms = cred.permissions ?? [];
            const isExpanded = expandedAdminCred === cred.email;
            const permLabel = cred.readOnly
              ? "Lecture seule"
              : perms.length === 0
                ? "Accès complet"
                : `${perms.length}/${ADMIN_SECTIONS.length} sections`;
            return (
              <div key={cred.email} className="bg-amber-50 rounded-lg border border-amber-200 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{cred.email}</p>
                    <p className="text-xs text-slate-400">Code : {cred.code}</p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${cred.readOnly ? "bg-amber-100 text-amber-600" : perms.length === 0 ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                      {permLabel}
                    </span>
                    <button
                      onClick={() => setExpandedAdminCred(isExpanded ? null : cred.email)}
                      className="p-1 rounded text-slate-500 hover:bg-amber-100 transition"
                      title="Gérer les permissions"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        const conf = prompt(`Tapez CONFIRMER pour supprimer le code admin de ${cred.email} :`);
                        if (conf?.trim().toUpperCase() !== "CONFIRMER") { alert("Action annulée."); return; }
                        const newCreds = (db.adminCredentials ?? []).filter((c) => c.email !== cred.email);
                        await onPersist({ ...db, adminCredentials: newCreds });
                      }}
                      className="text-red-400 hover:text-red-600 transition"
                      title="Supprimer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-amber-200 bg-white px-3 py-3 space-y-2">
                    {/* Rôles prédéfinis */}
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Role</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                      {ADMIN_ROLES.map((role) => {
                        const isActive = !cred.readOnly && role.permissions.every((p) => perms.includes(p));
                        return (
                          <button
                            key={role.key}
                            onClick={async () => {
                              let newPerms: string[];
                              if (isActive) {
                                newPerms = perms.filter((p) => !role.permissions.includes(p));
                              } else {
                                newPerms = [...new Set([...perms, ...role.permissions])];
                              }
                              const newCreds = (db.adminCredentials ?? []).map((c) =>
                                c.email === cred.email ? { ...c, readOnly: false, permissions: newPerms } : c
                              );
                              await onPersist({ ...db, adminCredentials: newCreds });
                            }}
                            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border-2 transition text-center text-xs ${
                              isActive ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-slate-200 bg-white hover:border-slate-400 text-slate-600"
                            }`}
                          >
                            <span className="text-base">{role.emoji}</span>
                            <span className="font-semibold">{role.label}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{role.permissions.length} sections</span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-3">Sections autorisees</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ADMIN_SECTIONS.map((s) => {
                        const checked = !cred.readOnly && perms.includes(s.key);
                        return (
                          <label key={s.key} title={s.hint} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 transition">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={async (e) => {
                                const newPerms = e.target.checked
                                  ? [...perms, s.key]
                                  : perms.filter((p) => p !== s.key);
                                const newCreds = (db.adminCredentials ?? []).map((c) =>
                                  c.email === cred.email ? { ...c, readOnly: false, permissions: newPerms } : c
                                );
                                await onPersist({ ...db, adminCredentials: newCreds });
                              }}
                              className="w-3.5 h-3.5 accent-blue-500 shrink-0"
                            />
                            <span>{s.emoji} {s.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          const newCreds = (db.adminCredentials ?? []).map((c) =>
                            c.email === cred.email ? { ...c, readOnly: false, permissions: ADMIN_SECTIONS.map((s) => s.key) } : c
                          );
                          await onPersist({ ...db, adminCredentials: newCreds });
                        }}
                        className="btn-ghost !px-3 !py-1 !text-xs"
                      >
                        Tout cocher
                      </button>
                      <button
                        onClick={async () => {
                          const newCreds = (db.adminCredentials ?? []).map((c) =>
                            c.email === cred.email ? { ...c, readOnly: false, permissions: [] } : c
                          );
                          await onPersist({ ...db, adminCredentials: newCreds });
                        }}
                        className="btn-ghost !px-3 !py-1 !text-xs"
                      >
                        Tout decocher
                      </button>
                      <button
                        onClick={async () => {
                          const newCreds = (db.adminCredentials ?? []).map((c) =>
                            c.email === cred.email ? { ...c, readOnly: true, permissions: [] } : c
                          );
                          await onPersist({ ...db, adminCredentials: newCreds });
                        }}
                        className="btn-ghost !px-3 !py-1 !text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                      >
                        <Lock className="w-3 h-3 mr-1" /> Lecture seule
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">Choisis un role pour pre-remplir, puis ajuste les sections si besoin.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            className="input !text-sm flex-1"
            type="email"
            placeholder="email@exemple.fr"
            value={credEmail}
            onChange={(e) => setCredEmail(e.target.value)}
          />
          <input
            className="input !text-sm w-24"
            type="text"
            placeholder="Code"
            value={credCode}
            onChange={(e) => setCredCode(e.target.value)}
            maxLength={20}
          />
          <button
            onClick={async () => {
              const email = credEmail.trim().toLowerCase();
              const code = credCode.trim();
              if (!email || !code) { alert("Email et code requis."); return; }
              const current = db.adminCredentials ?? [];
              const newCreds = current.filter((c) => c.email !== email);
              await onPersist({ ...db, adminCredentials: [...newCreds, { email, code, readOnly: credReadOnly }] });
              setCredEmail(""); setCredCode(""); setCredReadOnly(false);
            }}
            className="btn-primary !px-3"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={credReadOnly}
            onChange={(e) => setCredReadOnly(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Lecture seule (voit l'admin mais ne peut pas modifier)
        </label>
      </div>}

      {/* Emails recevant les messages du formulaire de contact — visible uniquement par les super-admins */}
      {isSuperAdmin && <div className="mt-6 pt-5 border-t border-slate-200">
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          <Mail className="w-3 h-3" /> Emails de contact
        </p>
        <p className="text-xs text-slate-400 mb-3">
          Ces emails reçoivent les messages envoyés via le formulaire de contact du site.
        </p>
        <div className="space-y-1.5 mb-3">
          {(db.contactEmails ?? []).length === 0 && (
            <p className="text-xs text-slate-300 italic">Aucun email configuré (emails par défaut utilisés).</p>
          )}
          {(db.contactEmails ?? []).map((email) => (
            <div key={email} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <span className="text-sm text-slate-700">{email}</span>
              <button
                onClick={async () => {
                  const newEmails = (db.contactEmails ?? []).filter((e) => e !== email);
                  await onPersist({ ...db, contactEmails: newEmails });
                }}
                className="text-red-400 hover:text-red-600 transition"
                title="Retirer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input !text-sm flex-1"
            type="email"
            placeholder="email@exemple.fr"
            value={contactEmailInput}
            onChange={(e) => setContactEmailInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const email = contactEmailInput.trim().toLowerCase();
                if (!email) return;
                const current = db.contactEmails ?? [];
                if (current.includes(email)) return;
                await onPersist({ ...db, contactEmails: [...current, email] });
                setContactEmailInput("");
              }
            }}
          />
          <button
            onClick={async () => {
              const email = contactEmailInput.trim().toLowerCase();
              if (!email) return;
              const current = db.contactEmails ?? [];
              if (current.includes(email)) return;
              await onPersist({ ...db, contactEmails: [...current, email] });
              setContactEmailInput("");
            }}
            className="btn-primary !px-3"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>}

      {/* Modal d'édition complète d'une archive */}
      {archiveContentIdx !== null && (
        <ArchiveEditModal
          db={db}
          archiveIdx={archiveContentIdx}
          onPersist={onPersist}
          onClose={() => setArchiveContentIdx(null)}
        />
      )}
    </div>
  );
}

// 👁️ Composant : toggles de visibilité de chaque section publique
function SectionVisibilityToggles({
  db,
  onPersist,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  readOnly?: boolean;
}) {
  const sections: { key: keyof NonNullable<DB["sectionsVisible"]>; label: string; emoji: string; description?: string }[] = [
    { key: "presentation", label: "Présentation", emoji: "🏸", description: "« Qui sommes-nous »" },
    { key: "actualites", label: "Actualités", emoji: "📰", description: "Carrousel d'actus" },
    { key: "tournois", label: "Tournois", emoji: "🏆", description: "À venir + passés" },
    { key: "horaires", label: "Horaires", emoji: "🕐", description: "Créneaux & tarifs" },
    { key: "palmares", label: "Palmarès", emoji: "🥇", description: "Résultats tournois extérieurs" },
    { key: "rules", label: "Règlement", emoji: "📜", description: "Texte + PDF" },
    { key: "inscription", label: "Inscription", emoji: "📝", description: "Formulaire public d'inscription" },
  ];
  const visibility = db.sectionsVisible ?? {};

  async function toggle(key: keyof NonNullable<DB["sectionsVisible"]>) {
    if (readOnly) return;
    const current = visibility[key] !== false; // par défaut visible
    const next = { ...visibility, [key]: !current };
    await onPersist({ ...db, sectionsVisible: next });
  }

  const hiddenCount = sections.filter((s) => visibility[s.key] === false).length;

  return (
    <div className="mb-4 mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
      <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2 flex items-center gap-1">
        👁️ Visibilité des sections du site public
        {hiddenCount > 0 && (
          <span className="ml-1 normal-case font-bold text-amber-600">
            ({hiddenCount} masquée{hiddenCount > 1 ? "s" : ""})
          </span>
        )}
      </p>
      <p className="text-xs text-slate-400 mb-3">
        Désactive une section pour la cacher complètement du site public (utile pour retirer
        temporairement les actus, les tournois passés, etc.). Les adhérents connectés sont aussi
        impactés.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sections.map((s) => {
          const visible = visibility[s.key] !== false;
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              disabled={readOnly}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition ${
                visible
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  : "bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0 text-left">
                <span>{s.emoji}</span>
                <span className="min-w-0">
                  <span className="block truncate">{s.label}</span>
                  {s.description && <span className="block text-[10px] opacity-70 truncate">{s.description}</span>}
                </span>
              </span>
              <span className={`relative inline-block w-9 h-5 rounded-full transition-colors shrink-0 ${visible ? "bg-emerald-500" : "bg-slate-400"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${visible ? "translate-x-4" : ""}`} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ⚙️ Configuration du club (prix, horaires, salle, etc.)
function ClubConfigSection({
  db,
  onPersist,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  readOnly?: boolean;
}) {
  const config = db.clubConfig ?? {};
  const [prixAdulte, setPrixAdulte] = useState(config.prixAdulte ?? 50);
  const [prixEtudiant, setPrixEtudiant] = useState(config.prixEtudiant ?? 30);
  const [salleName, setSalleName] = useState(config.salleName ?? "Salle Paul Vatine");
  const [salleAdresse, setSalleAdresse] = useState(config.salleAdresse ?? "30bis Rue Georges Boissaye du Bocage, 76310 Sainte-Adresse");
  const [foundedYear, setFoundedYear] = useState(config.foundedYear ?? 2022);
  const [horaires, setHoraires] = useState<ScheduleSlot[]>(
    config.horaires && config.horaires.length > 0 ? config.horaires : DEFAULT_HORAIRES
  );
  const [helloassoPage, setHelloassoPage] = useState(config.helloassoUrls?.page ?? "");
  const [helloassoMixte, setHelloassoMixte] = useState(config.helloassoUrls?.mixte ?? "");
  const [helloassoAdulte, setHelloassoAdulte] = useState(config.helloassoUrls?.adulte ?? "");
  const [helloassoEtudiant, setHelloassoEtudiant] = useState(config.helloassoUrls?.etudiant ?? "");
  const [expanded, setExpanded] = useState(false);

  function updateSlot(idx: number, field: "jour" | "heure", value: string) {
    setHoraires((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function addSlot() {
    setHoraires((prev) => [...prev, { jour: "", heure: "" }]);
  }

  function removeSlot(idx: number) {
    setHoraires((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    const newConfig: ClubConfig = {
      prixAdulte,
      prixEtudiant,
      salleName: salleName.trim() || undefined,
      salleAdresse: salleAdresse.trim() || undefined,
      foundedYear,
      horaires: horaires.filter((s) => s.jour.trim() && s.heure.trim()),
      helloassoUrls:
        helloassoPage.trim() || helloassoMixte.trim() || helloassoAdulte.trim() || helloassoEtudiant.trim()
          ? {
              page: helloassoPage.trim() || undefined,
              mixte: helloassoMixte.trim() || undefined,
              adulte: helloassoAdulte.trim() || undefined,
              etudiant: helloassoEtudiant.trim() || undefined,
            }
          : undefined,
    };
    await onPersist({ ...db, clubConfig: newConfig });
    alert("Configuration du club mise a jour !");
  }

  return (
    <div className="mb-4 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <p className="text-xs uppercase tracking-widest text-blue-700 font-semibold flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Configuration du club
        </p>
        <ChevronDown className={`w-4 h-4 text-blue-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {/* Prix */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">Tarifs</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Adulte</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="input flex-1"
                    value={prixAdulte}
                    min={0}
                    onChange={(e) => setPrixAdulte(Number(e.target.value))}
                    disabled={readOnly}
                  />
                  <span className="text-slate-400 text-sm">&euro;</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Etudiant</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="input flex-1"
                    value={prixEtudiant}
                    min={0}
                    onChange={(e) => setPrixEtudiant(Number(e.target.value))}
                    disabled={readOnly}
                  />
                  <span className="text-slate-400 text-sm">&euro;</span>
                </div>
              </div>
            </div>
          </div>

          {/* Horaires */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">
              Horaires d&apos;entrainement ({horaires.length} {horaires.length > 1 ? "créneaux" : "créneau"})
            </p>
            <div className="space-y-2">
              {horaires.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Jour (ex: Lundi)"
                    value={slot.jour}
                    onChange={(e) => updateSlot(idx, "jour", e.target.value)}
                    disabled={readOnly}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Horaire (ex: 18h30 → 22h)"
                    value={slot.heure}
                    onChange={(e) => updateSlot(idx, "heure", e.target.value)}
                    disabled={readOnly}
                  />
                  {!readOnly && horaires.length > 1 && (
                    <button
                      onClick={() => removeSlot(idx)}
                      className="text-red-400 hover:text-red-600 transition shrink-0"
                      title="Supprimer ce créneau"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <button
                onClick={addSlot}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3" /> Ajouter un créneau
              </button>
            )}
            <p className="text-xs text-slate-400 mt-1">Le nombre de créneaux s&apos;affiche automatiquement sur le site.</p>
          </div>

          {/* Salle */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">Lieu d&apos;entrainement</p>
            <input
              type="text"
              className="input w-full mb-2"
              placeholder="Nom de la salle"
              value={salleName}
              onChange={(e) => setSalleName(e.target.value)}
              disabled={readOnly}
            />
            <input
              type="text"
              className="input w-full"
              placeholder="Adresse complète"
              value={salleAdresse}
              onChange={(e) => setSalleAdresse(e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* Année de fondation */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">Année de fondation</p>
            <input
              type="number"
              className="input w-32"
              value={foundedYear}
              min={2000}
              max={2099}
              onChange={(e) => setFoundedYear(Number(e.target.value))}
              disabled={readOnly}
            />
            <p className="text-xs text-slate-400 mt-1">Sert a calculer le nombre d&apos;années d&apos;existence affiche sur le site.</p>
          </div>

          {/* Liens HelloAsso */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-2">Liens HelloAsso (optionnel)</p>
            <p className="text-xs text-slate-400 mb-2">
              Laissez vide pour utiliser les liens par défaut. Modifiez si vous créez de nouveaux événements HelloAsso.
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Page principale de l&apos;asso</label>
                <input
                  type="url"
                  className="input w-full !text-xs"
                  placeholder="https://www.helloasso.com/associations/..."
                  value={helloassoPage}
                  onChange={(e) => setHelloassoPage(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Mixte (adulte + étudiant)</label>
                <input
                  type="url"
                  className="input w-full !text-xs"
                  placeholder="https://www.helloasso.com/..."
                  value={helloassoMixte}
                  onChange={(e) => setHelloassoMixte(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Adulte seul</label>
                <input
                  type="url"
                  className="input w-full !text-xs"
                  placeholder="https://www.helloasso.com/..."
                  value={helloassoAdulte}
                  onChange={(e) => setHelloassoAdulte(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Étudiant seul</label>
                <input
                  type="url"
                  className="input w-full !text-xs"
                  placeholder="https://www.helloasso.com/..."
                  value={helloassoEtudiant}
                  onChange={(e) => setHelloassoEtudiant(e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          {!readOnly && (
            <button onClick={save} className="btn-accent w-full">
              <Check className="w-4 h-4" /> Enregistrer la configuration
            </button>
          )}
        </div>
      )}
    </div>
  );
}
