import { supabaseClient, SUPA_URL, SUPA_KEY, EDGE_FUNCTION_URL } from "./supabase";
import { DB } from "./types";

export const emptyDB = (): DB => ({
  membres: [],
  factures: [],
  inscrits_tournoi: [],
  config_tournois: [],
  actualites: [],
  y1: 2024,
  y2: 2025,
  insc_open: true,
});

// ─── Données publiques (via Edge Function sécurisée) ───
export async function fetchPublicDB(): Promise<Partial<DB> & { membresCount: number }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "fetch_public" }),
  });
  const d = await res.json();
  return {
    insc_open: d.insc_open ?? true,
    y1: d.y1 ?? 2024,
    y2: d.y2 ?? 2025,
    quota: d.quota ?? 65,
    config_tournois: d.config_tournois ?? [],
    inscrits_tournoi: d.inscrits_tournoi ?? [],
    actualites: d.actualites ?? [],
    archives: d.archives ?? [],
    whatsappLink: d.whatsappLink,
    membresCount: d.membresCount ?? 0,
  };
}

// ─── Données admin (authentifié via Supabase Auth — protégé par RLS) ───
export async function fetchAdminDB(): Promise<DB | null> {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  const res = await fetch(`${SUPA_URL}/rest/v1/saccb_db?select=data&id=eq.1`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${session.access_token}` },
  });
  const json = await res.json();
  const d = json[0]?.data;
  if (!d) return null;
  return {
    ...emptyDB(),
    ...d,
    factures: d.factures ?? [],
    actualites: d.actualites ?? [],
    insc_open: d.insc_open ?? true,
  };
}

// ─── Sauvegarde admin (authentifié — protégé par RLS) ───
export async function saveDB(db: DB): Promise<void> {
  const { error } = await supabaseClient.from("saccb_db").update({ data: db }).eq("id", 1);
  if (error) {
    await supabaseClient.from("saccb_db").insert([{ id: 1, data: db }]);
  }
  // Synchroniser Google Sheets via Edge Function
  fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "sync_sheets", data: db }),
  }).catch(() => {});
}

// ─── Inscription publique (via Edge Function sécurisée) ───
export async function publicAddMembre(membre: {
  nom: string;
  email: string;
  tel: string;
  type: "Adulte" | "Etudiant";
  paymentMethod?: "online" | "virement";
  code?: string;
  newsOptIn?: boolean;
}): Promise<{ ok: boolean; reason?: string; membreId?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "add_membre", ...membre }),
  });
  return res.json();
}

// ─── Inscription tournoi (via Edge Function sécurisée) ───
export async function publicRegisterTournoi(tournoiId: string, p1: string, p2: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "register_tournoi", tournoiId, p1, p2 }),
  });
  return res.json();
}

// ─── Vérification membre (connexion espace membre) ───
export async function verifyMembre(
  email: string,
  code: string
): Promise<{ ok: boolean; paid?: boolean; membre?: { id: string; nom: string; type: string; email: string }; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "verify_membre", email: email.toLowerCase().trim(), code }),
  });
  return res.json();
}

// ─── Notifier les adhérents par email (via Edge Function) ───
export async function notifyMembres(
  tournoiId: string,
  tournoiName: string
): Promise<{ ok: boolean; sent?: number; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "notify_membres", tournoiId, tournoiName }),
  });
  return res.json();
}

// ─── Notifier tous les anciens adhérents du début de nouvelle saison ───
export async function adminNotifyNewSeason(): Promise<{ ok: boolean; sent?: number; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "notify_new_season" }),
  });
  return res.json();
}

// ─── Code oublié — envoyer le code par email ───
export async function publicForgotCode(email: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "forgot_code", email: email.toLowerCase().trim() }),
  });
  return res.json();
}

// ─── Changer le code personnel d'un membre ───
export async function memberChangeCode(
  email: string,
  oldCode: string,
  newCode: string
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "change_code", email, oldCode, newCode }),
  });
  return res.json();
}

// ─── Envoyer email de confirmation (virement validé par admin) ───
export async function adminSendConfirmation(membreId: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "send_confirmation", membreId }),
  });
  return res.json();
}

// ─── Formulaire de contact public ───
export async function publicContact(name: string, email: string, message: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "contact", name, email, message }),
  });
  return res.json();
}

// ─── Envoyer email de bienvenue (ajout manuel par admin) ───
export async function adminSendWelcome(membreId: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "send_welcome", membreId }),
  });
  return res.json();
}

// ─── Marquer payé (via Edge Function sécurisée) ───
export async function publicMarkPaid(membreId: string): Promise<{ ok: boolean }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "mark_paid", membreId }),
  });
  return res.json();
}
