"use client";

import { useState } from "react";
import { CalendarCog, RefreshCw, Lock, Unlock, UserPlus, MessageCircle, Archive, Sparkles, Trash2, Pencil, Check, X, RotateCcw, ShieldCheck, Plus } from "lucide-react";
import { DB, QUOTA_DEFAULT, SeasonArchive } from "@/lib/types";
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
  const [adminEmailInput, setAdminEmailInput] = useState("");

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

  async function archiveSeason() {
    if (!confirm(`Archiver la saison ${db.y1}–${db.y2} ?`)) return;
    const archive = {
      y1: db.y1, y2: db.y2,
      membresCount: db.membres.length,
      config_tournois: db.config_tournois,
      inscrits_tournoi: db.inscrits_tournoi,
    };
    const prevArchives = db.archives ?? [];
    const filtered = prevArchives.filter((a) => !(a.y1 === db.y1 && a.y2 === db.y2));
    await onPersist({ ...db, archives: [...filtered, archive] });
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
        <input type="number" className="input" value={y1} onChange={(e) => setY1(Number(e.target.value))} placeholder="Année 1" />
        <input type="number" className="input" value={y2} onChange={(e) => setY2(Number(e.target.value))} placeholder="Année 2" />
      </div>

      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 block">Places disponibles</label>
        <div className="flex items-center gap-3">
          <input type="number" className="input flex-1" value={quota} min={db.membres.length} onChange={(e) => setQuota(Number(e.target.value))} />
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
        <input type="date" className="input w-full" value={inscCloseDate} onChange={(e) => setInscCloseDate(e.target.value)} />
        <p className="text-xs text-slate-400 mt-1">Des rappels automatiques seront envoyés aux abonnés aux news à J-30 et J-15.</p>
      </div>

      <div className="mb-3">
        <label className="text-xs uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
          <MessageCircle className="w-3 h-3" /> Lien groupe WhatsApp
        </label>
        <input type="url" className="input w-full" placeholder="https://chat.whatsapp.com/..." value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} />
        <p className="text-xs text-slate-400 mt-1">Affiché après paiement et dans l&apos;espace membre.</p>
      </div>

      <div className="space-y-3">
        <button onClick={toggle} className={db.insc_open ? "btn-danger w-full" : "btn-accent w-full"}>
          {db.insc_open ? <><Lock className="w-4 h-4" /> Fermer les inscriptions</> : <><Unlock className="w-4 h-4" /> Ouvrir les inscriptions</>}
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

      {/* Accès admin via espace membre */}
      <div className="mt-6 pt-5 border-t border-slate-200">
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
          {(db.adminEmails ?? []).map((email) => (
            <div key={email} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <span className="text-sm text-slate-700">{email}</span>
              <button
                onClick={async () => {
                  const newEmails = (db.adminEmails ?? []).filter((e) => e !== email);
                  await onPersist({ ...db, adminEmails: newEmails });
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
            value={adminEmailInput}
            onChange={(e) => setAdminEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const email = adminEmailInput.trim().toLowerCase();
                if (!email) return;
                const current = db.adminEmails ?? [];
                if (current.includes(email)) return;
                onPersist({ ...db, adminEmails: [...current, email] });
                setAdminEmailInput("");
              }
            }}
          />
          <button
            onClick={async () => {
              const email = adminEmailInput.trim().toLowerCase();
              if (!email) return;
              const current = db.adminEmails ?? [];
              if (current.includes(email)) return;
              await onPersist({ ...db, adminEmails: [...current, email] });
              setAdminEmailInput("");
            }}
            className="btn-primary !px-3"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
