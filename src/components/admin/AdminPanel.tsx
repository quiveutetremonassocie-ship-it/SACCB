"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, FileSpreadsheet, FileText, QrCode, Download, ExternalLink, Eye, RefreshCw, DatabaseBackup, Upload, Users, Inbox, Mail, Trophy, Receipt, Newspaper, MessageSquare, BookOpen, CalendarCog, ChevronUp, ChevronDown, Send, HelpCircle, Shirt, BarChart3, LayoutDashboard, Menu, ClipboardList, Swords, LifeBuoy, CalendarDays } from "lucide-react";
import AdminAccueil from "./AdminAccueil";
// FileText réutilisé pour Documents officiels (déjà importé ci-dessus)
import { DB, Membre, getMontantMembre } from "@/lib/types";
import { adminExportBackup, adminImportBackup, adminSendBackupEmail, togglePresentationMode } from "@/lib/db";
import { getMemberSession } from "@/lib/useMemberSession";
import Accounting from "./Accounting";
import SeasonSettings from "./SeasonSettings";
import StatsAdhesions from "./StatsAdhesions";
import StatsVisites from "./StatsVisites";
import LockedAccounts from "./LockedAccounts";
import GlobalSearch from "./GlobalSearch";
import TournoisAdmin from "./TournoisAdmin";
import InterclubsAdmin from "./InterclubsAdmin";
import InscriptionsAdmin from "./InscriptionsAdmin";
import MembresAdmin from "./MembresAdmin";
import ActualitesAdmin from "./ActualitesAdmin";
import EngagementAdmin from "./EngagementAdmin";
import TshirtAdmin from "./TshirtAdmin";
import GuideAdmin from "./GuideAdmin";
import FaqAdmin from "./FaqAdmin";
import OfficialDocsAdmin from "./OfficialDocsAdmin";
import RulesAdmin from "./RulesAdmin";
import BureauAdmin from "./BureauAdmin";
import EmailingAdmin from "./EmailingAdmin";
import MessagesAdmin from "./MessagesAdmin";
import JournalAdmin from "./JournalAdmin";
import Agenda from "../Agenda";
import { evenementsAgenda } from "@/lib/agenda";
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
      // Montant réellement payé si saisi (réduction), sinon tarif normal
      const prix = getMontantMembre(db, m);
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

  // 🧭 Page affichée (mémorisée sur l'appareil) + menu tiroir sur téléphone
  const [section, setSection] = useState<string>("admin-accueil");
  const [menuOuvert, setMenuOuvert] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem("saccb_admin_section"); if (s) setSection(s); } catch { /* ignore */ }
  }, []);
  function aller(id: string) {
    setSection(id);
    setMenuOuvert(false);
    try { localStorage.setItem("saccb_admin_section", id); } catch { /* ignore */ }
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }
  // Les autres écrans (recherche, « répondre » à un message…) demandent un changement de page
  useEffect(() => {
    const surDemande = (e: Event) => { const id = (e as CustomEvent<string>).detail; if (id) aller(id); };
    window.addEventListener("admin-goto", surDemande);
    return () => window.removeEventListener("admin-goto", surDemande);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Prénom pour l'accueil : 1er mot du nom de la fiche adhérent de l'admin
  const prenomAdmin = (() => {
    const m = db.membres.find((x) => x.email?.toLowerCase() === (adminEmail || "").toLowerCase());
    return m?.nom?.trim().split(/\s+/)[0];
  })();

  // 🧭 Navigation de l'admin : une page à la fois, rangée par thème
  const messagesNonLus = (db.contactMessages ?? []).filter((m) => !m.archived && !m.respondedBy).length;
  const SECTIONS: { id: string; label: string; icon: typeof Users; groupe: string; visible: boolean; badge?: number; render: () => React.ReactNode }[] = [
    { id: "admin-accueil", label: "Tableau de bord", icon: LayoutDashboard, groupe: "", visible: true, render: () => (
      <AdminAccueil db={db} totals={totals} aller={aller} prenom={prenomAdmin} peutVoir={canSee} />
    ) },
    { id: "admin-membres", label: "Adhérents", icon: Users, groupe: "Adhérents", visible: canSee("membres"), render: () => (
      <>
        <MembresAdmin
                db={db}
                onPersist={safePersist}
                onEdit={setEditMembre}
                onRecu={setRecuMembre}
                adminEmail={adminEmail}
                adminCode={adminCode}
                readOnly={!canEdit("membres")}
              />
      </>
    ) },
    { id: "admin-bureau", label: "Bureau", icon: Users, groupe: "Adhérents", visible: canSee("bureau"), render: () => (
      <>
        <BureauAdmin db={db} onPersist={safePersist} readOnly={!canEdit("bureau")} />
      </>
    ) },
    { id: "admin-tournois", label: "Tournois", icon: Trophy, groupe: "Tournois", visible: canSee("tournois"), render: () => (
      <>
        <TournoisAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("tournois")} />
      </>
    ) },
    { id: "admin-inscriptions", label: "Inscriptions aux tournois", icon: ClipboardList, groupe: "Tournois", visible: canSee("inscriptions"), render: () => (
      <>
        <InscriptionsAdmin db={db} onPersist={safePersist} onEditBin={setEditBin} readOnly={!canEdit("inscriptions")} />
      </>
    ) },
    { id: "admin-interclubs", label: "Tournois inter-clubs", icon: Swords, groupe: "Tournois", visible: canSee("tournois"), render: () => (
      <>
        <InterclubsAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("tournois")} onRefresh={onRefresh} />
      </>
    ) },
    { id: "admin-messages", label: "Messages reçus", icon: Inbox, groupe: "Communication", visible: canSee("emailing"), badge: messagesNonLus, render: () => (
      <>
        <MessagesAdmin db={db} onRefresh={onRefresh} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("emailing")} />
      </>
    ) },
    { id: "admin-emailing", label: "Envoyer un mail", icon: Mail, groupe: "Communication", visible: canSee("emailing"), render: () => (
      <>
        <EmailingAdmin db={db} adminEmail={adminEmail} adminCode={adminCode} onRefresh={onRefresh} readOnly={!canEdit("emailing")} />
      </>
    ) },
    { id: "admin-agenda", label: "Agenda", icon: CalendarDays, groupe: "Communication", visible: canSee("actualites"), render: () => (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Les tournois et tournois inter-clubs s&apos;ajoutent tout seuls (à la date du tournoi). Clique sur un jour pour ajouter un autre événement : soirée, AG, stage, fermeture de la salle…</p>
        <Agenda
          sansTitre
          evenements={evenementsAgenda(db, true)}
          clubEvents={db.agendaEvents || []}
          onChange={canEdit("actualites") ? (next) => safePersist({ ...db, agendaEvents: next }) : undefined}
          onMasquer={canEdit("actualites") ? (id, masquer) => {
            const set = new Set(db.agendaMasques || []);
            if (masquer) set.add(id); else set.delete(id);
            return safePersist({ ...db, agendaMasques: [...set] });
          } : undefined}
        />
      </div>
    ) },
    { id: "admin-actualites", label: "Actualités", icon: Newspaper, groupe: "Communication", visible: canSee("actualites"), render: () => (
      <>
        <ActualitesAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("actualites")} />
      </>
    ) },
    { id: "admin-engagement", label: "Sondages & AG", icon: MessageSquare, groupe: "Communication", visible: canSee("engagement"), render: () => (
      <>
        <EngagementAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("engagement")} />
      </>
    ) },
    { id: "admin-faq", label: "FAQ adhérents", icon: HelpCircle, groupe: "Communication", visible: canSee("engagement"), render: () => (
      <>
        <FaqAdmin db={db} onPersist={safePersist} readOnly={!canEdit("engagement")} adminEmail={adminEmail} adminCode={adminCode} onRefresh={onRefresh} />
      </>
    ) },
    { id: "admin-comptabilite", label: "Comptabilité", icon: Receipt, groupe: "Trésorerie", visible: canSee("comptabilite"), render: () => (
      <>
        <Accounting db={db} totals={totals} onPersist={safePersist} readOnly={!canEdit("comptabilite")} adminEmail={adminEmail} adminCode={adminCode} />
      </>
    ) },
    { id: "admin-tshirts", label: "T-shirts", icon: Shirt, groupe: "Trésorerie", visible: canSee("engagement"), render: () => (
      <>
        <TshirtAdmin db={db} adminEmail={adminEmail} adminCode={adminCode} onPersist={safePersist} onRefresh={onRefresh} readOnly={!canEdit("engagement")} />
      </>
    ) },
    { id: "admin-helloasso", label: "HelloAsso · QR code", icon: QrCode, groupe: "Trésorerie", visible: true, render: () => (
      <>
        <HelloAssoQR helloassoPageUrl={db.clubConfig?.helloassoUrls?.page} />
      </>
    ) },
    { id: "admin-saison", label: "Paramètres saison", icon: CalendarCog, groupe: "Réglages", visible: canSee("saison"), render: () => (
      <>
        <SeasonSettings db={db} onPersist={safePersist} onRefresh={onRefresh} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("saison")} />
      </>
    ) },
    { id: "admin-rules", label: "Règlement intérieur", icon: BookOpen, groupe: "Réglages", visible: canSee("rules"), render: () => (
      <>
        <RulesAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("rules")} />
      </>
    ) },
    { id: "admin-analytics", label: "Statistiques", icon: BarChart3, groupe: "Réglages", visible: canSee("saison"), render: () => (
      <>
        <div className="space-y-4">
                <StatsAdhesions totals={totals} />
                <StatsVisites analyticsDaily={db.analyticsDaily} />
                {adminEmail && adminCode && <LockedAccounts adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("saison")} />}
              </div>
      </>
    ) },
    { id: "admin-sauvegarde", label: "Sauvegarde & export", icon: DatabaseBackup, groupe: "Réglages", visible: true, render: () => (
      <>
        <div className="glass p-4 md:p-6">
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
      </>
    ) },
    { id: "admin-notes", label: "Bloc-notes partagé", icon: FileText, groupe: "Réglages", visible: true, render: () => (
      <>
        <AdminNotes db={db} onPersist={safePersist} adminEmail={adminEmail} readOnly={readOnly} />
      </>
    ) },
    { id: "admin-journal", label: "Journal (privé)", icon: Eye, groupe: "Réglages", visible: !!db.adminJournal, render: () => (
      <>
        <JournalAdmin db={db} adminEmail={adminEmail} adminCode={adminCode} onRefresh={onRefresh} />
      </>
    ) },
    { id: "admin-guide", label: "Guide admin", icon: LifeBuoy, groupe: "Réglages", visible: true, render: () => (
      <>
        <GuideAdmin />
      </>
    ) },
  ].filter((x) => x.visible);
  const courante = SECTIONS.find((x) => x.id === section) || SECTIONS[0];
  const GROUPES = ["", "Adhérents", "Tournois", "Communication", "Trésorerie", "Réglages"];

  const navigation = (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
      {GROUPES.map((g) => {
        const items = SECTIONS.filter((x) => x.groupe === g);
        if (items.length === 0) return null;
        return (
          <div key={g || "accueil"}>
            {g && <p className="px-3 mb-1 text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">{g}</p>}
            <ul className="space-y-0.5">
              {items.map((it) => {
                const Icone = it.icon;
                const actif = it.id === courante.id;
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => aller(it.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left transition ${actif ? "bg-white text-[#1e3a5f] font-semibold shadow" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                    >
                      <Icone className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{it.label}</span>
                      {!!it.badge && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{it.badge > 99 ? "99+" : it.badge}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const enteteMenu = (
    <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="w-10 h-10 rounded-xl bg-white/10 p-1" />
      <div className="min-w-0">
        <p className="font-bold tracking-wider">SACCB</p>
        <p className="text-[11px] text-white/50 truncate">{adminEmail || "Administration"}</p>
      </div>
    </div>
  );

  return (
    <div className="admin-shell fixed inset-0 z-[2000] bg-[#f1f5f9] flex">
      {/* ── Menu latéral (ordinateur) ── */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-gradient-to-b from-[#0f2440] to-[#1e3a5f] text-white">
        {enteteMenu}
        {navigation}
        <div className="p-3 border-t border-white/10">
          <button onClick={onClose} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/80 hover:bg-white/10"><X className="w-4 h-4" /> Quitter l&apos;admin</button>
        </div>
      </aside>

      {/* ── Menu tiroir (téléphone) ── */}
      {menuOuvert && (
        <div className="lg:hidden fixed inset-0 z-[2050] bg-black/50" onClick={() => setMenuOuvert(false)}>
          <aside className="w-72 max-w-[85vw] h-full flex flex-col bg-gradient-to-b from-[#0f2440] to-[#1e3a5f] text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {enteteMenu}
            {navigation}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Barre du haut ── */}
        <header className="shrink-0 bg-white border-b border-slate-200 px-3 md:px-6 py-3 flex items-center gap-2">
          <button onClick={() => setMenuOuvert(true)} className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-700" aria-label="Menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            {courante.groupe && <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">{courante.groupe}</p>}
            <h2 className="text-lg md:text-xl font-bold text-slate-800 truncate">{courante.label}</h2>
          </div>
          <GlobalSearch db={db} />
          <button
            onClick={manualRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600"
            title={`Actualiser (dernière mise à jour : ${new Date(lastRefresh).toLocaleTimeString("fr-FR")})`}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button onClick={onClose} className="lg:hidden p-2 rounded-xl hover:bg-red-50 text-red-600" title="Quitter l'admin">
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* ── Contenu de la page ── */}
        <main
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          <div className="max-w-5xl mx-auto p-3 md:p-6 pb-24 md:pb-10 space-y-4">
            {readOnly && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700 font-medium">Mode lecture seule — les modifications ne sont pas autorisées.</p>
              </div>
            )}

            {/* 🔧 Bandeau mode maintenance */}
            {db.maintenanceMode && (
              <div className="bg-red-50 border-2 border-red-400 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔧</span>
                  <div>
                    <p className="text-sm text-red-700 font-bold uppercase tracking-wide">Site en maintenance</p>
                    <p className="text-xs text-red-600">Les visiteurs ne peuvent pas accéder au site. Pense à désactiver le mode maintenance quand tu as terminé.</p>
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
                    Désactiver
                  </button>
                )}
              </div>
            )}

            {/* 🕐 Indicateur d'expiration de session */}
            <SessionExpiry />

            {permissions !== undefined && permissions.length === 0 && (
              <div className="glass p-6 text-center">
                <p className="text-slate-700 font-semibold mb-2">🔒 Aucun accès configuré</p>
                <p className="text-sm text-slate-500">
                  Votre compte admin n&apos;a accès à aucune section. Contactez le bureau de l’association pour obtenir des permissions.
                </p>
              </div>
            )}

            <div key={courante.id}>{courante.render()}</div>
          </div>
        </main>
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
