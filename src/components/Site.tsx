"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DB, PRIX, QUOTA_DEFAULT } from "@/lib/types";
import { emptyDB, fetchAdminDB, fetchAdminDBByMember, fetchPublicDB, saveDB, saveDBByMember, checkMemberSession, fetchPrivateActualites, trackView } from "@/lib/db";
import { supabaseClient } from "@/lib/supabase";
import { getMemberSession, clearMemberSession, setMemberSession as persistMemberSession, MemberSession } from "@/lib/useMemberSession";
import Navbar from "./Navbar";
import Hero from "./Hero";
import Presentation from "./Presentation";
import Actualites from "./Actualites";
import Horaires from "./Horaires";
import Tournois from "./Tournois";
import Inscription from "./Inscription";
import Footer from "./Footer";
import LoginModal from "./modals/LoginModal";
import MemberLoginModal from "./modals/MemberLoginModal";
import ResetPasswordModal from "./modals/ResetPasswordModal";
import AdminPanel from "./admin/AdminPanel";
import MemberPanel from "./MemberPanel";
import Palmares from "./Palmares";
import Engagement from "./Engagement";
import Rules from "./Rules";
import ContactSection from "./ContactSection";
import BureauPublic from "./BureauPublic";
import ScrollButton from "./ScrollButton";
import FadeInSection from "./FadeInSection";
import WaveDivider from "./WaveDivider";

type SiteMode = "full" | "actualites" | "tournois" | "inscription" | "contact";

export default function Site({ mode = "full" }: { mode?: SiteMode } = {}) {
  const [db, setDb] = useState<DB>(emptyDB());
  const [membresCount, setMembresCount] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [memberLoginOpen, setMemberLoginOpen] = useState(false);
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  // Quand un mail "engagement AG" est cliqué via ?member=1&procuration=1, on ouvre le panneau membre
  // PUIS on auto-ouvre la modale procuration. Cet etat est consume par MemberPanel via une prop.
  const [autoOpenProcuration, setAutoOpenProcuration] = useState(false);
  const [memberSession, setMemberSession] = useState<MemberSession | null>(null);
  const [privateActualites, setPrivateActualites] = useState<import("@/lib/types").Actualite[]>([]);

  // Credentials admin via espace membre (stockés en mémoire uniquement, jamais en localStorage)
  const memberAdminCode = useRef<string | null>(null);
  const [isMemberAdmin, setIsMemberAdmin] = useState(false); // true = admin via membre (pas Supabase Auth)
  const [isReadOnlyAdmin, setIsReadOnlyAdmin] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState<string[] | undefined>(undefined);
  const [supabaseAdminEmail, setSupabaseAdminEmail] = useState<string | undefined>(undefined);

  const refreshPublic = useCallback(async () => {
    try {
      const d = await fetchPublicDB();
      setDb((prev) => ({ ...prev, ...d, membres: prev.membres, factures: prev.factures }));
      setMembresCount(d.membresCount);
    } catch {}
  }, []);

  const refreshAdmin = useCallback(async () => {
    if (isMemberAdmin && memberSession && memberAdminCode.current) {
      const result = await fetchAdminDBByMember(memberSession.email, memberAdminCode.current);
      if (result) { setDb(result.db); setMembresCount(result.db.membres.length); setIsReadOnlyAdmin(result.readOnly); setAdminPermissions(result.permissions); }
    } else {
      const data = await fetchAdminDB();
      if (data) { setDb(data); setMembresCount(data.membres.length); }
    }
  }, [isMemberAdmin, memberSession]);

  const persist = useCallback(async (next: DB) => {
    setDb(next);
    setMembresCount(next.membres.length);
    if (isMemberAdmin && memberSession && memberAdminCode.current) {
      await saveDBByMember(memberSession.email, memberAdminCode.current, next);
    } else {
      await saveDB(next);
    }
  }, [isMemberAdmin, memberSession]);

  // Restaurer la session membre depuis localStorage + code admin depuis localStorage
  useEffect(() => {
    const session = getMemberSession();
    if (!session) return;

    // Afficher d'abord la session (UX instantanée), puis vérifier en arrière-plan
    setMemberSession(session);

    if (session.isAdmin) {
      // 🔒 NOUVEAU : on n'auto-ouvre PLUS l'admin au boot.
      // L'admin doit aller sur /admin et retaper son mot de passe.
      // (Le code admin n'est plus stocké en cache localStorage.)
      localStorage.removeItem("saccb_admin_code");
    } else {
      // Membre normal : vérifier en arrière-plan que le compte existe toujours en DB
      // Et synchroniser le statut paid (peut avoir changé si nouvelle saison ou validation admin)
      checkMemberSession(session.email, session.membreId).then((res) => {
        if (!res.valid) {
          clearMemberSession();
          setMemberSession(null);
          return;
        }
        // Si le statut paid a changé, mettre à jour la session locale
        if (res.paid !== undefined && res.paid !== session.paid) {
          const updated = { ...session, paid: res.paid };
          persistMemberSession(updated);
          setMemberSession(updated);
        }
      });
    }
  }, []);

  // Analytics : ping discret au chargement (best-effort)
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Évite de logger les visites admin/membre via params
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1" || params.get("member") === "1") return;
    const path = window.location.pathname + (window.location.hash || "");
    trackView(path, document.referrer || "");
  }, []);

  useEffect(() => {
    refreshPublic();
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") && hash.includes("access_token")) {
        supabaseClient.auth.getSession().then(() => setResetOpen(true));
        return;
      }
      // Auto-ouverture de l'espace membre depuis un lien email (?member=1)
      // + auto-ouverture de la procuration AG via ?member=1&procuration=1
      const params = new URLSearchParams(window.location.search);
      if (params.get("member") === "1" || params.get("member") === "true") {
        const sess = getMemberSession();
        if (params.get("procuration") === "1") {
          setAutoOpenProcuration(true);
        }
        if (sess) {
          setMemberPanelOpen(true);
        } else {
          setMemberLoginOpen(true);
        }
        // Nettoyer l'URL
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      }
      // Auto-restauration de session admin Supabase (fallback)
      supabaseClient.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSupabaseAdminEmail(data.session.user?.email ?? undefined);
          setAdminOpen(true);
          fetchAdminDB().then((d) => { if (d) { setDb(d); setMembresCount(d.membres.length); } });
        }
      });
    }
  }, [refreshPublic]);

  // Raccourci clavier admin : Ctrl+Shift+A
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "A") {
        e.preventDefault();
        if (!adminOpen) setLoginOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [adminOpen]);

  // Charger les actualités privées quand un membre est connecté
  useEffect(() => {
    if (!memberSession || memberSession.isAdmin) {
      setPrivateActualites([]);
      return;
    }
    const savedCode = sessionStorage.getItem("saccb_member_code");
    if (!savedCode) return;
    fetchPrivateActualites(memberSession.email, savedCode, memberSession.membreId)
      .then(setPrivateActualites)
      .catch(() => {});
  }, [memberSession]);

  // Bloque le scroll quand admin est ouvert
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = adminOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [adminOpen]);

  const onLoginSuccess = async () => {
    setLoginOpen(false);
    setAdminOpen(true);
    const { data: { session } } = await supabaseClient.auth.getSession();
    setSupabaseAdminEmail(session?.user?.email ?? undefined);
    await fetchAdminDB().then((d) => { if (d) { setDb(d); setMembresCount(d.membres.length); } });
  };

  const onCloseAdmin = async () => {
    if (!isMemberAdmin) {
      // Admin Supabase Auth : déconnexion complète
      await supabaseClient.auth.signOut();
      setIsMemberAdmin(false);
      setSupabaseAdminEmail(undefined);
      setIsReadOnlyAdmin(false);
      setAdminPermissions(undefined);
      memberAdminCode.current = null;
      localStorage.removeItem("saccb_admin_code");
      setDb((d) => ({ ...d, membres: [], factures: [] }));
    }
    // Admin via membre : on garde le code en mémoire + localStorage, bouton Admin reste visible
    setAdminOpen(false);
  };

  const onReopenAdmin = async () => {
    setAdminOpen(true);
    await refreshAdmin();
  };

  const onMemberButtonClick = async () => {
    if (memberSession) {
      // Re-vérifier que le membre existe toujours en DB et que le statut paid est à jour
      if (!memberSession.isAdmin) {
        const res = await checkMemberSession(memberSession.email, memberSession.membreId);
        if (!res.valid) {
          clearMemberSession();
          setMemberSession(null);
          setMemberLoginOpen(true);
          return;
        }
        // Mettre à jour le statut paid si différent (ex: après démarrage nouvelle saison)
        if (res.paid !== undefined && res.paid !== memberSession.paid) {
          const updated = { ...memberSession, paid: res.paid };
          persistMemberSession(updated);
          setMemberSession(updated);
        }
      }
      setMemberPanelOpen(true);
    } else {
      setMemberLoginOpen(true);
    }
  };

  const onMemberLoginSuccess = async (session: MemberSession, adminCode?: string) => {
    setMemberSession(session);
    setMemberLoginOpen(false);

    // 🔒 NOUVEAU : même si admin, on n'ouvre PLUS l'overlay admin automatiquement.
    // Pour aller dans l'admin → cliquer sur le bouton "Admin" dans la navbar → /admin
    // (qui demandera de retaper le mot de passe).
    setMemberPanelOpen(true);
    // On vide aussi tout cache éventuel
    localStorage.removeItem("saccb_admin_code");
    // adminCode est ignoré ici volontairement
    void adminCode;
  };

  const onMemberPanelClose = () => {
    setMemberSession(null);
    setMemberPanelOpen(false);
    setIsMemberAdmin(false);
    setIsReadOnlyAdmin(false);
    setAdminPermissions(undefined);
    memberAdminCode.current = null;
    localStorage.removeItem("saccb_admin_code");
    sessionStorage.removeItem("saccb_member_code");
    setPrivateActualites([]);
  };

  // Fermer le panneau sans se déconnecter
  const onMemberPanelBack = () => {
    setMemberPanelOpen(false);
  };

  return (
    <>
      <Navbar
        onMember={onMemberButtonClick}
        isMember={!!memberSession}
        isAdmin={isMemberAdmin}
        onAdmin={onReopenAdmin}
        onAdminLogin={() => memberSession?.isAdmin ? setMemberLoginOpen(true) : setLoginOpen(true)}
      />
      {/* Bannière de réinscription : visible uniquement aux adhérents connectés non-payés */}
      {memberSession && memberSession.paid !== true && db.insc_open && (
        <div className="fixed top-[72px] inset-x-0 z-40 bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg border-b border-amber-600/30 px-4 py-3 flex items-center justify-center gap-3 flex-wrap text-center">
          <span className="text-sm md:text-base text-white font-semibold">
            ⏳ Adhésion saison {db.y1}–{db.y2} à renouveler !
          </span>
          <button
            onClick={() => setMemberPanelOpen(true)}
            className="bg-white text-amber-700 hover:bg-amber-50 px-4 py-1.5 rounded-lg text-sm font-bold transition shadow-sm"
          >
            Renouveler maintenant →
          </button>
        </div>
      )}
      <main className={mode !== "full" ? "pt-24 md:pt-28" : ""}>
        {mode !== "full" && (
          <div className="max-w-7xl mx-auto px-6 pt-2 pb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#1e3a5f] transition group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Retour au site
            </Link>
          </div>
        )}
        {mode === "full" && (
          <Hero
            seasonY1={db.y1}
            seasonY2={db.y2}
            inscOpen={db.insc_open}
            isMember={!!memberSession}
            engagementOpen={db.pollsOpen === true || db.agOpen === true || db.reportsOpen === true || db.engagementOpen === true}
            membresCount={membresCount}
          />
        )}
        {/* Vague de transition Hero → Présentation */}
        {mode === "full" && <WaveDivider variant="wave1" fillColor="#f8fafc" className="-mt-1" />}

        {/* Mode présentation : toutes les sections visibles. Sinon on respecte les toggles. */}
        {mode === "full" && (db.presentationMode || db.sectionsVisible?.presentation !== false) && (
          <FadeInSection><Presentation /></FadeInSection>
        )}

        {(mode === "full" || mode === "actualites") && (db.presentationMode || db.sectionsVisible?.actualites !== false) && (
          <FadeInSection>
            <Actualites actualites={[...(db.actualites || []), ...privateActualites]} memberSession={memberSession} />
          </FadeInSection>
        )}

        {mode === "full" && (
          <FadeInSection>
            <Engagement
              polls={(db as unknown as { polls?: import("@/lib/types").Poll[] & { voteCounts?: Record<number, number>; totalVotes?: number }[] }).polls ?? []}
              agItems={db.agItems ?? []}
              reunionReports={db.reunionReports ?? []}
              archives={db.archives ?? []}
              pollsOpen={db.pollsOpen === true || db.engagementOpen === true}
              agOpen={db.agOpen === true || db.engagementOpen === true}
              reportsOpen={db.reportsOpen === true || (db.reportsOpen === undefined && (db.pollsOpen === true || db.engagementOpen === true))}
              memberSession={memberSession}
              onLoginRequest={() => setMemberLoginOpen(true)}
              onRefresh={async () => { await refreshPublic(); }}
            />
          </FadeInSection>
        )}
        {mode === "full" && (db.presentationMode || db.sectionsVisible?.rules !== false) && (
          <FadeInSection>
            <Rules
              clubRules={db.clubRules ?? ""}
              clubRulesPdfUrl={db.clubRulesPdfUrl}
              clubRulesPdfName={db.clubRulesPdfName}
              memberSession={memberSession}
              onLoginRequest={() => setMemberLoginOpen(true)}
            />
          </FadeInSection>
        )}
        {mode === "full" && (db.presentationMode || db.sectionsVisible?.horaires !== false) && (
          <FadeInSection><Horaires /></FadeInSection>
        )}

        {/* Vague de transition avant Tournois */}
        {mode === "full" && <WaveDivider variant="wave2" fillColor="#f0fdf4" />}

        {(mode === "full" || mode === "tournois") && (db.presentationMode || db.sectionsVisible?.tournois !== false) && (
          <FadeInSection>
            <Tournois
              db={db}
              memberSession={memberSession}
              onLoginRequest={() => setMemberLoginOpen(true)}
              membreNoms={(db as unknown as { membreNoms?: string[] }).membreNoms ?? []}
            />
          </FadeInSection>
        )}
        {mode === "full" && (db.presentationMode || db.sectionsVisible?.palmares !== false) && (
          <FadeInSection>
            <Palmares db={db} memberSession={memberSession} onLoginRequest={() => setMemberLoginOpen(true)} />
          </FadeInSection>
        )}
        {/* Bureau — visible pour membres connectés OU mode présentation */}
        {mode === "full" && (memberSession || db.presentationMode) && (db.bureauMembers ?? []).length > 0 && (
          <FadeInSection>
            <BureauPublic members={db.bureauMembers!} />
          </FadeInSection>
        )}

        {/* Vague de transition avant Inscription */}
        {mode === "full" && <WaveDivider variant="wave3" fillColor="#eff6ff" />}

        {/* Section inscription : cachée pour les membres connectés ou si toggle false */}
        {(mode === "full" || mode === "inscription") && (!memberSession || db.presentationMode) && (db.presentationMode || db.sectionsVisible?.inscription !== false) && (
          <FadeInSection>
            <Inscription
              db={db}
              membresCount={membresCount}
              quota={db.quota ?? QUOTA_DEFAULT}
              prix={PRIX}
              onMembreAdded={() => setMembresCount((n) => n + 1)}
            />
          </FadeInSection>
        )}

        {mode === "contact" && (
          <FadeInSection>
            <ContactSection whatsappLink={db.whatsappLink} />
          </FadeInSection>
        )}

        {/* Si membre connecté arrive sur /inscription, on lui montre un message */}
        {mode === "inscription" && memberSession && (
          <div className="max-w-2xl mx-auto py-20 px-6 text-center">
            <p className="text-2xl font-display text-slate-700 mb-4">Tu es déjà adhérent ! 🏸</p>
            <p className="text-slate-500 mb-6">Tu peux gérer ton adhésion depuis ton espace membre.</p>
            <a href="/" className="btn-primary">← Retour à l'accueil</a>
          </div>
        )}
      </main>
      <FadeInSection>
        <Footer year={db.y1} onAdmin={() => setLoginOpen(true)} />
      </FadeInSection>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={onLoginSuccess} />
      <ResetPasswordModal open={resetOpen} onClose={() => setResetOpen(false)} />
      <MemberLoginModal
        open={memberLoginOpen}
        onClose={() => setMemberLoginOpen(false)}
        onSuccess={onMemberLoginSuccess}
      />
      {memberSession && memberPanelOpen && (
        <MemberPanel
          session={memberSession}
          y1={db.y1}
          y2={db.y2}
          whatsappLink={db.whatsappLink}
          inscCloseDate={db.insc_close_date}
          configTournois={db.config_tournois ?? []}
          inscritsTournoi={db.inscrits_tournoi ?? []}
          archives={db.archives ?? []}
          onClose={onMemberPanelClose}
          onBack={onMemberPanelBack}
          autoOpenProcuration={autoOpenProcuration}
          onProcurationOpened={() => setAutoOpenProcuration(false)}
        />
      )}
      {adminOpen && (
        <AdminPanel
          db={db}
          onClose={onCloseAdmin}
          onPersist={persist}
          onRefresh={refreshAdmin}
          adminEmail={isMemberAdmin ? memberSession?.email : supabaseAdminEmail}
          adminCode={isMemberAdmin ? (memberAdminCode.current ?? undefined) : undefined}
          readOnly={isMemberAdmin ? isReadOnlyAdmin : false}
          permissions={isMemberAdmin ? adminPermissions : undefined}
        />
      )}
      <ScrollButton />
    </>
  );
}
