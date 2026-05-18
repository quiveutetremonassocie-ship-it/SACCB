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
export async function fetchPublicDB(): Promise<Partial<DB> & { membresCount: number; membreNoms?: string[] }> {
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
    polls: d.polls ?? [],
    agItems: d.agItems ?? [],
    reunionReports: d.reunionReports ?? [],
    pollsOpen: d.pollsOpen === true,
    agOpen: d.agOpen === true,
    membreNoms: d.membreNoms ?? [],
    clubRules: d.clubRules ?? "",
    clubRulesPdfUrl: d.clubRulesPdfUrl ?? undefined,
    clubRulesPdfName: d.clubRulesPdfName ?? undefined,
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
  // Note: la sync Google Sheets se fait directement via l'Edge Function (admin_save côté serveur)
  // ou via un appel séparé authentifié. On ne sync pas ici car sync_sheets requiert maintenant
  // une auth admin et cette fonction est appelée depuis l'auth Supabase RLS, pas l'admin via espace membre.
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
  photoConsent?: boolean;
  grouped?: boolean; // true = inscription groupée, ne pas écraser les autres membres du même email
}): Promise<{ ok: boolean; reason?: string; membreId?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "add_membre", ...membre }),
  });
  return res.json();
}

// ─── Inscription tournoi (via Edge Function sécurisée — auth membre + payé requis) ───
export async function publicRegisterTournoi(tournoiId: string, p1: string, p2: string, email: string, code: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "register_tournoi", tournoiId, p1, p2, email: email.toLowerCase().trim(), code }),
  });
  return res.json();
}

// ─── Vérification membre (connexion espace membre) ───
export async function verifyMembre(
  email: string,
  code: string
): Promise<{ ok: boolean; paid?: boolean; isAdmin?: boolean; codeJustReset?: boolean; membre?: { id: string; nom: string; type: string; email: string; newsOptIn?: boolean }; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "verify_membre", email: email.toLowerCase().trim(), code }),
  });
  return res.json();
}

// ─── Vérification session membre (existe encore en DB ? statut payé à jour ?) ───
export async function checkMemberSession(email: string, membreId: string): Promise<{ valid: boolean; paid?: boolean }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "check_session", email: email.toLowerCase().trim(), membreId }),
    });
    const data = await res.json();
    return { valid: data.ok === true, paid: data.paid };
  } catch {
    return { valid: true }; // En cas d'erreur réseau, on laisse passer pour ne pas bloquer l'accès
  }
}

// ─── Notifier les adhérents par email (via Edge Function) — AUTH ADMIN REQUISE ───
export async function notifyMembres(
  tournoiId: string,
  tournoiName: string,
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; sent?: number; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "notify_membres", tournoiId, tournoiName, adminEmail, adminCode }),
  });
  return res.json();
}

// ─── Notifier les adhérents qu'un nouveau sondage est disponible — AUTH ADMIN ───
export async function adminNotifyNewPoll(
  adminEmail: string,
  adminCode: string,
  pollId: string
): Promise<{ ok: boolean; sent?: number; total?: number; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "notify_new_poll", adminEmail, adminCode, pollId }),
  });
  return res.json();
}

// ─── Notifier les adhérents que la section Sondages & AG est ouverte — AUTH ADMIN ───
export async function adminNotifyEngagementOpen(
  adminEmail: string,
  adminCode: string,
  includePolls: boolean,
  includeAG: boolean
): Promise<{ ok: boolean; sent?: number; total?: number; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "notify_engagement_open", adminEmail, adminCode, includePolls, includeAG }),
  });
  return res.json();
}

// ─── Notifier tous les anciens adhérents du début de nouvelle saison — AUTH ADMIN REQUISE ───
export async function adminNotifyNewSeason(adminEmail: string, adminCode: string): Promise<{ ok: boolean; sent?: number; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "notify_new_season", adminEmail, adminCode }),
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

// ─── Réinitialiser le code d'un adhérent (depuis l'admin) — AUTH ADMIN REQUISE ───
// Génère un nouveau code aléatoire et l'envoie par email à l'adhérent
export async function adminResetMemberCode(
  membreId: string,
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_reset_code", membreId, adminEmail, adminCode }),
  });
  return res.json();
}

// ─── Envoyer email de confirmation (virement validé par admin) — AUTH ADMIN REQUISE ───
export async function adminSendConfirmation(membreId: string, adminEmail: string, adminCode: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "send_confirmation", membreId, adminEmail, adminCode }),
  });
  return res.json();
}

// ─── Admin via espace membre (email+code comme credentials) ───
export async function fetchAdminDBByMember(email: string, code: string): Promise<{ db: DB; readOnly: boolean; permissions?: string[] } | null> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_fetch", email: email.toLowerCase().trim(), code }),
  });
  const r = await res.json();
  if (!r.ok || !r.data) return null;
  return {
    db: { ...r.data, factures: r.data.factures ?? [], actualites: r.data.actualites ?? [], insc_open: r.data.insc_open ?? true },
    readOnly: r.readOnly === true,
    permissions: Array.isArray(r.permissions) ? r.permissions : undefined,
  };
}

export async function saveDBByMember(email: string, code: string, db: DB): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "admin_save", email: email.toLowerCase().trim(), code, data: db }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[saveDBByMember] HTTP", res.status, text);
      return { ok: false, reason: `Erreur serveur (${res.status})` };
    }
    const json = await res.json().catch(() => ({}));
    if (!json.ok) {
      console.error("[saveDBByMember] API error:", json);
      return { ok: false, reason: json.reason || "Erreur de sauvegarde" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[saveDBByMember] Network error:", e);
    return { ok: false, reason: "Erreur réseau" };
  }
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

// ─── Envoyer email de bienvenue (ajout manuel par admin) — AUTH ADMIN REQUISE ───
export async function adminSendWelcome(membreId: string, adminEmail: string, adminCode: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "send_welcome", membreId, adminEmail, adminCode }),
  });
  return res.json();
}

// ─── Actualités privées (membres authentifiés) ───
export async function fetchPrivateActualites(
  email: string,
  code: string,
  membreId: string
): Promise<import("./types").Actualite[]> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "fetch_private_actualites", email: email.toLowerCase().trim(), code, membreId }),
    });
    const data = await res.json();
    if (!data.ok) return [];
    return data.actualites ?? [];
  } catch {
    return [];
  }
}

// ─── Mettre à jour la préférence news d'un membre ───
export async function memberUpdateNewsOptIn(
  email: string,
  code: string,
  membreId: string,
  newsOptIn: boolean
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "update_news_optin", email: email.toLowerCase().trim(), code, membreId, newsOptIn }),
  });
  return res.json();
}

// ─── Historique des emails envoyés : suppression d'une entrée ou vidage ───
export async function adminDeleteEmailLog(adminEmail: string, adminCode: string, logId: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "delete_email_log", adminEmail, adminCode, logId }),
  });
  return res.json();
}

export async function adminClearEmailHistory(adminEmail: string, adminCode: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "clear_email_history", adminEmail, adminCode }),
  });
  return res.json();
}

// ─── Engagement adhérents : votes sondages, questions AG ───

export async function memberVotePoll(
  email: string,
  code: string,
  membreId: string,
  pollId: string,
  optionIdx: number
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "vote_poll", email: email.toLowerCase().trim(), code, membreId, pollId, optionIdx }),
  });
  return res.json();
}

export async function memberSubmitAGItem(
  email: string,
  code: string,
  membreId: string,
  text: string,
  type: "question" | "amelioration",
  anonymous: boolean
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "submit_ag_item", email: email.toLowerCase().trim(), code, membreId, text, type, anonymous }),
  });
  return res.json();
}

export async function fetchMyVotes(
  email: string,
  code: string,
  membreId: string
): Promise<Record<string, number[]>> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "fetch_my_votes", email: email.toLowerCase().trim(), code, membreId }),
    });
    const j = await res.json();
    return j.ok ? j.myVotes ?? {} : {};
  } catch {
    return {};
  }
}

// ─── Envoi d'un email personnalisé aux adhérents (avec pièces jointes) — AUTH ADMIN ───
export async function adminSendEmail(args: {
  adminEmail: string;
  adminCode: string;
  subject: string;
  htmlBody: string;
  targetMode: "all" | "paid" | "unpaid" | "news" | "custom";
  customEmails?: string[];
  extraEmails?: string[];
  attachments?: { filename: string; content: string; contentType?: string }[];
}): Promise<{ ok: boolean; sent?: number; total?: number; reason?: string; errors?: string[] }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({
      action: "admin_send_email",
      adminEmail: args.adminEmail,
      adminCode: args.adminCode,
      subject: args.subject,
      htmlBody: args.htmlBody,
      targetMode: args.targetMode,
      customEmails: args.customEmails ?? [],
      extraEmails: args.extraEmails ?? [],
      attachments: args.attachments ?? [],
    }),
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
