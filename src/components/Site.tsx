"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DB, PRIX, QUOTA_DEFAULT } from "@/lib/types";
import { emptyDB, fetchAdminDB, fetchAdminDBByMember, fetchPublicDB, saveDB, saveDBByMember, checkMemberSession, fetchPrivateActualites } from "@/lib/db";
import { supabaseClient } from "@/lib/supabase";
import { getMemberSession, clearMemberSession, MemberSession } from "@/lib/useMemberSession";
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

export default function Site() {
  const [db, setDb] = useState<DB>(emptyDB());
  const [membresCount, setMembresCount] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [memberLoginOpen, setMemberLoginOpen] = useState(false);
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [memberSession, setMemberSession] = useState<MemberSession | null>(null);
  const [privateActualites, setPrivateActualites] = useState<import("@/lib/types").Actualite[]>([]);

  // Credentials admin via espace membre (stockés en mémoire uniquement, jamais en localStorage)
  const memberAdminCode = useRef<string | null>(null);
  const [isMemberAdmin, setIsMemberAdmin] = useState(false); // true = admin via membre (pas Supabase Auth)
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
      const data = await fetchAdminDBByMember(memberSession.email, memberAdminCode.current);
      if (data) { setDb(data); setMembresCount(data.membres.length); }
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
      // Admin membre : restaurer le code depuis localStorage (persiste après fermeture navigateur)
      const savedCode = localStorage.getItem("saccb_admin_code");
      if (savedCode) {
        memberAdminCode.current = savedCode;
        setIsMemberAdmin(true);
        fetchAdminDBByMember(session.email, savedCode).then((data) => {
          if (data) { setDb(data); setMembresCount(data.membres.length); }
        });
      }
    } else {
      // Membre normal : vérifier en arrière-plan que le compte existe toujours en DB
      // Si supprimé par l'admin, la session est effacée dès la prochaine visite
      checkMemberSession(session.email, session.membreId).then((valid) => {
        if (!valid) {
          clearMemberSession();
          setMemberSession(null);
        }
      });
    }
  }, []);

  useEffect(() => {
    refreshPublic();
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") && hash.includes("access_token")) {
        supabaseClient.auth.getSession().then(() => setResetOpen(true));
        return;
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
      // Re-vérifier que le membre existe toujours en DB (cas suppression par admin)
      if (!memberSession.isAdmin) {
        const valid = await checkMemberSession(memberSession.email, memberSession.membreId);
        if (!valid) {
          clearMemberSession();
          setMemberSession(null);
          setMemberLoginOpen(true);
          return;
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

    if (session.isAdmin && adminCode) {
      // Admin via espace membre : stocker le code en mémoire + sessionStorage, ouvrir l'admin
      memberAdminCode.current = adminCode;
      localStorage.setItem("saccb_admin_code", adminCode);
      setIsMemberAdmin(true);
      const data = await fetchAdminDBByMember(session.email, adminCode);
      if (data) {
        setDb(data);
        setMembresCount(data.membres.length);
        setAdminOpen(true);
      } else {
        // Fallback : ouvrir l'espace membre normalement
        setMemberPanelOpen(true);
      }
    } else {
      setMemberPanelOpen(true);
    }
  };

  const onMemberPanelClose = () => {
    setMemberSession(null);
    setMemberPanelOpen(false);
    setIsMemberAdmin(false);
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
      <main>
        <Hero seasonY1={db.y1} seasonY2={db.y2} inscOpen={db.insc_open} />
        <Presentation />
        <Actualites actualites={[...(db.actualites || []), ...privateActualites]} memberSession={memberSession} />
        <Horaires />
        <Tournois
          db={db}
          memberSession={memberSession}
          onLoginRequest={() => setMemberLoginOpen(true)}
        />
        <Palmares db={db} memberSession={memberSession} onLoginRequest={() => setMemberLoginOpen(true)} />
        <Inscription
          db={db}
          membresCount={membresCount}
          quota={db.quota ?? QUOTA_DEFAULT}
          prix={PRIX}
          onMembreAdded={() => setMembresCount((n) => n + 1)}
        />
      </main>
      <Footer year={db.y1} onAdmin={() => setLoginOpen(true)} />

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
          configTournois={db.config_tournois ?? []}
          inscritsTournoi={db.inscrits_tournoi ?? []}
          archives={db.archives ?? []}
          onClose={onMemberPanelClose}
          onBack={onMemberPanelBack}
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
        />
      )}
    </>
  );
}
