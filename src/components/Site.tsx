"use client";

import { useCallback, useEffect, useState } from "react";
import { DB, PRIX, QUOTA_CLUB } from "@/lib/types";
import { emptyDB, fetchAdminDB, fetchPublicDB, saveDB } from "@/lib/db";
import { supabaseClient } from "@/lib/supabase";
import Navbar from "./Navbar";
import Hero from "./Hero";
import Presentation from "./Presentation";
import Tournois from "./Tournois";
import Inscription from "./Inscription";
import Footer from "./Footer";
import LoginModal from "./modals/LoginModal";
import ResetPasswordModal from "./modals/ResetPasswordModal";
import AdminPanel from "./admin/AdminPanel";

export default function Site() {
  const [db, setDb] = useState<DB>(emptyDB());
  const [membresCount, setMembresCount] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

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

  return (
    <>
      <Navbar onAdmin={() => setLoginOpen(true)} />
      <main>
        <Hero seasonY1={db.y1} seasonY2={db.y2} inscOpen={db.insc_open} />
        <Presentation />
        <Tournois db={db} />
        <Inscription
          db={db}
          membresCount={membresCount}
          quota={QUOTA_CLUB}
          prix={PRIX}
          onMembreAdded={() => setMembresCount((n) => n + 1)}
        />
      </main>
      <Footer year={db.y1} />

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={onLoginSuccess} />
      <ResetPasswordModal open={resetOpen} onClose={() => setResetOpen(false)} />
      {adminOpen && (
        <AdminPanel db={db} onClose={onCloseAdmin} onPersist={persist} onRefresh={refreshAdmin} />
      )}
    </>
  );
}
