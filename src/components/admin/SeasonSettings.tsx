"use client";

import { useState } from "react";
import { CalendarCog, RefreshCw, Lock, Unlock, UserPlus, MessageCircle, Archive, Sparkles, Trash2, Pencil, Check, X, RotateCcw, ShieldCheck, Plus, Mail, KeyRound, Settings } from "lucide-react";
import { DB, QUOTA_DEFAULT, SeasonArchive, ADMIN_SECTIONS } from "@/lib/types";
import { adminNotifyNewSeason } from "@/lib/db";

const SUPER_ADMINS = ["gabin.binay@gmail.com", "hernancm68@hotmail.com"];

export default function SeasonSettings({
  db,
  onPersist,
  onRefresh,
  adminEmail,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  onRefresh: () => Promise<void>;
  adminEmail?: string;
  readOnly?: boolean;
}) {
  const isSuperAdmin = SUPER_ADMINS.includes(adminEmail?.toLowerCase() ?? "");
  const [y1, setY1] = useState(db.y1);
  const [y2, setY2] = useState(db.y2);
  const currentQuota = db.quota ?? QUOTA_DEFAULT;
  const [quota, setQuota] = useState(currentQuota);
  const [whatsappLink, setWhatsappLink] = useState(db.whatsappLink || "");
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
      insc_open: true,
      insc_close_date: undefined,
    });
    alert(`✅ Nouvelle saison ${newY1}–${newY2} démarrée !`);

    if (confirm(`Envoyer un email à tous les ${db.membres.length} adhérents pour les prévenir que la nouvelle saison est ouverte ?`)) {
      const r = await adminNotifyNewSeason();
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
            <UserPlus className="w-3 h-3" /> Club complet — augmentez le quota pour accepter de nouveaux membres
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

      {!readOnly && (
        <div className="space-y-3">
          <button onClick={toggle} className={db.insc_open ? "btn-danger w-full" : "btn-accent w-full"}>
            {db.insc_open ? <><Lock className="w-4 h-4" /> Fermer les inscriptions</> : <><Unlock className="w-4 h-4" /> Ouvrir les inscriptions</>}
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
                      <button onClick={() => startEditArchive(idx)} className="btn-primary !px-2 !py-1 !text-xs" title="Modifier">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteArchive(idx)} className="btn-danger !px-2 !py-1 !text-xs" title="Supprimer">
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
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Sections autorisées en modification</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ADMIN_SECTIONS.map((s) => {
                        const checked = !entry.readOnly && perms.includes(s.key);
                        return (
                          <label key={s.key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 transition">
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
                        Tout décocher
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
                    <p className="text-xs text-slate-400">Sans sections cochées = accès complet (toutes sections modifiables)</p>
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
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Sections autorisées en modification</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ADMIN_SECTIONS.map((s) => {
                        const checked = !cred.readOnly && perms.includes(s.key);
                        return (
                          <label key={s.key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 transition">
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
                        Tout décocher
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
                    <p className="text-xs text-slate-400">Sans sections cochées = accès complet (toutes sections modifiables)</p>
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
    </div>
  );
}
