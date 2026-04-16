"use client";

import { useCallback, useEffect, useState } from "react";
import { DB, PRIX, QUOTA_DEFAULT } from "@/lib/types";
import { emptyDB, fetchAdminDB, fetchPublicDB, saveDB } from "@/lib/db";
import { supabaseClient } from "@/lib/supabase";
import { getMemberSession, MemberSession } from "@/lib/useMemberSession";
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

export default function Site() {
  const [db, setDb] = useState<DB>(emptyDB());
  const [membresCount, setMembresCount] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [memberLoginOpen, setMemberLoginOpen] = useState(false);
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [memberSession, setMemberSession] = useState<MemberSession | null>(null);

  const refreshPublic = useCallback(async () => {
    try {
      const d = await fetchPublicDB();
      setDb((prev) => ({ ...prev, ...d, membres: prev.membres, factures: prev.factures }));
      setMembresCount(d.membresCount);
    } catch {}
  }, []);

  const refreshAdmin = useCallback(async () => {
    const data = await fetchAdminDB();
    if (data) {
      setDb(data);
      setMembresCount(data.membres.length);
    }
  }, []);

  const persist = useCallback(async (next: DB) => {
    setDb(next);
    setMembresCount(next.membres.length);
    await saveDB(next);
  }, []);

  // Restaurer la session membre depuis localStorage
  useEffect(() => {
    const session = getMemberSession();
    if (session) setMemberSession(session);
  }, []);

  useEffect(() => {
    refreshPublic();
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") && hash.includes("access_token")) {
        supabaseClient.auth.getSession().then(() => setResetOpen(true));
        return;
      }
      // Auto-restauration de session admin (cookie persistant)
      supabaseClient.auth.getSession().then(({ data }) => {
        if (data.session) {
          setAdminOpen(true);
          refreshAdmin();
        }
      });
    }
  }, [refreshPublic, refreshAdmin]);

  // Bloque le scroll du body quand le panel admin est ouvert
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = adminOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [adminOpen]);

  const onLoginSuccess = async () => {
    setLoginOpen(false);
    setAdminOpen(true);
    await refreshAdmin();
  };

  const onCloseAdmin = async () => {
    await supabaseClient.auth.signOut();
    setAdminOpen(false);
    setDb((d) => ({ ...d, membres: [], factures: [] }));
  };

  const onMemberButtonClick = () => {
    if (memberSession) {
      setMemberPanelOpen(true);
    } else {
      setMemberLoginOpen(true);
    }
  };

  const onMemberLoginSuccess = (session: MemberSession) => {
    setMemberSession(session);
    setMemberLoginOpen(false);
    setMemberPanelOpen(true);
  };

  const onMemberPanelClose = () => {
    setMemberSession(null);
    setMemberPanelOpen(false);
  };

  return (
    <>
      <Navbar
        onAdmin={() => setLoginOpen(true)}
        onMember={onMemberButtonClick}
        isMember={!!memberSession}
      />
      <main>
        <Hero seasonY1={db.y1} seasonY2={db.y2} inscOpen={db.insc_open} />
        <Presentation />
        <Actualites actualites={db.actualites || []} />
        <Horaires />
        <Tournois
          db={db}
          memberSession={memberSession}
          onLoginRequest={() => setMemberLoginOpen(true)}
        />
        <Inscription
          db={db}
          membresCount={membresCount}
          quota={db.quota ?? QUOTA_DEFAULT}
          prix={PRIX}
          onMembreAdded={() => setMembresCount((n) => n + 1)}
        />
      </main>
      <Footer year={db.y1} />

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
          onClose={onMemberPanelClose}
        />
      )}
      {adminOpen && (
        <AdminPanel db={db} onClose={onCloseAdmin} onPersist={persist} onRefresh={refreshAdmin} />
      )}
    </>
  );
}
