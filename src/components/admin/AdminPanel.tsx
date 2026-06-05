"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, FileSpreadsheet, FileText, QrCode, Download, ExternalLink, Eye, RefreshCw, DatabaseBackup, Upload, Users, Inbox, Mail, Trophy, Receipt, Newspaper, MessageSquare, BookOpen, CalendarCog, ChevronUp, Send, HelpCircle } from "lucide-react";
import { DB, Membre, getEffectivePrix } from "@/lib/types";
import { adminExportBackup, adminImportBackup, adminSendBackupEmail, togglePresentationMode } from "@/lib/db";
import { getMemberSession } from "@/lib/useMemberSession";
import Accounting from "./Accounting";
import SeasonSettings from "./SeasonSettings";
import StatsAdhesions from "./StatsAdhesions";
import StatsVisites from "./StatsVisites";
import LockedAccounts from "./LockedAccounts";
import GlobalSearch from "./GlobalSearch";
import TournoisAdmin from "./TournoisAdmin";
import InscriptionsAdmin from "./InscriptionsAdmin";
import MembresAdmin from "./MembresAdmin";
import ActualitesAdmin from "./ActualitesAdmin";
import EngagementAdmin from "./EngagementAdmin";
import TshirtAdmin from "./TshirtAdmin";
import GuideAdmin from "./GuideAdmin";
import FaqAdmin from "./FaqAdmin";
import RulesAdmin from "./RulesAdmin";
import BureauAdmin from "./BureauAdmin";
import EmailingAdmin from "./EmailingAdmin";
import MessagesAdmin from "./MessagesAdmin";
import RecuModal from "./RecuModal";
import EmargementModal from "./EmargementModal";
import EditMembreModal from "./EditMembreModal";
import EditBinomeModal from "./EditBinomeModal";
import AdminNotes from "./AdminNotes";

export default function AdminPanel({
  db,
  onClose,
  onPersist,
  onRefresh,
  adminEmail,
  adminCode,
  readOnly,
  permissions,
}: {
  db: DB;
  onClose: () => void;
  onPersist: (db: DB) => Promise<void>;
  onRefresh: () => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
  permissions?: string[];
}) {
  const [recuMembre, setRecuMembre] = useState<Membre | null>(null);
  const [emargementOpen, setEmargementOpen] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);
  const [editBin, setEditBin] = useState<{ id: string; joueurs: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  // Auto-refresh toutes les 60 secondes pour éviter les caches périmés
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh().then(() => setLastRefresh(Date.now())).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [onRefresh]);

  async function manualRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(Date.now());
    } finally {
      setRefreshing(false);
    }
  }

  // Wrapper qui sauvegarde puis rafraîchit la DB (évite les caches périmés)
  const safePersist = readOnly
    ? async (_db: DB) => { alert("Accès en lecture seule — vous ne pouvez pas modifier les données."); }
    : async (next: DB) => {
        await onPersist(next);
        // Refresh silencieux après chaque sauvegarde pour avoir l'état serveur à jour
        onRefresh().then(() => setLastRefresh(Date.now())).catch(() => {});
      };

  function canEdit(section: string): boolean {
    if (readOnly) return false;
    // permissions undefined = legacy / super-admin sans config = accès complet
    if (permissions === undefined) return true;
    // permissions [] (explicitement vide) = aucun accès
    return permissions.includes(section);
  }

  // 👁️ Visibilité d'une section : si permissions explicitement vide [], rien n'est visible.
  // Si undefined (jamais configuré), tout est visible (legacy super-admin).
  function canSee(section: string): boolean {
    if (permissions === undefined) return true;
    return permissions.includes(section);
  }

  const totals = useMemo(() => {
    let totalRecolte = 0,
      reste = 0,
      aPayes = 0,
      aTotal = 0,
      ePayes = 0,
      eTotal = 0;
    db.membres.forEach((m) => {
      const effectivePrix = getEffectivePrix(db);
      const prix = m.type === "Etudiant" ? effectivePrix.Etudiant : effectivePrix.Adulte;
      if (m.type === "Adulte") aTotal++;
      else eTotal++;
      if (m.ok) {
        totalRecolte += prix;
        if (m.type === "Adulte") aPayes++;
        else ePayes++;
      } else {
        reste += prix;
      }
    });
    const totalDepenses = (db.factures || []).reduce((s, f) => s + f.montant, 0);
    return {
      totalRecolte,
      reste,
      aPayes,
      aTotal,
      ePayes,
      eTotal,
      totalDepenses,
      solde: totalRecolte + (db.reportPrecedent || 0) - totalDepenses,
    };
  }, [db]);

  function exportCSV() {
    const rows: string[][] = [["Nom", "Email", "Telephone", "Type", "Paiement"]];
    db.membres.forEach((m) =>
      rows.push([m.nom, m.email, m.tel || "", m.type, m.ok ? "Paye" : "En attente"])
    );
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `adherents_saccb_${db.y1}_${db.y2}.csv`;
    link.click();
  }

  // \ud83d\udcbe Telecharge un fichier JSON complet (DB entiere) - sauvegarde manuelle
  const [backupBusy, setBackupBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  async function downloadJSONBackup() {
    if (!adminEmail || !adminCode) {
      alert("Identifiants admin manquants.");
      return;
    }
    setBackupBusy(true);
    try {
      const r = await adminExportBackup(adminEmail, adminCode);
      if (!r.ok || !r.data) {
        alert(`\u00c9chec : ${r.reason || "erreur inconnue"}`);
        return;
      }
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      link.download = `saccb_backup_${ts}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setBackupBusy(false);
    }
  }

  // \u23ee\ufe0f Restaure depuis un fichier JSON (DOUBLE confirmation - tres destructif)
  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset le input pour pouvoir re-uploader le meme fichier plus tard
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!adminEmail || !adminCode) {
      alert("Identifiants admin manquants.");
      return;
    }

    // Lecture du fichier
    let parsed: Record<string, unknown>;
    try {
      const txt = await file.text();
      parsed = JSON.parse(txt);
    } catch {
      alert("\u274c Ce fichier n'est pas un JSON valide.");
      return;
    }

    const nbMembres = Array.isArray(parsed.membres) ? (parsed.membres as unknown[]).length : 0;
    const nbTournois = Array.isArray(parsed.config_tournois) ? (parsed.config_tournois as unknown[]).length : 0;
    const nbActu = Array.isArray(parsed.actualites) ? (parsed.actualites as unknown[]).length : 0;

    // 1ere confirmation : ce qui va etre restaure
    const ok1 = confirm(
      `\u26a0\ufe0f RESTAURATION COMPL\u00c8TE DE LA BASE ?\n\n` +
      `Fichier : ${file.name}\n` +
      `Contenu :\n` +
      `  \u2022 ${nbMembres} adh\u00e9rents\n` +
      `  \u2022 ${nbTournois} tournois\n` +
      `  \u2022 ${nbActu} actualit\u00e9s\n\n` +
      `\u26a0\ufe0f TOUTES LES DONN\u00c9ES ACTUELLES SERONT \u00c9CRAS\u00c9ES.\n` +
      `Cette action est IRR\u00c9VERSIBLE (sauf si tu as une autre sauvegarde).`
    );
    if (!ok1) return;

    // 2eme confirmation : taper RESTAURER
    const typed = prompt(
      `Pour confirmer d\u00e9finitivement, tape RESTAURER ci-dessous (en majuscules) :`
    );
    if (typed === null) return;
    if (typed.trim() !== "RESTAURER") {
      alert("Confirmation incorrecte. Restauration annul\u00e9e.");
      return;
    }

    setBackupBusy(true);
    try {
      const r = await adminImportBackup(parsed, adminEmail, adminCode);
      if (!r.ok) {
        alert(`\u274c \u00c9chec : ${r.reason || "erreur inconnue"}`);
        return;
      }
      alert(
        `\u2705 Restauration r\u00e9ussie !\n\n` +
        `Adh\u00e9rents : ${r.stats?.membres ?? 0}\n` +
        `Tournois : ${r.stats?.tournois ?? 0}\n` +
        `Actualit\u00e9s : ${r.stats?.actualites ?? 0}\n\n` +
        `La page va se recharger pour afficher les nouvelles donn\u00e9es.`
      );
      await onRefresh();
      window.location.reload();
    } finally {
      setBackupBusy(false);
    }
  }

  // 🔝 Back-to-top : visible quand on a scrollé > 400 px
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    function onScroll() {
      const c = scrollContainerRef.current;
      if (c) setShowBackToTop(c.scrollTop > 400);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  function scrollToTop() {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div ref={scrollContainerRef} className="fixed inset-0 z-[2000] bg-[#f8fafc] overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-10">
        <div className="flex items-center justify-between mb-6 sticky top-0 z-10 -mx-4 md:-mx-6 lg:-mx-10 px-4 md:px-6 lg:px-10 py-3 bg-[#f8fafc]/95 backdrop-blur-xl border-b border-slate-200">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold">Panel</p>
            <h2 className="font-display text-2xl md:text-4xl tracking-wider text-slate-800">Gestion SACCB</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={manualRefresh}
              disabled={refreshing}
              className="btn-ghost !px-3 !py-2 !text-xs flex items-center gap-1.5"
              title={`Dernière mise à jour : ${new Date(lastRefresh).toLocaleTimeString("fr-FR")}`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{refreshing ? "..." : "Rafraîchir"}</span>
            </button>
            <button onClick={onClose} className="btn-danger !px-3 !py-2">
              <X className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Fermer</span>
            </button>
          </div>
        </div>

        {readOnly && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">Mode lecture seule — les modifications ne sont pas autorisées.</p>
          </div>
        )}

        {/* 🔧 Bandeau mode maintenance */}
        {db.maintenanceMode && (
          <div className="mb-4 bg-red-50 border-2 border-red-400 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-pulse-slow">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔧</span>
              <div>
                <p className="text-sm text-red-700 font-bold uppercase tracking-wide">Site en maintenance</p>
                <p className="text-xs text-red-600">Les visiteurs ne peuvent pas acceder au site. Pensez a desactiver le mode maintenance quand vous avez termine.</p>
              </div>
            </div>
            {!readOnly && (
              <button
                onClick={async () => {
                  if (!confirm("Désactiver le mode maintenance et rendre le site accessible ?")) return;
                  await safePersist({ ...db, maintenanceMode: false });
                }}
                className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
              >
                Desactiver
              </button>
            )}
          </div>
        )}

        {/* 🕐 Indicateur d'expiration de session */}
        <SessionExpiry />


        {/* 🔍 Recherche globale (Ctrl+K) */}
        <div className="flex justify-end mb-2">
          <GlobalSearch db={db} />
        </div>

        {/* 🚀 Accès rapide aux sections (smooth scroll) — filtré selon permissions */}
        <QuickNav
          unreadMessages={(db.contactMessages ?? []).filter((m) => !m.archived && !m.respondedBy).length}
          canSee={canSee}
        />

        {/* Avertissement si aucune section visible (permissions explicitement vides) */}
        {permissions !== undefined && permissions.length === 0 && (
          <div className="glass p-6 text-center my-4">
            <p className="text-slate-700 font-semibold mb-2">🔒 Aucun accès configuré</p>
            <p className="text-sm text-slate-500">
              Votre compte admin n&apos;a accès à aucune section. Contactez le bureau de l’association pour
              obtenir des permissions.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          {canSee("comptabilite") && (
            <div id="admin-comptabilite" className="lg:col-span-2 scroll-mt-24">
              <Accounting db={db} totals={totals} onPersist={safePersist} readOnly={!canEdit("comptabilite")} />
            </div>
          )}

          {canSee("saison") && (
            <div id="admin-saison" className="scroll-mt-24">
              <SeasonSettings db={db} onPersist={safePersist} onRefresh={onRefresh} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("saison")} />
            </div>
          )}
          {canSee("saison") && <StatsAdhesions totals={totals} />}
          {canSee("saison") && (
            <div className="lg:col-span-2 scroll-mt-24" id="admin-analytics">
              <StatsVisites analyticsDaily={db.analyticsDaily} />
            </div>
          )}
          {canSee("saison") && adminEmail && adminCode && (
            <div className="lg:col-span-2">
              <LockedAccounts adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("saison")} />
            </div>
          )}

          <div id="admin-sauvegarde" className="lg:col-span-2 glass p-4 md:p-6 scroll-mt-24">
            <h3 className="font-display text-lg md:text-xl tracking-wider text-slate-800 mb-3">💾 Sauvegarde &amp; export</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button onClick={exportCSV} className="btn-primary !bg-gradient-to-r !from-purple-500 !to-fuchsia-500 !text-xs md:!text-sm">
                <FileSpreadsheet className="w-4 h-4" /> Exporter CSV
              </button>
              <button onClick={() => setEmargementOpen(true)} className="btn-primary !bg-gradient-to-r !from-amber-500 !to-orange-500 !text-xs md:!text-sm">
                <FileText className="w-4 h-4" /> Émargement
              </button>
              <button
                onClick={downloadJSONBackup}
                disabled={backupBusy}
                className="btn-primary !bg-gradient-to-r !from-sky-500 !to-blue-600 !text-xs md:!text-sm"
                title="Télécharge un fichier JSON contenant toute la base (adhérents, tournois, actus, sondages, etc.)"
              >
                <DatabaseBackup className="w-4 h-4" /> {backupBusy ? "..." : "Sauvegarde JSON"}
              </button>
              {!readOnly && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={backupBusy}
                    className="btn-primary !bg-gradient-to-r !from-rose-600 !to-red-700 !text-xs md:!text-sm"
                    title="Restaure la base à partir d'un fichier JSON de sauvegarde (DESTRUCTIF)"
                  >
                    <Upload className="w-4 h-4" /> Restaurer…
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreFile}
                    className="hidden"
                  />
                </>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Sauvegarde JSON telecharge tout (utile avant un changement risque).
              <span className="text-red-500"> <strong>Restaurer</strong> ecrase la base avec un fichier JSON (irreversible, double confirmation requise).</span>
            </p>
            {/* Backup par email */}
            <BackupEmailSection db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={readOnly} />
            <PresentationModeButton isActive={db.presentationMode === true} onRefresh={onRefresh} hidden={db.presentationModeRemoved === true} />
            {/* 🔧 Mode maintenance */}
            {!readOnly && (
              <div className={`mt-3 p-3 rounded-xl border ${db.maintenanceMode ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">🔧</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700">Mode maintenance</p>
                      <p className="text-xs text-slate-500">Bloque l&apos;acces au site pour les visiteurs</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const newVal = !db.maintenanceMode;
                      const msg = newVal
                        ? "Activer le mode maintenance ?\n\nLe site sera inaccessible pour tous les visiteurs."
                        : "Désactiver le mode maintenance ?\n\nLe site redeviendra accessible.";
                      if (!confirm(msg)) return;
                      await safePersist({ ...db, maintenanceMode: newVal });
                    }}
                    className={`shrink-0 relative inline-block w-12 h-6 rounded-full transition-colors ${db.maintenanceMode ? "bg-red-500" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${db.maintenanceMode ? "translate-x-6" : ""}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <HelloAssoQR helloassoPageUrl={db.clubConfig?.helloassoUrls?.page} />

          {/* Bloc-notes partagé */}
          <AdminNotes db={db} onPersist={safePersist} adminEmail={adminEmail} readOnly={readOnly} />

          {canSee("actualites") && (
            <div id="admin-actualites" className="lg:col-span-2 scroll-mt-24">
              <ActualitesAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("actualites")} />
            </div>
          )}
          {canSee("engagement") && (
            <div id="admin-engagement" className="lg:col-span-2 scroll-mt-24">
              <EngagementAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("engagement")} />
            </div>
          )}
          {canSee("engagement") && (
            <div id="admin-tshirts" className="lg:col-span-2 scroll-mt-24">
              <TshirtAdmin db={db} adminEmail={adminEmail} adminCode={adminCode} onPersist={safePersist} onRefresh={onRefresh} readOnly={!canEdit("engagement")} />
            </div>
          )}
          {/* ❓ FAQ adhérents — gestion partagée avec engagement */}
          {canSee("engagement") && (
            <div id="admin-faq" className="lg:col-span-2 scroll-mt-24">
              <FaqAdmin db={db} onPersist={safePersist} readOnly={!canEdit("engagement")} />
            </div>
          )}
          {/* 📖 Guide admin — accessible à tous les admins, indépendant des permissions */}
          <div id="admin-guide" className="lg:col-span-2 scroll-mt-24">
            <GuideAdmin />
          </div>
          {canSee("rules") && (
            <div id="admin-rules" className="lg:col-span-2 scroll-mt-24">
              <RulesAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("rules")} />
            </div>
          )}
          {canSee("emailing") && (
            <div id="admin-messages" className="lg:col-span-2 scroll-mt-24">
              <MessagesAdmin db={db} onRefresh={onRefresh} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("emailing")} />
            </div>
          )}
          {canSee("emailing") && (
            <div id="admin-emailing" className="lg:col-span-2 scroll-mt-24">
              <EmailingAdmin db={db} adminEmail={adminEmail} adminCode={adminCode} onRefresh={onRefresh} readOnly={!canEdit("emailing")} />
            </div>
          )}
          {canSee("bureau") && (
            <div id="admin-bureau" className="lg:col-span-2 scroll-mt-24">
              <BureauAdmin db={db} onPersist={safePersist} readOnly={!canEdit("bureau")} />
            </div>
          )}
          {canSee("tournois") && (
            <div id="admin-tournois" className="lg:col-span-2 scroll-mt-24">
              <TournoisAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("tournois")} />
            </div>
          )}
          {canSee("inscriptions") && (
            <div id="admin-inscriptions" className="lg:col-span-2 scroll-mt-24">
              <InscriptionsAdmin db={db} onPersist={safePersist} onEditBin={setEditBin} readOnly={!canEdit("inscriptions")} />
            </div>
          )}
          {canSee("membres") && (
            <div id="admin-membres" className="lg:col-span-2 scroll-mt-24">
            <MembresAdmin
              db={db}
              onPersist={safePersist}
              onEdit={setEditMembre}
              onRecu={setRecuMembre}
              adminEmail={adminEmail}
              adminCode={adminCode}
              readOnly={!canEdit("membres")}
            />
            </div>
          )}
        </div>
      </div>

      {recuMembre && <RecuModal membre={recuMembre} db={db} onClose={() => setRecuMembre(null)} />}
      {emargementOpen && <EmargementModal db={db} onClose={() => setEmargementOpen(false)} />}
      {editMembre && (
        <EditMembreModal
          membre={editMembre}
          onClose={() => setEditMembre(null)}
          onSave={async (m) => {
            const next = { ...db, membres: db.membres.map((x) => (x.id === m.id ? m : x)) };
            await safePersist(next);
            setEditMembre(null);
          }}
        />
      )}
      {editBin && (
        <EditBinomeModal
          bin={editBin}
          onClose={() => setEditBin(null)}
          onSave={async (b) => {
            const next = {
              ...db,
              inscrits_tournoi: db.inscrits_tournoi.map((i) =>
                i.id === b.id ? { ...i, joueurs: b.joueurs } : i
              ),
            };
            await safePersist(next);
            setEditBin(null);
          }}
        />
      )}

      {/* 🔝 Bouton flottant "Retour en haut" — apparaît quand scrolled > 400px */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-[2100] w-12 h-12 rounded-full bg-gradient-to-br from-[#1e3a5f] to-emerald-600 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition flex items-center justify-center"
          title="Retour en haut"
          aria-label="Retour en haut"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

// 🚀 Barre de navigation rapide en haut de l'admin (smooth scroll vers les sections)
function QuickNav({
  unreadMessages = 0,
  canSee,
}: {
  unreadMessages?: number;
  canSee: (section: string) => boolean;
}) {
  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // permission = key dans ADMIN_SECTIONS (cf types.ts). undefined = toujours visible.
  const allItems: { id: string; label: string; icon: React.ReactNode; color: string; badge?: number; permission?: string }[] = [
    { id: "admin-membres", label: "Adhérents", icon: <Users className="w-4 h-4" />, color: "from-cyan-500 to-blue-500", permission: "membres" },
    { id: "admin-messages", label: "Messages", icon: <Inbox className="w-4 h-4" />, color: "from-blue-500 to-indigo-500", badge: unreadMessages || undefined, permission: "emailing" },
    { id: "admin-emailing", label: "Envoyer un mail", icon: <Mail className="w-4 h-4" />, color: "from-emerald-500 to-teal-500", permission: "emailing" },
    { id: "admin-tournois", label: "Tournois", icon: <Trophy className="w-4 h-4" />, color: "from-amber-500 to-orange-500", permission: "tournois" },
    { id: "admin-inscriptions", label: "Inscriptions", icon: <Users className="w-4 h-4" />, color: "from-purple-500 to-pink-500", permission: "inscriptions" },
    { id: "admin-comptabilite", label: "Comptabilité", icon: <Receipt className="w-4 h-4" />, color: "from-green-500 to-emerald-500", permission: "comptabilite" },
    { id: "admin-actualites", label: "Actualités", icon: <Newspaper className="w-4 h-4" />, color: "from-rose-500 to-red-500", permission: "actualites" },
    { id: "admin-engagement", label: "Sondages & AG", icon: <MessageSquare className="w-4 h-4" />, color: "from-violet-500 to-purple-500", permission: "engagement" },
    { id: "admin-rules", label: "Règlement", icon: <BookOpen className="w-4 h-4" />, color: "from-slate-500 to-slate-700", permission: "rules" },
    { id: "admin-saison", label: "Saison", icon: <CalendarCog className="w-4 h-4" />, color: "from-indigo-500 to-violet-500", permission: "saison" },
    { id: "admin-sauvegarde", label: "Sauvegarde", icon: <DatabaseBackup className="w-4 h-4" />, color: "from-sky-500 to-blue-600" /* toujours visible */ },
    { id: "admin-faq", label: "FAQ adhérents", icon: <HelpCircle className="w-4 h-4" />, color: "from-blue-500 to-indigo-500", permission: "engagement" },
    { id: "admin-guide", label: "Guide admin", icon: <BookOpen className="w-4 h-4" />, color: "from-indigo-500 to-purple-500" /* toujours visible */ },
  ];
  const items = allItems.filter((it) => !it.permission || canSee(it.permission));
  return (
    <div className="glass p-3 md:p-4 mb-4">
      <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3 px-1">
        🚀 Accès rapide
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => scrollTo(it.id)}
            className={`relative flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-gradient-to-br ${it.color} text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition`}
            title={it.label}
          >
            {it.icon}
            <span className="text-[10px] font-semibold leading-tight text-center line-clamp-2">
              {it.label}
            </span>
            {it.badge !== undefined && it.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow border border-white">
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_HELLOASSO_URL =
  "https://www.helloasso.com/associations/sainte-adresse-club-de-competition-du-badminton-s-a-c-c-b/evenements/tarif-adulte";

function HelloAssoQR({ helloassoPageUrl }: { helloassoPageUrl?: string }) {
  const HELLOASSO_URL = helloassoPageUrl || DEFAULT_HELLOASSO_URL;
  const linkRef = useRef<HTMLAnchorElement>(null);

  function downloadQR() {
    const a = document.createElement("a");
    a.href = "/qr-helloasso.png";
    a.download = "QR-HelloAsso-SACCB.png";
    a.click();
  }

  return (
    <div className="lg:col-span-2 glass p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shrink-0">
          <QrCode className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-lg md:text-2xl tracking-wider text-slate-800">HelloAsso — Paiement</h3>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
        <div className="bg-white rounded-2xl p-3 shadow-lg shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qr-helloasso.png" alt="QR Code HelloAsso" className="w-36 h-36 md:w-48 md:h-48 object-contain" />
        </div>
        <div className="flex-1 space-y-3 w-full">
          <p className="text-slate-500 text-sm">
            Partagez ce QR code aux adhérents pour payer via HelloAsso.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={downloadQR} className="btn-primary !text-xs md:!text-sm">
              <Download className="w-4 h-4" /> Télécharger QR
            </button>
            <a href={HELLOASSO_URL} target="_blank" rel="noopener noreferrer" className="btn-accent inline-flex items-center gap-2 !text-xs md:!text-sm">
              <ExternalLink className="w-4 h-4" /> Ouvrir HelloAsso
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// 💾 Configuration de la sauvegarde automatique par email
function BackupEmailSection({
  db,
  onPersist,
  adminEmail,
  adminCode,
  readOnly,
}: {
  db: DB;
  onPersist: (db: DB) => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
}) {
  const config = db.backupEmailConfig ?? { enabled: false, email: "" };
  const [email, setEmail] = useState(config.email || adminEmail || "");
  const [enabled, setEnabled] = useState(config.enabled);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveConfig() {
    if (readOnly) return;
    if (enabled && (!email || !email.includes("@"))) {
      setMsg("Email invalide.");
      return;
    }
    setSaving(true);
    setMsg(null);
    await onPersist({
      ...db,
      backupEmailConfig: {
        enabled,
        email: email.trim(),
        lastSentAt: config.lastSentAt,
      },
    });
    setSaving(false);
    setMsg("Configuration sauvegardee !");
    setTimeout(() => setMsg(null), 3000);
  }

  async function sendNow() {
    if (!adminEmail || !adminCode) {
      setMsg("Identifiants admin manquants.");
      return;
    }
    setSending(true);
    setMsg(null);
    const r = await adminSendBackupEmail(adminEmail, adminCode);
    setSending(false);
    if (r.ok) {
      setMsg("Sauvegarde envoyee par email !");
    } else {
      setMsg("Erreur : " + (r.reason || "inconnue"));
    }
    setTimeout(() => setMsg(null), 5000);
  }

  return (
    <div className="mt-4 bg-sky-50 border border-sky-200 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <Mail className="w-4 h-4 text-sky-600" />
        Sauvegarde automatique par email (mensuelle)
      </h4>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={readOnly}
              className="w-4 h-4 rounded border-slate-300 text-sky-600"
            />
            <span className="text-sm text-slate-700">Activer l&apos;envoi mensuel</span>
          </label>
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1 !text-sm"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemple.fr"
            disabled={readOnly}
          />
          {!readOnly && (
            <button onClick={saveConfig} disabled={saving} className="btn-primary !px-4 !py-2 !text-xs">
              {saving ? "..." : "Sauver"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={sendNow}
            disabled={sending || !adminEmail || !adminCode}
            className="btn-primary !bg-gradient-to-r !from-sky-500 !to-blue-600 !text-xs inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Envoi en cours..." : "Envoyer une sauvegarde maintenant"}
          </button>
        </div>
        {config.lastSentAt && (
          <p className="text-xs text-slate-400">
            Dernier envoi : {new Date(config.lastSentAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {msg && <p className="text-xs font-semibold text-sky-700">{msg}</p>}
      </div>
    </div>
  );
}

// 🎤 Mode présentation — active toutes les sections pour tout le monde
function PresentationModeButton({ isActive, onRefresh, hidden }: { isActive: boolean; onRefresh: () => void; hidden?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (hidden) return null;

  async function handleToggle() {
    const secret = prompt(isActive ? "Code secret pour DESACTIVER le mode presentation :" : "Code secret pour ACTIVER le mode presentation :");
    if (!secret) return;
    setLoading(true);
    setMsg(null);
    const r = await togglePresentationMode(secret);
    setLoading(false);
    if (r.ok) {
      if (r.presentationMode) {
        setMsg("Mode presentation ACTIVE !");
      } else {
        // Proposer la suppression définitive
        const remove = confirm("Mode presentation desactive.\n\nVoulez-vous supprimer definitivement ce bouton ?\n(Il ne sera plus jamais visible)");
        if (remove) {
          const r2 = await togglePresentationMode(secret + ":remove");
          if (r2.ok) {
            setMsg("Bouton supprime definitivement.");
          }
        } else {
          setMsg("Mode presentation DESACTIVE.");
        }
      }
      onRefresh();
    } else {
      setMsg(r.reason || "Erreur.");
    }
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div className={`mt-4 rounded-xl p-4 border ${isActive ? "bg-amber-50 border-amber-300" : "bg-slate-50 border-slate-200"}`}>
      <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
        <Eye className="w-4 h-4 text-amber-600" />
        Mode Presentation
      </h4>
      <p className="text-xs text-slate-500 mb-3">
        {isActive
          ? "ACTIF — Toutes les sections sont visibles pour tout le monde."
          : "Quand active, toutes les sections du site deviennent visibles pour tous les visiteurs (ideal pour une presentation)."}
      </p>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`text-xs font-semibold px-4 py-2 rounded-lg transition ${
          isActive
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
        }`}
      >
        {loading ? "..." : isActive ? "Desactiver le mode presentation" : "Activer le mode presentation"}
      </button>
      {msg && <p className={`text-xs font-semibold mt-2 ${isActive ? "text-amber-700" : "text-emerald-600"}`}>{msg}</p>}
    </div>
  );
}

// 🕐 Affiche le temps restant avant expiration de la session admin (14j)
function SessionExpiry() {
  const [info, setInfo] = useState<{ daysLeft: number; expiry: number } | null>(null);
  useEffect(() => {
    const s = getMemberSession();
    if (s?.expiry) {
      const daysLeft = Math.ceil((s.expiry - Date.now()) / (24 * 60 * 60 * 1000));
      setInfo({ daysLeft, expiry: s.expiry });
    }
  }, []);
  if (!info) return null;
  // Affichage uniquement si <= 5 jours restants (sinon trop verbeux)
  if (info.daysLeft > 5) return null;
  const isUrgent = info.daysLeft <= 2;
  return (
    <div className={`mb-4 rounded-xl px-4 py-2.5 flex items-center gap-2 ${
      isUrgent
        ? "bg-red-50 border border-red-200 text-red-700"
        : "bg-amber-50 border border-amber-200 text-amber-700"
    }`}>
      <span className="text-base">🕐</span>
      <p className="text-xs font-medium">
        Ta session admin {info.daysLeft <= 0 ? "expire bientôt" : info.daysLeft === 1 ? "expire dans 1 jour" : `expire dans ${info.daysLeft} jours`}.
        Tu devras te reconnecter (avec un nouveau code 2FA).
      </p>
    </div>
  );
}
