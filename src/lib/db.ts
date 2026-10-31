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
    whatsappEnabled: d.whatsappEnabled === true,
    membresCount: d.membresCount ?? 0,
    polls: d.polls ?? [],
    agItems: d.agItems ?? [],
    reunionReports: d.reunionReports ?? [],
    pollsOpen: d.pollsOpen === true,
    agOpen: d.agOpen === true,
    reportsOpen: d.reportsOpen === true,
    membreNoms: d.membreNoms ?? [],
    clubRules: d.clubRules ?? "",
    clubRulesPdfUrl: d.clubRulesPdfUrl ?? undefined,
    clubRulesPdfName: d.clubRulesPdfName ?? undefined,
    bureauMembers: d.bureauMembers ?? [],
    presidentName: d.presidentName ?? undefined,
    presentationMode: d.presentationMode === true,
    maintenanceMode: d.maintenanceMode === true,
    sectionsVisible: d.sectionsVisible ?? {},
    clubConfig: d.clubConfig ?? undefined,
    tshirtOpen: d.tshirtOpen === true,
    faqOpen: d.faqOpen === true,
    faqItems: Array.isArray(d.faqItems) ? d.faqItems : [],
    emailSignature: typeof d.emailSignature === "string" ? d.emailSignature : "",
    officialDocsOpen: d.officialDocsOpen === true,
    officialDocs: Array.isArray(d.officialDocs) ? d.officialDocs : [],
    smashUrl: typeof d.smashUrl === "string" && d.smashUrl ? d.smashUrl : undefined,
  };
}

// 📑 [ADMIN] Crée ou met à jour un document officiel
export async function adminOfficialDocSave(args: {
  adminEmail: string;
  adminCode: string;
  docId?: string;
  title: string;
  type: "rapport_financier" | "charte" | "rapport_moral" | "autre";
  content?: string;
  pdfUrl?: string;
  pdfPath?: string;
  pdfName?: string;
}): Promise<{ ok: boolean; docId?: string; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_official_doc_save", ...args }),
  });
  return res.json();
}

// 📑 [ADMIN] Supprime un document officiel
export async function adminOfficialDocDelete(adminEmail: string, adminCode: string, docId: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_official_doc_delete", adminEmail, adminCode, docId }),
  });
  return res.json();
}

// 📑 [ADMIN] Réordonne un document (déplace en haut ou en bas)
export async function adminOfficialDocReorder(adminEmail: string, adminCode: string, docId: string, direction: "up" | "down"): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_official_doc_reorder", adminEmail, adminCode, docId, direction }),
  });
  return res.json();
}

// 👕 Récupère ma commande t-shirt
export async function memberGetMyTshirtOrder(email: string, code: string, membreId: string): Promise<{ ok: boolean; order?: import("./types").TshirtOrder | null; open?: boolean; price?: number | null; sizes?: string[]; paymentUrl?: string | null; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "tshirt_my_order", email, code, membreId }),
  });
  return res.json();
}

// 👕 Soumet/met à jour ma commande t-shirt
export async function memberSubmitTshirtOrder(args: {
  email: string;
  code: string;
  membreId: string;
  nom: string;
  prenom: string;
  taille: string; // une des TSHIRT_SIZES_ALL
  nomFloque?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "tshirt_order", ...args }),
  });
  return res.json();
}

// 📝 [ADMIN] Liste les brouillons d'emails
export async function adminDraftsList(adminEmail: string, adminCode: string): Promise<{ ok: boolean; drafts?: import("./types").EmailDraft[]; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_drafts_list", adminEmail, adminCode }),
  });
  return res.json();
}

// 📝 [ADMIN] Crée ou met à jour un brouillon (draftId vide = création)
export async function adminDraftSave(args: {
  adminEmail: string;
  adminCode: string;
  draftId?: string;
  subject: string;
  body: string;
  targetMode: string;
  customMembreIds?: string[];
  extraEmails?: string[];
  variant?: string;
  scheduledAt?: string;
}): Promise<{ ok: boolean; draftId?: string; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_draft_save", ...args }),
  });
  return res.json();
}

// 📝 [ADMIN] Supprime un brouillon
export async function adminDraftDelete(adminEmail: string, adminCode: string, draftId: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_draft_delete", adminEmail, adminCode, draftId }),
  });
  return res.json();
}

// 🚪 Membre indique qu'il ne souhaite pas renouveler sa cotisation pour la saison
// (ou annule cette décision). Désactive les rappels J-30/15/5/1 de cotisation.
export async function memberToggleRenewalSkip(
  email: string,
  code: string,
  membreId: string,
  skip: boolean
): Promise<{ ok: boolean; renewalSkippedFor?: string | null; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "member_toggle_renewal_skip", email, code, membreId, skip }),
  });
  return res.json();
}

// 🔕 Membre marque un tournoi comme "pas intéressé(e)" (ou réactive les rappels)
// → utilisé pour ne plus recevoir les rappels J-30/15/5/1 pour ce tournoi
export async function memberToggleTournoiIgnored(
  email: string,
  code: string,
  membreId: string,
  tournoiId: string,
  ignored: boolean
): Promise<{ ok: boolean; tournoisIgnored?: string[]; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "member_toggle_tournoi_ignored", email, code, membreId, tournoiId, ignored }),
  });
  return res.json();
}

// ❓ Membre pose une nouvelle question pour la FAQ
export async function memberAskFaqQuestion(email: string, code: string, membreId: string, question: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "faq_ask_question", email, code, membreId, question }),
  });
  return res.json();
}

// ❓ [ADMIN] Lister les questions FAQ en attente de réponse
export async function adminFaqPendingList(adminEmail: string, adminCode: string): Promise<{ ok: boolean; pending?: import("./types").FaqPendingQuestion[]; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_faq_pending_list", adminEmail, adminCode }),
  });
  return res.json();
}

// ❓ [ADMIN] Répondre à une question en attente (la déplace dans la FAQ publique)
export async function adminFaqAnswer(adminEmail: string, adminCode: string, pendingId: string, answer: string, category?: string, notify: boolean = true): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_faq_answer", adminEmail, adminCode, pendingId, answer, category: category || "", notify }),
  });
  return res.json();
}

// ❓ [ADMIN] Rejeter / supprimer une question en attente sans publication
export async function adminFaqReject(adminEmail: string, adminCode: string, pendingId: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_faq_reject", adminEmail, adminCode, pendingId }),
  });
  return res.json();
}

// 👕 [ADMIN] Ouvre/ferme les commandes t-shirt et/ou change le prix (price: null = retirer le prix)
export async function adminSetTshirt(adminEmail: string, adminCode: string, changes: { open?: boolean; price?: number | null; notify?: boolean; sizes?: string[]; paymentUrl?: string | null }): Promise<{ ok: boolean; open?: boolean; price?: number | null; sizes?: string[]; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "admin_set_tshirt", adminEmail, adminCode, ...changes }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Erreur réseau" };
  }
}

// 📎 [ADMIN] Envoie un fichier (PDF/image) dans un bucket via le serveur
export async function adminUploadFile(args: { adminEmail: string; adminCode: string; file: File; bucket: string; pathPrefix?: string }): Promise<{ ok: boolean; path?: string; url?: string; reason?: string }> {
  try {
    const bytes = new Uint8Array(await args.file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({
        action: "upload_image",
        email: args.adminEmail,
        code: args.adminCode,
        fileData: btoa(binary),
        fileName: args.file.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
        contentType: args.file.type || "application/pdf",
        bucket: args.bucket,
        pathPrefix: args.pathPrefix,
      }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Erreur réseau (fichier trop gros ?)" };
  }
}

// 🎓 Envoi du justificatif de scolarité par l'adhérent (à l'inscription ou depuis son espace)
export async function publicUploadJustificatif(args: { email: string; code: string; membreId: string; file: File }): Promise<{ ok: boolean; reason?: string }> {
  try {
    const bytes = new Uint8Array(await args.file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({
        action: "upload_justificatif",
        email: args.email.toLowerCase().trim(),
        code: args.code,
        membreId: args.membreId,
        fileData: btoa(binary),
        fileName: args.file.name,
        contentType: args.file.type,
      }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Erreur réseau (fichier trop lourd ?)" };
  }
}

// 🧾 [ADMIN] Fichier privé (facture ou justificatif étudiant) : lien temporaire (op "url") ou suppression (op "delete")
export async function adminFactureFile(adminEmail: string, adminCode: string, op: "url" | "delete", path: string, bucket: "factures" | "justificatifs" = "factures"): Promise<{ ok: boolean; url?: string; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "admin_facture_file", adminEmail, adminCode, op, path, bucket }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Erreur réseau" };
  }
}

// 💳 [ADMIN] Marque une commande t-shirt payée / non payée
export async function adminTshirtPaid(adminEmail: string, adminCode: string, orderId: string, paid: boolean, notify = false): Promise<{ ok: boolean; mailEnvoye?: boolean; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "admin_tshirt_paid", adminEmail, adminCode, orderId, paid, notify }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Erreur réseau" };
  }
}

// 📨 [ADMIN] Relance par email les commandes non payées (toutes si orderIds absent)
export async function adminTshirtRelance(adminEmail: string, adminCode: string, orderIds?: string[]): Promise<{ ok: boolean; sent?: number; total?: number; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "admin_tshirt_relance", adminEmail, adminCode, orderIds }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Erreur réseau" };
  }
}

// 👕 [ADMIN] Supprime une commande t-shirt
export async function adminDeleteTshirtOrder(adminEmail: string, adminCode: string, orderId: string): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_delete_tshirt_order", orderId, adminEmail, adminCode }),
  });
  return res.json();
}

// ─── Analytics : ping léger pour compter une page vue (best-effort, sans bloquer) ───
export async function trackView(path: string, referrer: string): Promise<void> {
  try {
    await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "track_view", path, referrer }),
      keepalive: true,
    });
  } catch {
    // best-effort : on ne fait rien si ça échoue (analytics non critique)
  }
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
  sexe?: "F" | "H";
  grouped?: boolean; // true = inscription groupée, ne pas écraser les autres membres du même email
  website?: string; // honeypot anti-bot (doit rester vide)
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
// 🛡️ Trust token 2FA : émis par le serveur après un 2FA réussi, permet de
// skipper le 2FA pour ce compte pendant 14 jours (re-auth /admin → juste mdp).
// Stocké séparément par email pour gérer plusieurs comptes sur le même navigateur.
const TRUST_TOKEN_KEY = "saccb_tfa_trust";
export function getTrustToken(email: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem(TRUST_TOKEN_KEY);
    if (!raw) return "";
    const map = JSON.parse(raw) as Record<string, string>;
    return map[email.toLowerCase().trim()] || "";
  } catch { return ""; }
}
export function setTrustToken(email: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(TRUST_TOKEN_KEY);
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, string>;
    map[email.toLowerCase().trim()] = token;
    localStorage.setItem(TRUST_TOKEN_KEY, JSON.stringify(map));
  } catch {}
}
export function clearTrustToken(email?: string): void {
  if (typeof window === "undefined") return;
  if (!email) { localStorage.removeItem(TRUST_TOKEN_KEY); return; }
  try {
    const raw = localStorage.getItem(TRUST_TOKEN_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, string>;
    delete map[email.toLowerCase().trim()];
    localStorage.setItem(TRUST_TOKEN_KEY, JSON.stringify(map));
  } catch {}
}

export async function verifyMembre(
  email: string,
  code: string,
  code2fa?: string,
  resend2FA?: boolean
): Promise<{ ok: boolean; paid?: boolean; isAdmin?: boolean; codeJustReset?: boolean; requires2FA?: boolean; trustToken?: string; membre?: { id: string; nom: string; type: string; email: string; newsOptIn?: boolean }; reason?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const trustToken = getTrustToken(normalizedEmail);
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "verify_membre", email: normalizedEmail, code, code2fa: code2fa || "", resend2FA: resend2FA === true, trustToken }),
  });
  const result = await res.json();
  // Si le serveur renvoie un trust token (frais après 2FA), on le stocke
  if (result.ok && result.trustToken) {
    setTrustToken(normalizedEmail, result.trustToken);
  }
  return result;
}

// ─── Vérification session membre (existe encore en DB ? statut payé à jour ?) ───
export async function checkMemberSession(email: string, membreId: string, code?: string): Promise<{ valid: boolean; paid?: boolean; whatsappLink?: string; justificatifManquant?: boolean; justificatif?: { fourni: boolean; date?: string; nom?: string }; adherent?: { id?: string; nom: string; type: "Adulte" | "Etudiant"; montantPaye?: number; ok: boolean } }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "check_session", email: email.toLowerCase().trim(), membreId, code: code || undefined }),
    });
    const data = await res.json();
    return { valid: data.ok === true, paid: data.paid, whatsappLink: typeof data.whatsappLink === "string" ? data.whatsappLink : undefined, justificatifManquant: data.justificatifManquant === true, justificatif: data.justificatif, adherent: data.adherent };
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
  includeAG: boolean,
  includeReports: boolean = false
): Promise<{ ok: boolean; sent?: number; total?: number; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "notify_engagement_open", adminEmail, adminCode, includePolls, includeAG, includeReports }),
  });
  return res.json();
}

// ─── Envoyer un compte-rendu spécifique à tous les adhérents payés+news — AUTH ADMIN REQUISE ───
export async function adminSendReport(
  reportId: string,
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; sent?: number; total?: number; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "send_report_to_members", reportId, adminEmail, adminCode }),
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

// ─── Choisir un nouveau code via le lien « Code oublié ? » reçu par email ───
export async function publicResetCodeWithToken(email: string, token: string, newCode: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "reset_code_token", email: email.toLowerCase().trim(), token, newCode }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Erreur réseau." };
  }
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

// ─── Exporter la DB complète en JSON (sauvegarde) — AUTH ADMIN REQUISE ───
export async function adminExportBackup(
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; data?: Record<string, unknown>; exportedAt?: string; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_export_backup", adminEmail, adminCode }),
  });
  return res.json();
}

// ─── Restaurer la DB depuis un JSON de sauvegarde — AUTH ADMIN REQUISE ───
export async function adminImportBackup(
  backupData: Record<string, unknown>,
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; restoredAt?: string; stats?: { membres: number; tournois: number; actualites: number }; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({
      action: "admin_import_backup",
      backupData,
      confirmRestore: true,
      adminEmail,
      adminCode,
    }),
  });
  return res.json();
}

// ─── Boîte de réception partagée : marquer un message comme répondu / archiver / supprimer ───
export async function adminMarkMessageResponded(
  messageId: string,
  adminEmail: string,
  adminCode: string,
  unmark = false
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_mark_message_responded", messageId, adminEmail, adminCode, unmark }),
  });
  return res.json();
}

export async function adminArchiveMessage(
  messageId: string,
  adminEmail: string,
  adminCode: string,
  opts: { delete?: boolean; archived?: boolean } = { archived: true }
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_archive_message", messageId, adminEmail, adminCode, ...opts }),
  });
  return res.json();
}

// ─── Envoyer un rappel de paiement individuel à un adhérent — AUTH ADMIN REQUISE ───
export async function adminSendPaymentReminder(
  membreId: string,
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_send_payment_reminder", membreId, adminEmail, adminCode }),
  });
  return res.json();
}

// 💳 Envoi du mail "rappel virement" avec le RIB en PJ. Réservé aux adhérents
// non-payés ayant choisi paymentMethod="virement".
export async function adminSendVirementReminder(
  membreId: string,
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_send_virement_reminder", membreId, adminEmail, adminCode }),
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

// 🔓 Déblocage manuel d'un compte verrouillé après 5 échecs
export async function adminUnlockAccount(
  targetEmail: string,
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_unlock_account", targetEmail, adminEmail, adminCode }),
  });
  return res.json();
}

// 🔍 Liste des comptes actuellement bloqués
export async function adminListLockedAccounts(
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; locked?: { email: string; minutesLeft: number }[]; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "admin_list_locked_accounts", adminEmail, adminCode }),
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

// base = la base telle que l'admin l'a chargée → le serveur n'applique que la différence
export async function saveDBByMember(email: string, code: string, db: DB, base?: DB): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "admin_save", email: email.toLowerCase().trim(), code, data: db, base }),
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
export async function publicContact(name: string, email: string, message: string, hp: string = ""): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "contact", name, email, message, website: hp }),
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
export type EmailVariant = "urgent" | "annonce" | "bonne_nouvelle" | "info" | "default";

export async function adminSendEmail(args: {
  adminEmail: string;
  adminCode: string;
  subject: string;
  htmlBody: string;
  targetMode: "all" | "paid" | "unpaid" | "news" | "custom";
  customEmails?: string[];
  extraEmails?: string[];
  attachments?: { filename: string; content: string; contentType?: string }[];
  variant?: EmailVariant;
  draftId?: string; // si fourni, le brouillon sera supprimé après envoi réussi
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
      variant: args.variant ?? "default",
      draftId: args.draftId,
    }),
  });
  return res.json();
}

// ─── Envoyer une sauvegarde par email — AUTH ADMIN REQUISE ───
export async function adminSendBackupEmail(
  adminEmail: string,
  adminCode: string
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "send_backup_email", adminEmail, adminCode }),
  });
  return res.json();
}

// ─── Toggle mode présentation (code secret) ───
export async function togglePresentationMode(
  secret: string
): Promise<{ ok: boolean; presentationMode?: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "toggle_presentation", secret }),
  });
  return res.json();
}

// ─── Inscription tournoi avec covoiturage (via Edge Function) ───
export async function publicRegisterTournoiWithCovoiturage(
  tournoiId: string,
  p1: string,
  p2: string,
  email: string,
  code: string,
  covoiturage?: { seats: number; depart?: string; contact?: string } | null
): Promise<{ ok: boolean; reason?: string }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    body: JSON.stringify({ action: "register_tournoi", tournoiId, p1, p2, email: email.toLowerCase().trim(), code, covoiturage: covoiturage || undefined }),
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

// ─── 🏆 Tournoi inter-clubs : page d'inscription d'un club (lien unique) ───
export type InterclubPage = {
  ok: boolean;
  reason?: string;
  needCode?: boolean; // le club doit saisir son code d'accès
  ouvert?: boolean;
  tournoi?: {
    name: string; date: string; type: string; niveaux: string[]; dateLimit: string; deroulement: string;
    salleNom: string; salleAdresse: string; sallePhotoUrl: string;
    programme?: import("./types").PhaseProgramme[];
  };
  club?: { id?: string; nom: string; quota: number; binomes: { id: string; joueur1: string; joueur2: string; niveau: string }[]; updatedAt: string };
  autres?: { nom: string; equipes: number }[];
  live?: LiveVue;
};

export async function interclubCall(
  token: string,
  code: string,
  binomes?: { id?: string; joueur1: string; joueur2: string; niveau: string }[]
): Promise<InterclubPage> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify(binomes ? { action: "interclub_save", token, code, binomes } : { action: "interclub_get", token, code }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Connexion impossible. Vérifiez votre réseau et réessayez." };
  }
}

// ─── 🏁 Jour J : vue « en direct » d'un tournoi inter-clubs ───
export type LiveVue = {
  phases: import("./types").LivePhase[];
  termine: boolean;
  equipes: Record<string, { joueur1: string; joueur2: string; niveau: string; club: string; mine: boolean }>;
  clubs: Record<string, string>; // id du club → nom (pour « saisi par »)
};

/** Saisie d'un score par un club (lien + code du club) */
export async function interclubScore(token: string, code: string, matchId: string, sa: number[], sb: number[]): Promise<InterclubPage> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "interclub_score", token, code, matchId, sa, sb }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Connexion impossible. Vérifiez votre réseau et réessayez." };
  }
}

/** Écran géant (lecture seule) */
export async function interclubLive(liveToken: string): Promise<{ ok: boolean; reason?: string; tournoi?: { name: string; date: string; type: string; salleNom: string }; live?: LiveVue }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "interclub_live", liveToken }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Connexion impossible." };
  }
}

/** ❓ Contester la correction de l'adversaire : la table de marque vient au terrain */
export async function interclubContester(token: string, code: string, matchId: string): Promise<InterclubPage> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "interclub_score", token, code, matchId, contester: true }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Connexion impossible. Vérifiez votre réseau et réessayez." };
  }
}

/** Effacer un score saisi par erreur (seulement par le club qui l'a entré, avant validation) */
export async function interclubEffacerScore(token: string, code: string, matchId: string): Promise<InterclubPage> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "interclub_score", token, code, matchId, effacer: true }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Connexion impossible. Vérifiez votre réseau et réessayez." };
  }
}

// ─── 🏠 Tournois internes (entre adhérents) : vue, inscription, retrait, scores ───
export type TournoiInterneVue = {
  id: string; name: string; date: string; type: string; niveaux: string[]; dateLimit: string;
  deroulement: string; salleNom: string; salleAdresse: string;
  programme: import("./types").PhaseProgramme[];
  ouvert: boolean; quota: number; nbBinomes: number;
  inscrits?: { joueur1: string; joueur2: string; niveau: string }[];
  monBinome: { id: string; joueur1: string; joueur2: string; niveau: string } | null;
  live?: LiveVue;
};
export type MembreInterneReponse = {
  ok: boolean; reason?: string; needCode?: boolean;
  membreId?: string;
  adherents?: { id: string; nom: string }[];
  tournois?: TournoiInterneVue[];
};

export async function membreInterne(
  action: "membre_interne" | "membre_interne_inscription" | "membre_interne_retrait" | "membre_interne_score",
  email: string,
  code: string,
  extra: Record<string, unknown> = {}
): Promise<MembreInterneReponse> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action, email: email.toLowerCase().trim(), code, ...extra }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Connexion impossible. Vérifiez votre réseau et réessayez." };
  }
}

/** 📣 Prévenir les adhérents par mail qu'un tournoi interne est ouvert (admin) */
export async function adminInterneNotifier(email: string, code: string, tournoiId: string): Promise<{ ok: boolean; sent?: number; reason?: string }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
      body: JSON.stringify({ action: "admin_interne_notifier", email, code, tournoiId }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "Connexion impossible." };
  }
}
