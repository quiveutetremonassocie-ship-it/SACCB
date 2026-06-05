import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate limiting général (par IP, reset au redéploiement)
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 10; // max 10 requêtes
const RATE_WINDOW = 60_000; // par minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Rate limiting spécifique formulaire de contact (max 3 par heure par IP)
const contactLimitMap = new Map<string, { count: number; reset: number }>();

function isContactRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = contactLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    contactLimitMap.set(ip, { count: 1, reset: now + 3_600_000 }); // 1 heure
    return false;
  }
  entry.count++;
  return entry.count > 3; // max 3 messages par heure
}

// Rate limiting spécifique forgot_code (max 5 par heure par IP) - empêche l'énumération d'emails
const forgotLimitMap = new Map<string, { count: number; reset: number }>();

function isForgotRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = forgotLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    forgotLimitMap.set(ip, { count: 1, reset: now + 3_600_000 }); // 1 heure
    return false;
  }
  entry.count++;
  return entry.count > 5;
}

// Rate limiting login (max 10 tentatives par 15 min par IP) - protection brute force
const loginLimitMap = new Map<string, { count: number; reset: number }>();

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    loginLimitMap.set(ip, { count: 1, reset: now + 900_000 }); // 15 min
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

// 🔒 Verrouillage par compte (email) : 5 échecs en 15 min → bloqué 30 min
// (complémentaire au rate-limit par IP : protège même si l'attaquant change d'IP)
const accountLockMap = new Map<string, { fails: number; lockUntil: number; firstFail: number }>();

function isAccountLocked(email: string): { locked: boolean; minutesLeft?: number } {
  const e = accountLockMap.get(email);
  if (!e) return { locked: false };
  const now = Date.now();
  if (e.lockUntil > now) {
    return { locked: true, minutesLeft: Math.ceil((e.lockUntil - now) / 60_000) };
  }
  return { locked: false };
}

function recordLoginFailure(email: string): void {
  const now = Date.now();
  const e = accountLockMap.get(email);
  if (!e || now - e.firstFail > 900_000) {
    // reset la fenêtre toutes les 15 min
    accountLockMap.set(email, { fails: 1, lockUntil: 0, firstFail: now });
    return;
  }
  e.fails++;
  if (e.fails >= 5) {
    e.lockUntil = now + 1_800_000; // bloqué 30 min
  }
}

function clearLoginFailures(email: string): void {
  accountLockMap.delete(email);
}

// 🔑 2FA admin par email : stocké en DB (les Edge Functions sont stateless,
// une map en mémoire ne survit pas entre 2 invocations)
type TwoFAEntry = { email: string; codeHash: string; expires: number };
// 🛡️ Token de confiance émis après un 2FA réussi : permet au client (même
// navigateur) de skipper le 2FA pendant 14 jours. Stocké server-side pour
// éviter qu'un attaquant ne forge un token.
type TfaTrust = { email: string; token: string; expires: number };
function getTrustList(d: Record<string, unknown>): TfaTrust[] {
  const now = Date.now();
  return ((d.tfaTrusted || []) as TfaTrust[]).filter((t) => t && t.expires > now);
}
function isTrustTokenValid(d: Record<string, unknown>, email: string, token: string): boolean {
  if (!token) return false;
  return getTrustList(d).some((t) => t.email === email && t.token === token);
}
async function issueTrustToken(d: Record<string, unknown>, email: string): Promise<string> {
  const token = crypto.randomUUID();
  const list = getTrustList(d).filter((t) => t.email !== email); // 1 token actif par email
  list.push({ email, token, expires: Date.now() + 14 * 24 * 60 * 60 * 1000 });
  d.tfaTrusted = list;
  return token;
}
function generate2FACode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function get2FAList(currentData: Record<string, unknown>): TwoFAEntry[] {
  const list = (currentData.twoFAPending || []) as TwoFAEntry[];
  // Purge automatique des entrées expirées
  const now = Date.now();
  return list.filter((e) => e && e.expires > now);
}
function set2FAEntry(currentData: Record<string, unknown>, email: string, codeHash: string): void {
  const list = get2FAList(currentData).filter((e) => e.email !== email);
  list.push({ email, codeHash, expires: Date.now() + 10 * 60_000 });
  currentData.twoFAPending = list;
}
function find2FAEntry(currentData: Record<string, unknown>, email: string): TwoFAEntry | undefined {
  return get2FAList(currentData).find((e) => e.email === email);
}
function delete2FAEntry(currentData: Record<string, unknown>, email: string): void {
  currentData.twoFAPending = get2FAList(currentData).filter((e) => e.email !== email);
}

// Rate limiting inscription adhérent + inscription tournoi (max 5/heure par IP)
// Protège contre les bots qui spammeraient des inscriptions automatiques
const registrationLimitMap = new Map<string, { count: number; reset: number }>();

function isRegistrationRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = registrationLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    registrationLimitMap.set(ip, { count: 1, reset: now + 3_600_000 }); // 1 heure
    return false;
  }
  entry.count++;
  return entry.count > 5;
}

function sanitize(str: string): string {
  return str
    .replace(/[<>]/g, "") // pas de balises HTML
    .trim()
    .slice(0, 200); // limite la longueur
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidPhone(tel: string): boolean {
  const cleaned = tel.replace(/[\s.\-()]/g, "");
  return /^\+?\d{8,15}$/.test(cleaned);
}

// 🔒 Hash des codes : SHA-256 + salt aléatoire
// Format stocké : "h$<salt32>$<hash64>"
// Migration douce : si le code stocké n'est pas hashé, on le compare en clair (pour rétrocompat)
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashCode(plain: string): Promise<string> {
  const salt = crypto.randomUUID().replace(/-/g, "");
  const hash = await sha256Hex(salt + plain);
  return `h$${salt}$${hash}`;
}

async function verifyCode(stored: string | undefined | null, input: string): Promise<boolean> {
  if (!stored || !input) return false;
  if (stored.startsWith("h$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    const computed = await sha256Hex(salt + input);
    // Comparaison constante en temps (réduit le risque de timing attacks)
    if (computed.length !== hash.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return diff === 0;
  }
  // Ancien format en clair (pour rétrocompat — sera migré au prochain login)
  return stored === input;
}

function isHashedCode(stored: string | undefined | null): boolean {
  return typeof stored === "string" && stored.startsWith("h$");
}

// Sleep helper — utilisé pour throttler les appels API email (Brevo 10/sec, Resend 2/sec)
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const EMAIL_THROTTLE_MS = 600; // ~1.6 req/sec, safe sous la limite free tier de 2/sec

// Extrait le prénom du nom complet (premier mot, capitalisé)
function extractFirstName(fullName: string): string {
  const cleaned = (fullName || "").trim();
  if (!cleaned) return "";
  const first = cleaned.split(/\s+/)[0] || "";
  // Capitaliser proprement (Marie au lieu de MARIE ou marie)
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// Échappe le HTML pour éviter les injections quand on insère un nom utilisateur
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Parse une date dans plusieurs formats : ISO YYYY-MM-DD, DD/MM/YYYY, ou texte libre français ("31 mai 2026")
// Retourne null si non parsable.
function parseFlexibleDate(input: string): Date | null {
  if (!input) return null;
  const s = input.trim();
  // Format ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // Format DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    const d = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
    return isNaN(d.getTime()) ? null : d;
  }
  // Texte libre français : "31 mai 2026", "1er juin 2026", "12 janvier 2027 (8h30)"
  const monthMap: Record<string, number> = {
    janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
  };
  const m = s.toLowerCase().match(/(\d{1,2})(?:er|e|ème)?\s+([a-zéû]+)\s+(\d{4})/i);
  if (m) {
    const day = parseInt(m[1]);
    const month = monthMap[m[2]];
    const year = parseInt(m[3]);
    if (month) {
      const d = new Date(year, month - 1, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  // Dernier recours : essayer le parser natif
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}


// ============================================================
// Helpers d'envoi d'email avec fallback Brevo → Resend.
// Brevo est le provider principal (300 mails/jour gratuits).
// Resend est utilisé en secours si Brevo échoue (quota, panne, etc.)
// Accepte un payload "style Resend" et convertit selon le provider.
// Retourne la Response fetch du provider qui a réussi.
// ============================================================

type EmailPayload = {
  from: string;
  to: string | string[];
  bcc?: string[];
  reply_to?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: Array<{ filename: string; content: string }>;
};

// Conditions de fallback : on retente sur Resend si Brevo répond avec une erreur
// "non liée à ton payload" (quota, rate limit, panne serveur, network error).
// On ne retente PAS sur 400 (payload invalide) ni 401/403 (clé invalide).
function shouldFallback(status: number): boolean {
  return status === 402 || status === 429 || (status >= 500 && status < 600);
}

async function callBrevo(brevoKey: string, payload: EmailPayload): Promise<Response> {
  const fromStr = String(payload.from || "");
  const fromMatch = fromStr.match(/^(.+?)\s*<(.+)>$/);
  const sender = fromMatch
    ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
    : { email: fromStr };

  const toArr = Array.isArray(payload.to) ? payload.to : [payload.to];
  const body: Record<string, unknown> = {
    sender,
    to: toArr.filter(Boolean).map((e) => ({ email: e })),
    subject: payload.subject,
  };
  if (payload.html) body.htmlContent = payload.html;
  if (payload.text) body.textContent = payload.text;
  if (payload.bcc && payload.bcc.length) body.bcc = payload.bcc.map((e) => ({ email: e }));
  if (payload.reply_to) {
    const r = Array.isArray(payload.reply_to) ? payload.reply_to[0] : payload.reply_to;
    if (r) body.replyTo = { email: r };
  }
  if (payload.headers && Object.keys(payload.headers).length) body.headers = payload.headers;
  if (payload.attachments && payload.attachments.length) {
    body.attachment = payload.attachments.map((a) => ({ name: a.filename, content: a.content }));
  }

  return fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoKey,
      "Content-Type": "application/json",
      "accept": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function callResend(resendKey: string, payload: EmailPayload): Promise<Response> {
  const body: Record<string, unknown> = {
    from: payload.from,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
  };
  if (payload.html) body.html = payload.html;
  if (payload.text) body.text = payload.text;
  if (payload.bcc && payload.bcc.length) body.bcc = payload.bcc;
  if (payload.reply_to) body.reply_to = payload.reply_to;
  if (payload.headers && Object.keys(payload.headers).length) body.headers = payload.headers;
  if (payload.attachments && payload.attachments.length) {
    body.attachments = payload.attachments;
  }

  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function sendBrevo(brevoKey: string, payload: EmailPayload): Promise<Response> {
  // Essai Brevo
  try {
    const res = await callBrevo(brevoKey, payload);
    if (res.ok) return res;
    // Brevo a répondu mais avec une erreur — fallback uniquement sur certaines erreurs
    if (!shouldFallback(res.status)) return res;
    console.warn(`[email] Brevo ${res.status} → fallback Resend`);
  } catch (err) {
    console.warn(`[email] Brevo network error → fallback Resend:`, err);
  }
  // Fallback Resend si la clé est configurée, sinon on retourne une erreur Brevo factice
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: "Brevo failed and RESEND_API_KEY not configured for fallback" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
  try {
    return await callResend(resendKey, payload);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Both Brevo and Resend failed", details: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

// 📝 Helper de logging d'email dans emailHistory.
// Centralise tout : appelé après chaque envoi (sendBrevo) pour qu'aucun mail
// n'échappe à l'historique. Gère un append + trim à 200 entrées + écriture DB.
async function logEmailToHistory(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  entry: {
    type: string;
    subject: string;
    body?: string;
    recipients: string[];
    sentBy?: string;
    targetMode?: string;
    status?: "sent" | "partial" | "failed";
    sentCount?: number;
    attachmentNames?: string[];
  },
): Promise<void> {
  try {
    // Lecture rapide du emailHistory existant
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return;
    const d = data.data as Record<string, unknown>;
    const history = (d.emailHistory || []) as Record<string, unknown>[];
    history.push({
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 7),
      date: new Date().toISOString(),
      type: entry.type,
      subject: entry.subject.slice(0, 200),
      body: (entry.body || "").slice(0, 2000),
      recipientCount: entry.recipients.length,
      recipientsPreview: entry.recipients.slice(0, 3),
      targetMode: entry.targetMode || entry.type,
      sentBy: entry.sentBy || "system",
      status: entry.status || "sent",
      sentCount: entry.sentCount ?? entry.recipients.length,
      totalCount: entry.recipients.length,
      attachmentNames: entry.attachmentNames,
    });
    // Conserver les 200 dernières entrées (anti-explosion DB)
    d.emailHistory = history.slice(-200);
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
  } catch (e) {
    console.warn("[logEmailToHistory] échec :", e);
  }
}

// Helper async pour find par credentials (membres)
async function findMembreByCredentials(
  membres: Record<string, unknown>[],
  email: string,
  code: string
): Promise<Record<string, unknown> | undefined> {
  const lowerEmail = email.toLowerCase();
  for (const m of membres) {
    if (String(m.email || "").toLowerCase() !== lowerEmail) continue;
    if (await verifyCode(String(m.code || ""), code)) return m;
  }
  return undefined;
}

// Helper async pour find par credentials (admin credentials)
async function findAdminCredByCredentials(
  creds: { email: string; code: string; readOnly?: boolean; permissions?: string[] }[],
  email: string,
  code: string
): Promise<{ email: string; code: string; readOnly?: boolean; permissions?: string[] } | undefined> {
  const lowerEmail = email.toLowerCase();
  for (const c of creds) {
    if (String(c.email || "").toLowerCase() !== lowerEmail) continue;
    if (await verifyCode(c.code, code)) return c;
  }
  return undefined;
}

// Migration douce : si le code stocké est en clair, on le hash et on update la DB
async function migrateCodeIfNeeded(
  supabaseAdmin: ReturnType<typeof createClient>,
  d: Record<string, unknown>,
  target: { type: "membre"; id: string; plainCode: string } | { type: "adminCred"; email: string; plainCode: string }
): Promise<void> {
  try {
    const hashed = await hashCode(target.plainCode);
    if (target.type === "membre") {
      const membres = (d.membres || []) as Record<string, unknown>[];
      const m = membres.find((x) => x.id === target.id);
      if (m && !isHashedCode(String(m.code || ""))) {
        m.code = hashed;
        d.membres = membres;
        await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
      }
    } else {
      const creds = (d.adminCredentials || []) as { email: string; code: string }[];
      const c = creds.find((x) => String(x.email || "").toLowerCase() === target.email.toLowerCase());
      if (c && !isHashedCode(c.code)) {
        c.code = hashed;
        d.adminCredentials = creds;
        await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
      }
    }
  } catch (e) {
    console.warn("[migrateCodeIfNeeded] Failed:", e);
  }
}

// Helper : normalise adminEmails (ancien format string[] ou nouveau format {email,readOnly,permissions}[])
function parseAdminEmails(arr: unknown[]): { email: string; readOnly: boolean; permissions?: string[] }[] {
  return arr.map((e) =>
    typeof e === "string"
      ? { email: e.toLowerCase(), readOnly: false, permissions: undefined }
      : {
          email: String((e as { email: string }).email || "").toLowerCase(),
          readOnly: (e as { readOnly?: boolean }).readOnly === true,
          permissions: (e as { permissions?: string[] }).permissions,
        }
  );
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Helper : vérifie que email+code correspond à un admin valide (admin credentials OU membre admin)
// Retourne null si OK, sinon une Response d'erreur à retourner immédiatement
async function checkAdminAuth(
  body: Record<string, unknown>,
  d: Record<string, unknown>
): Promise<Response | null> {
  const email = String(body.adminEmail || body.email || "").toLowerCase().trim();
  const code = String(body.adminCode || body.code || "").trim();
  if (!email || !code) return json({ ok: false, reason: "Authentification admin requise." }, 401);

  const membres = (d.membres || []) as Record<string, unknown>[];
  const adminEmailEntries = parseAdminEmails((d.adminEmails as unknown[]) || []);
  const adminEmails = adminEmailEntries.map((e) => e.email);
  const adminCredentials = (d.adminCredentials || []) as { email: string; code: string }[];

  const validAdminCred = await findAdminCredByCredentials(adminCredentials, email, code);
  const validMembre = await findMembreByCredentials(membres, email, code);

  if (!validAdminCred && !validMembre) {
    return json({ ok: false, reason: "Identifiants invalides." }, 401);
  }
  if (!adminEmails.includes(email) && !validAdminCred) {
    return json({ ok: false, reason: "Accès non autorisé." }, 403);
  }
  return null;
}

Deno.serve(async (req) => {
  // Pré-vol CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  if (isRateLimited(ip)) {
    return json({ error: "Trop de requêtes, réessayez dans une minute." }, 429);
  }

  // Client Supabase avec service_role (jamais exposé au frontend)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // ─── WEBHOOK HELLOASSO (notification automatique de paiement) ───
  // HelloAsso envoie un payload avec eventType, pas de champ "action"
  if (body.eventType === "Payment" || body.eventType === "Order") {
    // 🔒 SÉCURITÉ : exiger un secret partagé en query param ou header
    // Configurer côté HelloAsso : URL = https://....functions/v1/public-api?secret=XXX
    // Et côté Supabase : variable d'env HELLOASSO_WEBHOOK_SECRET = XXX
    const expectedSecret = Deno.env.get("HELLOASSO_WEBHOOK_SECRET");
    if (!expectedSecret) {
      console.error("[HelloAsso webhook] HELLOASSO_WEBHOOK_SECRET non configuré — webhook refusé");
      return json({ ok: false, reason: "Webhook non configuré." }, 503);
    }
    const url = new URL(req.url);
    const providedSecret =
      url.searchParams.get("secret") ||
      req.headers.get("x-helloasso-secret") ||
      "";
    if (providedSecret !== expectedSecret) {
      console.warn("[HelloAsso webhook] Secret invalide depuis IP", ip);
      return json({ ok: false, reason: "Non autorisé." }, 401);
    }

    // Extraire l'email du payeur
    const paymentData = body.data as Record<string, unknown> | undefined;
    const payer = paymentData?.payer as Record<string, unknown> | undefined;
    const payerEmail = String(payer?.email || "").toLowerCase().trim();

    if (!payerEmail) {
      return json({ ok: false, reason: "No payer email" }, 400);
    }

    // Pour les paiements, vérifier que le statut est "Authorized"
    if (body.eventType === "Payment") {
      const state = paymentData?.state as string;
      if (state !== "Authorized") {
        // Ignorer les remboursements, échecs, etc.
        return json({ ok: true, ignored: true });
      }
    }

    // Lire la BDD
    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];

    // Chercher le membre par email
    let found = false;
    for (const m of membres) {
      if (String(m.email || "").toLowerCase() === payerEmail && !m.ok) {
        m.ok = true;
        m.paymentDate = new Date().toISOString();
        m.paymentMethod = "online";
        found = true;
        // Pas de break : on marque TOUS les membres avec cet email (inscriptions groupées)
      }
    }

    if (found) {
      currentData.membres = membres;
      await supabaseAdmin
        .from("saccb_db")
        .update({ data: currentData })
        .eq("id", 1);

      // Email de confirmation (fire and forget)
      const paidMembre = membres.find((m) => String(m.email || "").toLowerCase() === payerEmail);
      const brevoKey = Deno.env.get("BREVO_API_KEY");
      if (brevoKey && paidMembre) {
        const prixMap: Record<string, number> = { Adulte: 50, Etudiant: 30 };
        const prix = prixMap[String(paidMembre.type)] ?? 50;
        const membreCode = String(paidMembre.code || "");
        await sendBrevo(brevoKey, {
            from: "SACCB <contact@saccb.fr>",
            headers: {
              "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            to: [String(paidMembre.email)],
            subject: "🏸 Paiement confirmé — Bienvenue au SACCB !",
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
                  <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
                  <div>
                    <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                    <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
                  </div>
                </div>
                <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                  <h2 style="color: #16a34a; margin-top: 0;">✅ Paiement confirmé !</h2>
                  <p style="color: #475569;">Bonjour <strong>${paidMembre.nom}</strong>,</p>
                  <p style="color: #475569;">Votre paiement a bien été reçu. Votre adhésion au SACCB pour la saison ${currentData.y1}–${currentData.y2} est désormais <strong>validée</strong>.</p>
                  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">RÉCAPITULATIF</p>
                    <p style="margin: 4px 0; color: #1e293b;"><strong>Nom :</strong> ${paidMembre.nom}</p>
                    <p style="margin: 4px 0; color: #1e293b;"><strong>Type :</strong> ${paidMembre.type}</p>
                    <p style="margin: 4px 0; color: #1e293b;"><strong>Montant réglé :</strong> ${prix}€</p>
                  </div>
                  <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 0 0 6px; color: #92400e; font-size: 13px; font-weight: bold;">🔑 Connexion à votre espace membre</p>
                    <p style="margin: 0; color: #92400e; font-size: 13px;">Utilisez le code personnel que vous avez choisi à l'inscription pour vous connecter sur saccb.fr. Si vous l'avez oublié, cliquez sur « Code oublié ? » sur la page de connexion.</p>
                  </div>

                  <!-- ✨ Bloc "Tout ce que vous pouvez faire sur le site" -->
                  <div style="background: linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h3 style="margin: 0 0 14px; color: #1e3a5f; font-size: 16px;">✨ Ce que vous pouvez faire sur le site</h3>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 13px; color: #334155;">
                      <tr><td style="padding: 6px 0; vertical-align: top; width: 30px;">🏸</td><td style="padding: 6px 0;"><strong>Vous inscrire aux tournois</strong> en quelques clics avec votre binôme</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">📊</td><td style="padding: 6px 0;"><strong>Voir vos statistiques perso</strong> : participations, podiums, équipiers</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">🏆</td><td style="padding: 6px 0;"><strong>Consulter le classement des binômes</strong> et l'historique des tournois passés</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">📅</td><td style="padding: 6px 0;"><strong>Ajouter les tournois</strong> à votre agenda (Google Calendar, iPhone, Outlook)</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">📋</td><td style="padding: 6px 0;"><strong>Lire les comptes-rendus</strong> des réunions et AG (saison actuelle + années précédentes)</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">📊</td><td style="padding: 6px 0;"><strong>Voter aux sondages</strong> du bureau et participer aux décisions de l'association</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">💡</td><td style="padding: 6px 0;"><strong>Proposer vos questions et idées</strong> pour préparer la prochaine assemblée générale</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">📝</td><td style="padding: 6px 0;"><strong>Générer votre procuration AG</strong> en 1 clic si vous ne pouvez pas être présent(e)</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">🔑</td><td style="padding: 6px 0;"><strong>Modifier votre code personnel</strong> à tout moment</td></tr>
                      <tr><td style="padding: 6px 0; vertical-align: top;">📱</td><td style="padding: 6px 0;"><strong>Installer le site comme une app</strong> sur votre téléphone — voir le bloc ci-dessous 👇</td></tr>
                    </table>
                  </div>

                  <!-- 📱 Installer l'app sur téléphone -->
                  <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h3 style="margin: 0 0 12px; color: #6b21a8; font-size: 16px;">📱 Installer SACCB sur votre téléphone</h3>
                    <p style="margin: 0 0 14px; color: #475569; font-size: 13px;">Comme une vraie app : icône sur l'écran d'accueil, ouverture en plein écran, et toujours à jour automatiquement.</p>

                    <!-- iPhone -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 10px;">
                      <p style="margin: 0 0 8px; color: #1e3a5f; font-size: 14px; font-weight: bold;">🍎 iPhone (Safari)</p>
                      <ol style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.7;">
                        <li>Ouvrez <strong>saccb.fr</strong> dans <strong>Safari</strong> (pas Chrome)</li>
                        <li>Appuyez sur le bouton <strong>Partager</strong> (carré avec flèche ↑) en bas de l'écran</li>
                        <li>Faites défiler et touchez <strong>"Sur l'écran d'accueil"</strong></li>
                        <li>Touchez <strong>"Ajouter"</strong> en haut à droite ✅</li>
                      </ol>
                    </div>

                    <!-- Android -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
                      <p style="margin: 0 0 8px; color: #1e3a5f; font-size: 14px; font-weight: bold;">🤖 Android (Chrome)</p>
                      <ol style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.7;">
                        <li>Ouvrez <strong>saccb.fr</strong> dans <strong>Chrome</strong></li>
                        <li>Appuyez sur le menu <strong>⋮</strong> (3 points) en haut à droite</li>
                        <li>Touchez <strong>"Installer l'application"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong></li>
                        <li>Confirmez ✅</li>
                      </ol>
                    </div>
                  </div>

                  ${currentData.whatsappLink ? `
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 16px;">
                    <p style="margin: 0 0 10px; color: #166534; font-size: 14px;">📱 Rejoignez aussi le groupe WhatsApp de l'association :</p>
                    <a href="${currentData.whatsappLink}" style="display: inline-flex; align-items: center; gap: 8px; background: #25D366; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                      💬 Rejoindre le groupe WhatsApp
                    </a>
                  </div>
                  ` : ""}

                  <div style="text-align: center; margin: 24px 0 16px;">
                    <a href="https://saccb.fr/?member=1" style="display: inline-block; background: #1e3a5f; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                      🚀 Accéder à mon espace membre →
                    </a>
                  </div>
                  <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; width: 100%;">
                    <tr><td>
                      <p style="margin: 0; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains !</p>
                      <p style="margin: 4px 0 14px; color: #64748b; font-size: 13px;">Le bureau vous souhaite une excellente journée 🏸</p>
                      <p style="margin: 0 0 2px; color: #1e293b; font-size: 13px; font-weight: 600;">Hernan Camara <span style="color: #64748b; font-weight: 400;">· Président</span></p>
                      <p style="margin: 0 0 14px; color: #64748b; font-size: 12px; font-style: italic;">&amp; toute l'équipe du SACCB</p>
                      <table cellpadding="0" cellspacing="0" border="0"><tr>
                        <td style="vertical-align: middle; padding-right: 12px;"><img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" /></td>
                        <td style="vertical-align: middle;">
                          <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                          <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                          <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> &middot; <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                        </td>
                      </tr></table>
                    </td></tr>
                  </table>
                </div>
              </div>
            `,
          }).catch(() => {});
      }

      // Sync Google Sheets
      const sheetsWebhook = Deno.env.get("SHEETS_WEBHOOK");
      if (sheetsWebhook) {
        fetch(sheetsWebhook, {
          method: "POST",
          body: JSON.stringify(currentData),
        }).catch(() => {});
      }
    }

    // Toujours retourner 200 pour que HelloAsso ne re-tente pas
    return json({ ok: true, matched: found });
  }

  const action = body.action as string;

  // ─── ACTION: Track view (analytics ultra-léger, sans cookie, anonyme) ───
  if (action === "track_view") {
    const rawPath = String(body.path || "/").slice(0, 100);
    const path = rawPath.split("?")[0].split("#")[0] || "/";
    const refRaw = String(body.referrer || "").slice(0, 200);
    const ua = String(req.headers.get("user-agent") || "").toLowerCase();
    const device = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : /tablet/i.test(ua) ? "tablet" : "desktop";
    let ref = "direct";
    if (refRaw && refRaw !== "null") {
      try {
        const u = new URL(refRaw);
        ref = u.hostname.replace(/^www\./, "");
        if (ref.includes("saccb.fr")) ref = "interne";
      } catch { ref = "direct"; }
    }
    const today = new Date().toISOString().slice(0, 10);
    try {
      const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
      if (!data) return json({ ok: true });
      const d = data.data as Record<string, unknown>;
      const list = ((d.analyticsDaily || []) as Record<string, unknown>[]);
      let entry = list.find((e) => e.date === today) as undefined | {
        date: string; views: number; paths: Record<string, number>; refs: Record<string, number>; devices: Record<string, number>;
      };
      if (!entry) {
        entry = { date: today, views: 0, paths: {}, refs: {}, devices: {} };
        list.push(entry);
      }
      entry.views = (entry.views || 0) + 1;
      entry.paths = entry.paths || {};
      entry.paths[path] = (entry.paths[path] || 0) + 1;
      entry.refs = entry.refs || {};
      entry.refs[ref] = (entry.refs[ref] || 0) + 1;
      entry.devices = entry.devices || {};
      entry.devices[device] = (entry.devices[device] || 0) + 1;
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      d.analyticsDaily = list.filter((e) => String(e.date) >= cutoffStr);
      await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    } catch (_e) {}
    return json({ ok: true });
  }

  // ─── ACTION: Récupérer les données publiques ───
  if (action === "fetch_public") {
    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ error: "DB error" }, 500);

    const d = data.data as Record<string, unknown>;

    // On ne renvoie JAMAIS les données sensibles (emails, tels, factures)
    // 🔒 Pour les sondages : on retire les votes individuels (juste les compteurs côté client)
    // 🔒 Pour les questions AG : on retire les noms si anonyme
    const polls = ((d.polls as Record<string, unknown>[] | undefined) ?? []).map((p) => ({
      ...p,
      // Renvoyer juste l'agrégat des votes (compteurs par option) — pas les membreId
      voteCounts: ((p.votes as { optionIdx: number }[]) ?? []).reduce((acc: Record<number, number>, v) => {
        acc[v.optionIdx] = (acc[v.optionIdx] || 0) + 1;
        return acc;
      }, {}),
      totalVotes: ((p.votes as unknown[]) ?? []).length,
      votes: undefined, // ne pas exposer les votes individuels
    }));
    const agItems = ((d.agItems as Record<string, unknown>[] | undefined) ?? []).map((q) => ({
      ...q,
      authorMembreId: q.anonymous ? null : q.authorMembreId,
      authorNom: q.anonymous ? null : q.authorNom,
    }));

    return json({
      insc_open: d.insc_open ?? true,
      y1: d.y1 ?? 2024,
      y2: d.y2 ?? 2025,
      quota: d.quota ?? 65,
      config_tournois: d.config_tournois ?? [],
      inscrits_tournoi: d.inscrits_tournoi ?? [],
      actualites: ((d.actualites as Record<string,unknown>[] | undefined) ?? []).filter((a: Record<string,unknown>) => !a.private),
      archives: d.archives ?? [],
      whatsappLink: d.whatsappLink ?? null,
      membresCount: ((d.membres as unknown[]) || []).length,
      // Liste des noms des adhérents PAYÉS (pour autocomplétion inscription tournoi)
      // On expose juste le nom (pas email ni tél), car c'est déjà visible dans les inscriptions tournois
      membreNoms: ((d.membres as Record<string, unknown>[]) || [])
        .filter((m) => m.ok === true)
        .map((m) => String(m.nom || ""))
        .filter(Boolean)
        .sort(),
      polls,
      agItems,
      reunionReports: d.reunionReports ?? [],
      // Migration douce : si engagementOpen=true (ancien format), équivaut aux 2 toggles
      pollsOpen: d.pollsOpen === true || d.engagementOpen === true,
      agOpen: d.agOpen === true || d.engagementOpen === true,
      reportsOpen: d.reportsOpen === true || (d.reportsOpen === undefined && (d.pollsOpen === true || d.engagementOpen === true)),
      clubRules: d.clubRules ?? "",
      clubRulesPdfUrl: d.clubRulesPdfUrl ?? null,
      clubRulesPdfName: d.clubRulesPdfName ?? null,
      bureauMembers: d.bureauMembers ?? [],
      presidentName: d.presidentName ?? null,
      presentationMode: d.presentationMode === true,
      maintenanceMode: d.maintenanceMode === true,
      sectionsVisible: d.sectionsVisible ?? {},
      clubConfig: d.clubConfig ?? {},
      tshirtOpen: d.tshirtOpen === true,
      tshirtPrice: typeof d.tshirtPrice === "number" ? d.tshirtPrice : null,
      faqOpen: d.faqOpen === true,
      // Si aucune FAQ n'a encore été configurée, on renvoie un seed par défaut
      // (3 questions essentielles). L'admin peut tout modifier ensuite.
      faqItems: Array.isArray(d.faqItems) && d.faqItems.length > 0
        ? d.faqItems
        : [
            {
              id: "faq-seed-1",
              category: "Mon compte",
              order: 0,
              question: "J'ai oublié mon code de connexion, que faire ?",
              answer: "Pas de panique ! Sur la page de connexion (« Espace membre » en haut à droite), clique sur le lien « Code oublié ? » juste sous le formulaire. Tu recevras un email contenant un nouveau code temporaire. Connecte-toi avec, puis change-le si tu veux dans l'onglet « Changer mon code personnel » de ton espace membre.",
            },
            {
              id: "faq-seed-2",
              category: "Mon compte",
              order: 1,
              question: "Comment changer mon code personnel ?",
              answer: "Connecte-toi à ton espace membre puis clique sur « Changer mon code personnel ». Tu devras saisir ton ancien code et choisir le nouveau (4 caractères minimum).",
            },
            {
              id: "faq-seed-3",
              category: "Mon compte",
              order: 2,
              question: "Comment télécharger mon justificatif d'adhésion ?",
              answer: "Si tu as déjà payé ta cotisation, tu peux télécharger ton justificatif depuis ton espace membre. Clique sur le bouton « Mon justificatif d'adhésion », puis sur « Imprimer » → choisis « Enregistrer au format PDF » dans la boîte de dialogue d'impression de ton navigateur.\n\nC'est pratique pour les impôts ou pour te faire rembourser par ton employeur.",
            },
            {
              id: "faq-seed-4",
              category: "Inscription",
              order: 3,
              question: "Comment payer mon adhésion en ligne ?",
              answer: "Sur la page Inscription, choisis « Paiement en ligne » : tu seras redirigé vers HelloAsso, notre partenaire qui encaisse les cotisations.\n\n⚠️ Attention : à la fin du paiement, HelloAsso propose une « contribution au fonctionnement » cochée par défaut. Cette contribution leur revient (pas au SACCB). Si tu veux juste payer ton adhésion, pense à mettre cette contribution à 0 €.\n\nLe tarif SACCB est fixe : 50 € pour un adulte, 30 € pour un étudiant.",
            },
            {
              id: "faq-seed-5",
              category: "Inscription",
              order: 4,
              question: "Je préfère payer par virement, comment faire ?",
              answer: "Lors de ton inscription, choisis « Paiement par virement ». Tu recevras un email confirmant ton inscription en attente, puis tu pourras donner ton règlement à un membre du bureau lors du prochain entraînement.\n\nDès que ton paiement sera validé, tu recevras un email de confirmation avec ton code d'accès.",
            },
            {
              id: "faq-seed-6",
              category: "Inscription",
              order: 5,
              question: "Combien coûte l'adhésion ?",
              answer: "Le tarif est fixe :\n• 50 € pour un Adulte\n• 30 € pour un Étudiant\n\nPas un centime de plus. Si tu paies en ligne via HelloAsso, attention à bien mettre leur contribution facultative à 0 € avant de valider.",
            },
            {
              id: "faq-seed-7",
              category: "Tournois",
              order: 6,
              question: "Comment m'inscrire à un tournoi ?",
              answer: "Très simple, en 3 étapes :\n\n1. Connecte-toi à ton espace membre (bouton « Espace membre » en haut à droite)\n2. Va sur la page Tournois\n3. Sur le tournoi qui t'intéresse, clique sur « S'inscrire » et choisis ton/ta partenaire dans la liste\n\nTu peux aussi cliquer sur « Ajouter à mon agenda » pour avoir un rappel sur ton téléphone le jour J.\n\n💡 Tu peux te désinscrire à tout moment tant que le tournoi n'a pas commencé.",
            },
            {
              id: "faq-seed-8",
              category: "Tournois",
              order: 7,
              question: "Je peux changer de binôme après m'être inscrit ?",
              answer: "Oui ! Tant que le tournoi n'a pas commencé, tu peux te désinscrire puis te réinscrire avec un autre partenaire depuis ton espace membre.\n\nSi le tournoi est complet, contacte directement un membre du bureau pour qu'il puisse t'aider à faire le changement.",
            },
            {
              id: "faq-seed-9",
              category: "Tournois",
              order: 8,
              question: "Où voir mes résultats et statistiques personnelles ?",
              answer: "Tout est dans ton espace membre ! Tu y verras :\n• Tes statistiques perso (nombre de tournois joués, podiums, équipiers différents)\n• L'historique de tes tournois passés avec tes résultats\n• Le classement des binômes de la saison\n\nClique sur « Tournois passés » pour voir le détail de chaque saison.",
            },
            {
              id: "faq-seed-10",
              category: "Application",
              order: 9,
              question: "Comment installer le site comme une appli sur mon téléphone ?",
              answer: "Le site SACCB peut s'installer comme une vraie application sur ton téléphone (icône sur l'écran d'accueil, plein écran, etc.) !\n\n🍎 Sur iPhone (Safari) :\n1. Ouvre saccb.fr dans Safari (pas Chrome)\n2. Appuie sur le bouton Partager (carré avec flèche)\n3. Fais défiler et touche « Sur l'écran d'accueil »\n4. Touche « Ajouter » en haut à droite ✅\n\n🤖 Sur Android (Chrome) :\n1. Ouvre saccb.fr dans Chrome\n2. Appuie sur le menu ⋮ (3 points) en haut à droite\n3. Touche « Installer l'application »\n4. Confirme ✅\n\nL'icône SACCB sera sur ton écran d'accueil et l'appli se mettra à jour automatiquement.",
            },
            {
              id: "faq-seed-11",
              category: "Communication",
              order: 10,
              question: "Comment voter aux sondages et poser une question pour l'AG ?",
              answer: "Connecte-toi à ton espace membre, puis va dans la section « Sondages & AG » sur la page d'accueil ou via ton espace.\n\nTu peux :\n• Voter aux sondages en cours en un clic\n• Poser tes propres questions/idées pour la prochaine assemblée générale\n• Lire les comptes-rendus des réunions précédentes\n• Générer ta procuration si tu ne peux pas être présent(e) à l'AG",
            },
            {
              id: "faq-seed-12",
              category: "Communication",
              order: 11,
              question: "J'ai une question ou une idée, comment vous contacter ?",
              answer: "Le plus simple : utilise le formulaire sur la page Contact (lien dans le menu en haut). On reçoit ton message direct et on te répond rapidement.\n\nTu peux aussi parler directement avec un membre du bureau lors d'un entraînement, ou via le groupe WhatsApp si tu en fais partie.",
            },
            {
              id: "faq-seed-13",
              category: "Communication",
              order: 12,
              question: "Comment me désinscrire de la newsletter ?",
              answer: "Connecte-toi à ton espace membre, puis décoche l'option « Recevoir les emails de l'association » dans tes préférences.\n\nTu continueras à recevoir les emails essentiels (confirmation de paiement, rappels de cotisation, etc.) mais plus les communications optionnelles.",
            },
            {
              id: "faq-seed-14",
              category: "Inscription",
              order: 13,
              question: "Pourquoi dois-je contacter le bureau avant de payer ?",
              answer: "C'est juste une question d'organisation des créneaux : on aime bien faire connaissance avec les nouveaux adhérents et s'assurer qu'on a la place pour t'accueillir avant que tu engages des frais. C'est une étape rapide qui évite les mauvaises surprises.\n\nUtilise la page Contact ou viens nous voir à l'entraînement.",
            },
          ],
    });
  }

  // ❓ ADHÉRENT pose une nouvelle question pour la FAQ (en attente de réponse admin)
  // 🚪 [MEMBRE] Toggle "je ne renouvelle pas cette saison"
  // Le membre ne recevra plus les rappels J-30/15/5/1 de cotisation pour la saison
  // actuelle. À la saison suivante, la valeur ne matche plus → les rappels reprennent.
  if (action === "member_toggle_renewal_skip") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");
    const skip = body.skip === true;
    if (!email || !code || !membreId) return json({ ok: false, reason: "Paramètres manquants." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];
    const membre = await findMembreByCredentials(membres, email, code);
    if (!membre || String(membre.id) !== membreId) return json({ ok: false, reason: "Session invalide." }, 403);

    const idx = membres.findIndex((m) => m.id === membreId);
    if (idx === -1) return json({ ok: false, reason: "Adhérent introuvable." }, 404);

    const currentSeasonKey = `${d.y1}-${d.y2}`;
    if (skip) {
      membres[idx] = { ...membres[idx], renewalSkippedFor: currentSeasonKey };
    } else {
      const next = { ...membres[idx] };
      delete next.renewalSkippedFor;
      membres[idx] = next;
    }
    d.membres = membres;
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    return json({ ok: true, renewalSkippedFor: skip ? currentSeasonKey : null });
  }

  // 🔕 [MEMBRE] Toggle "pas intéressé(e) par ce tournoi"
  // Le membre ne recevra pas les rappels J-30/15/5/1 pour ce tournoi.
  if (action === "member_toggle_tournoi_ignored") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");
    const tournoiId = String(body.tournoiId || "");
    const ignored = body.ignored === true; // true = ne plus recevoir, false = réactiver
    if (!email || !code || !membreId || !tournoiId) return json({ ok: false, reason: "Paramètres manquants." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];
    const membre = await findMembreByCredentials(membres, email, code);
    if (!membre || String(membre.id) !== membreId) return json({ ok: false, reason: "Session invalide." }, 403);

    const idx = membres.findIndex((m) => m.id === membreId);
    if (idx === -1) return json({ ok: false, reason: "Adhérent introuvable." }, 404);

    const current = Array.isArray(membres[idx].tournoisIgnored) ? (membres[idx].tournoisIgnored as string[]) : [];
    const next = ignored
      ? Array.from(new Set([...current, tournoiId]))
      : current.filter((id) => id !== tournoiId);
    membres[idx] = { ...membres[idx], tournoisIgnored: next };
    d.membres = membres;
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    return json({ ok: true, tournoisIgnored: next });
  }

  if (action === "faq_ask_question") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");
    const question = sanitize(String(body.question || "")).slice(0, 500);
    if (!email || !code || !membreId) return json({ ok: false, reason: "Authentification requise." }, 400);
    if (!question.trim() || question.trim().length < 5) return json({ ok: false, reason: "Question trop courte (5 caractères minimum)." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];
    const membre = await findMembreByCredentials(membres, email, code);
    if (!membre || String(membre.id) !== membreId) return json({ ok: false, reason: "Session invalide." }, 403);
    if (membre.ok !== true) return json({ ok: false, reason: "Votre adhésion doit être validée pour poser une question." }, 403);

    const pending = (d.faqPending || []) as Record<string, unknown>[];
    // Anti-spam : 1 question max par membre toutes les 60 secondes
    const recentByMember = pending.find((p) => p.membreId === membreId && (Date.now() - new Date(String(p.createdAt)).getTime()) < 60_000);
    if (recentByMember) return json({ ok: false, reason: "Patientez quelques secondes avant de poser une nouvelle question." }, 429);

    pending.push({
      id: `faq-q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question: question.trim(),
      membreId,
      membreNom: String(membre.nom || ""),
      membreEmail: email,
      createdAt: new Date().toISOString(),
    });
    d.faqPending = pending;
    const { error: saveErr } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveErr) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);

    // 📧 Notification aux admins (fire and forget)
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey) {
      const adminEmails = parseAdminEmails((d.adminEmails as unknown[]) || []).map((e) => e.email);
      const adminCreds = ((d.adminCredentials || []) as { email: string }[]).map((c) => String(c.email || "").toLowerCase()).filter(Boolean);
      const allAdmins = Array.from(new Set([...adminEmails, ...adminCreds]));
      if (allAdmins.length > 0) {
        const safeQuestion = escapeHtml(question.trim());
        const safeName = escapeHtml(String(membre.nom || ""));
        (async () => {
          for (const adm of allAdmins) {
            await sendBrevo(brevoKey, {
              from: "SACCB <contact@saccb.fr>",
              to: [adm],
              subject: `❓ Nouvelle question FAQ de ${String(membre.nom || "")}`,
              text: `${String(membre.nom || "")} a posé une nouvelle question pour la FAQ :\n\n"${question.trim()}"\n\nRendez-vous dans l'admin (section FAQ adhérents) pour répondre :\nhttps://saccb.fr/admin#admin-faq`,
              html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1e3a5f; padding: 18px 24px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 18px;">❓ Nouvelle question FAQ</h1>
                </div>
                <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                  <p style="color: #475569; margin: 0 0 12px;"><strong>${safeName}</strong> a posé une nouvelle question pour la FAQ :</p>
                  <div style="background: #f1f5f9; border-left: 4px solid #1e3a5f; padding: 14px; margin: 12px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #1e293b; font-style: italic;">« ${safeQuestion} »</p>
                  </div>
                  <a href="https://saccb.fr/admin#admin-faq" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px;">Répondre dans l'admin →</a>
                </div>
              </div>`,
            }).catch(() => {});
            await sleep(EMAIL_THROTTLE_MS);
          }
          await logEmailToHistory(supabaseAdmin, {
            type: "faq_question_notification",
            subject: `Nouvelle question FAQ de ${String(membre.nom || "")}`,
            recipients: allAdmins,
            sentCount: allAdmins.length,
            status: "sent",
          });
        })();
      }
    }

    return json({ ok: true });
  }

  // ❓ ADMIN : valider une question en attente avec une réponse (la déplace dans faqItems)
  if (action === "admin_faq_answer") {
    const pendingId = String(body.pendingId || "");
    const answer = sanitize(String(body.answer || "")).slice(0, 2000);
    const category = sanitize(String(body.category || "")).slice(0, 40);
    if (!pendingId || !answer.trim()) return json({ ok: false, reason: "Paramètres manquants." }, 400);

    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const pending = (d.faqPending || []) as Array<{ id: string; question: string; membreEmail?: string; membreNom?: string }>;
    const entry = pending.find((p) => p.id === pendingId);
    if (!entry) return json({ ok: false, reason: "Question introuvable." }, 404);

    const faqItems = (d.faqItems || []) as Record<string, unknown>[];
    faqItems.push({
      id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question: entry.question,
      answer: answer.trim(),
      category: category.trim() || undefined,
      order: faqItems.length,
    });
    d.faqItems = faqItems;
    d.faqPending = pending.filter((p) => p.id !== pendingId);
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);

    // 📧 Notifier l'adhérent que sa question a été répondue (fire and forget)
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey && entry.membreEmail) {
      const safeName = escapeHtml(String(entry.membreNom || ""));
      const safeQ = escapeHtml(entry.question);
      const safeA = escapeHtml(answer.trim()).replace(/\n/g, "<br/>");
      sendBrevo(brevoKey, {
        from: "SACCB <contact@saccb.fr>",
        to: [entry.membreEmail],
        subject: `✅ Le bureau a répondu à ta question FAQ`,
        text: `Bonjour ${String(entry.membreNom || "")},\n\nTa question pour la FAQ a été publiée avec une réponse :\n\nQuestion : ${entry.question}\n\nRéponse : ${answer.trim()}\n\nTu peux la retrouver à tout moment sur https://saccb.fr/faq\n\nLe bureau du SACCB`,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 18px 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 18px;">✅ Le bureau a répondu à ta question</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
            <p style="color: #475569; margin: 0 0 12px;">Bonjour <strong>${safeName}</strong>,</p>
            <p style="color: #475569;">Ta question pour la FAQ a été publiée avec une réponse 🎉</p>
            <div style="background: #f1f5f9; border-left: 4px solid #1e3a5f; padding: 14px; margin: 14px 0; border-radius: 4px;">
              <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Question</p>
              <p style="margin: 0; color: #1e293b; font-style: italic;">${safeQ}</p>
            </div>
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px; margin: 14px 0; border-radius: 4px;">
              <p style="margin: 0 0 4px; color: #15803d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Réponse</p>
              <p style="margin: 0; color: #1e293b;">${safeA}</p>
            </div>
            <p style="color: #64748b; font-size: 13px;">Tu peux la retrouver à tout moment dans la <a href="https://saccb.fr/faq" style="color: #1e3a5f; font-weight: 600;">FAQ du site</a>.</p>
            <p style="margin-top: 18px; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains 🏸</p>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Le bureau du SACCB</p>
          </div>
        </div>`,
      }).catch(() => {});
    }

    return json({ ok: true });
  }

  // ❓ ADMIN : refuser/supprimer une question en attente
  if (action === "admin_faq_reject") {
    const pendingId = String(body.pendingId || "");
    if (!pendingId) return json({ ok: false, reason: "pendingId manquant." }, 400);
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;
    d.faqPending = ((d.faqPending || []) as { id: string }[]).filter((p) => p.id !== pendingId);
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    return json({ ok: true });
  }

  // ❓ ADMIN : lister les questions en attente
  if (action === "admin_faq_pending_list") {
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;
    return json({ ok: true, pending: d.faqPending || [] });
  }

  // ─── ACTION: Récupérer les actualités privées (membres authentifiés) ───
  if (action === "fetch_private_actualites") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");

    if (!email || !code) return json({ ok: false, reason: "Auth requise." }, 401);

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];
    const adminCredentials = ((d.adminCredentials || []) as { email: string; code: string }[]);

    // Vérifier que le membre existe et que le code est correct
    const matchedMembre = await findMembreByCredentials(membres, email, code);
    const membre = matchedMembre && String(matchedMembre.id || "") === membreId ? matchedMembre : undefined;
    const matchedAdminCred = await findAdminCredByCredentials(adminCredentials, email, code);
    const isAdmin = !!matchedAdminCred;

    if (!membre && !isAdmin) {
      return json({ ok: false, reason: "Non autorisé." }, 403);
    }

    const privateActualites = ((d.actualites as Record<string,unknown>[] | undefined) ?? []).filter(
      (a: Record<string,unknown>) => a.private === true
    );

    return json({ ok: true, actualites: privateActualites });
  }

  // ─── ACTION: Vérification membre (connexion espace membre) ───
  if (action === "verify_membre") {
    // 🔒 SÉCURITÉ : rate limit pour empêcher le brute force des codes
    if (isLoginRateLimited(ip)) {
      return json({ ok: false, reason: "Trop de tentatives de connexion. Réessayez dans 15 minutes." }, 429);
    }

    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const code2fa = sanitize(String(body.code2fa || ""));
    const trustToken = String(body.trustToken || "").trim();

    if (!email || !code) return json({ ok: false, reason: "Email et code requis." }, 400);

    // 🔒 Compte bloqué après 5 tentatives ratées ?
    const lockStatus = isAccountLocked(email);
    if (lockStatus.locked) {
      return json({ ok: false, reason: `Compte temporairement bloqué après plusieurs tentatives. Réessayez dans ${lockStatus.minutesLeft} min ou contactez l'association.` }, 429);
    }

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];
    const adminCredentials = ((currentData.adminCredentials || []) as { email: string; code: string }[]);
    const adminEmailEntries = parseAdminEmails(currentData.adminEmails as unknown[] || []);
    const adminEmails = adminEmailEntries.map((e) => e.email);

    const require2FA = currentData.require2FA === true;
    const resend2FA = body.resend2FA === true;
    // Le serveur émettra (ou ré-émettra) un trust token après un 2FA réussi,
    // ou ré-utilisera celui passé par le client s'il est encore valide.
    let issuedTrustToken: string | null = null;

    // Vérifie / déclenche 2FA si activé. Retourne null si OK pour continuer,
    // sinon retourne une Response qu'il faut renvoyer directement.
    async function handle2FA(): Promise<Response | null> {
      if (!require2FA) return null;

      // 🛡️ Si le client envoie un trust token valide → on saute le 2FA
      // (ré-auth depuis le même navigateur dans les 14 jours suivant le 1er 2FA)
      if (trustToken && isTrustTokenValid(currentData, email, trustToken)) {
        issuedTrustToken = trustToken; // on renvoie le même au client
        return null;
      }

      const brevoKey = Deno.env.get("BREVO_API_KEY");
      if (!brevoKey) return null; // si pas d'email service, on skip pour pas bloquer

      // Pas de code fourni OU demande explicite de renvoi → on génère + envoie
      if (!code2fa || resend2FA) {
        const newCode = generate2FACode();
        set2FAEntry(currentData, email, await hashCode(newCode));
        // Persister immédiatement (sinon une autre invocation ne verra pas le code)
        await supabaseAdmin.from("saccb_db").update({ data: currentData }).eq("id", 1);
        try {
          await sendBrevo(brevoKey, {
            from: "SACCB <contact@saccb.fr>",
            to: [email],
            subject: `Code de connexion admin SACCB : ${newCode}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px"><h2 style="color:#1e3a5f">🔐 Code de connexion</h2><p>Votre code à usage unique pour accéder au panneau admin :</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;background:#f1f5f9;padding:16px;border-radius:8px">${newCode}</p><p style="color:#64748b;font-size:13px">Ce code est valable 10 minutes. Si vous n'êtes pas à l'origine de cette connexion, changez immédiatement votre mot de passe et prévenez le bureau.</p></div>`,
            text: `Votre code de connexion admin SACCB : ${newCode}\nValable 10 minutes.`,
          });
        } catch { /* best-effort */ }
        return json({ ok: false, requires2FA: true, reason: resend2FA ? "Nouveau code envoyé par email." : "Un code de connexion a été envoyé à votre email. Saisissez-le pour continuer." });
      }
      // Code fourni → on vérifie depuis la DB
      const entry = find2FAEntry(currentData, email);
      if (!entry) {
        return json({ ok: false, requires2FA: true, reason: "Code expiré ou inexistant. Demandez-en un nouveau." });
      }
      const ok2fa = await verifyCode(entry.codeHash, code2fa);
      if (!ok2fa) {
        recordLoginFailure(email);
        return json({ ok: false, requires2FA: true, reason: "Code 2FA incorrect." });
      }
      // Consomme l'entrée (usage unique) + émet un trust token + persiste
      delete2FAEntry(currentData, email);
      issuedTrustToken = await issueTrustToken(currentData, email);
      await supabaseAdmin.from("saccb_db").update({ data: currentData }).eq("id", 1);
      return null; // OK, on continue
    }

    // Vérifier d'abord les credentials admin indépendants (pas besoin d'être adhérent)
    const adminCred = await findAdminCredByCredentials(adminCredentials, email, code);
    if (adminCred) {
      clearLoginFailures(email);
      // 🔑 Gate 2FA admin si activé
      const gate = await handle2FA();
      if (gate) return gate;
      // Migration douce du code en clair → hashé
      if (!isHashedCode(adminCred.code)) {
        await migrateCodeIfNeeded(supabaseAdmin, currentData, { type: "adminCred", email, plainCode: code });
      }
      // 🔐 Log de connexion admin (audit trail, 50 dernières conservées)
      try {
        const log = ((currentData.adminLoginLog || []) as { email: string; date: string; ip?: string }[]);
        log.unshift({ email, date: new Date().toISOString(), ip });
        currentData.adminLoginLog = log.slice(0, 50);
        await supabaseAdmin.from("saccb_db").update({ data: currentData }).eq("id", 1);
      } catch { /* best-effort */ }
      return json({
        ok: true,
        paid: true,
        isAdmin: true,
        membre: { id: "admin-" + email, nom: email, type: "Adulte", email },
        trustToken: issuedTrustToken ?? undefined,
      });
    }

    // Sinon vérifier dans les adhérents normaux
    const membre = await findMembreByCredentials(membres, email, code);

    if (!membre) {
      recordLoginFailure(email);
      return json({ ok: false, reason: "Email ou code incorrect." });
    }
    clearLoginFailures(email);

    // Migration douce du code en clair → hashé
    if (!isHashedCode(String(membre.code || ""))) {
      await migrateCodeIfNeeded(supabaseAdmin, currentData, { type: "membre", id: String(membre.id), plainCode: code });
    }

    const isAdmin = adminEmails.includes(email);
    const codeJustReset = membre.codeJustReset === true;

    // 🔑 Gate 2FA pour admin via membre
    if (isAdmin) {
      const gate = await handle2FA();
      if (gate) return gate;
    }

    // 🔐 Log de connexion admin (audit trail, 50 dernières conservées)
    if (isAdmin) {
      try {
        const log = ((currentData.adminLoginLog || []) as { email: string; date: string; ip?: string }[]);
        log.unshift({ email, date: new Date().toISOString(), ip });
        currentData.adminLoginLog = log.slice(0, 50);
        // sera persisté en même temps que codeJustReset ci-dessous
      } catch { /* best-effort */ }
    }

    // Si le flag est levé, on le retire en base : la popup ne s'affichera qu'une fois après reset
    if (codeJustReset) {
      const idx = membres.findIndex((m) => m.id === membre.id);
      if (idx !== -1) {
        const { codeJustReset: _drop, ...rest } = membres[idx] as Record<string, unknown>;
        membres[idx] = rest;
        currentData.membres = membres;
      }
    }
    // Persist si nécessaire (codeJustReset OU log admin ajouté)
    if (codeJustReset || isAdmin) {
      try {
        await supabaseAdmin.from("saccb_db").update({ data: currentData }).eq("id", 1);
      } catch { /* best-effort */ }
    }

    return json({
      ok: true,
      paid: membre.ok === true,
      isAdmin,
      codeJustReset,
      membre: {
        id: membre.id,
        nom: membre.nom,
        type: membre.type,
        email: membre.email,
        newsOptIn: membre.newsOptIn !== false, // true par défaut pour les anciens comptes
        tournoisIgnored: Array.isArray(membre.tournoisIgnored) ? membre.tournoisIgnored : [],
        renewalSkippedFor: membre.renewalSkippedFor ? String(membre.renewalSkippedFor) : undefined,
      },
      trustToken: issuedTrustToken ?? undefined,
    });
  }

  // ─── ACTION: Mettre à jour les préférences news d'un membre ───
  if (action === "update_news_optin") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");
    const newsOptIn = body.newsOptIn === true;

    if (!email || !code || !membreId) return json({ ok: false, reason: "Paramètres manquants." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];

    const matched = await findMembreByCredentials(membres, email, code);
    const idx = matched ? membres.findIndex((m) => m.id === matched.id && String(m.id || "") === membreId) : -1;
    if (idx === -1) return json({ ok: false, reason: "Membre introuvable ou code incorrect." }, 403);

    membres[idx] = { ...membres[idx], newsOptIn };
    d.membres = membres;
    const { error: saveErr } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveErr) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // ─── ACTION: Récupérer toute la DB en tant qu'admin membre ───
  if (action === "admin_fetch") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    if (!email || !code) return json({ ok: false, reason: "Identifiants manquants." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];
    const adminEmailEntries = parseAdminEmails(d.adminEmails as unknown[] || []);
    const adminEmails = adminEmailEntries.map((e) => e.email);
    const adminCredentials = ((d.adminCredentials || []) as { email: string; code: string; readOnly?: boolean; permissions?: string[] }[]);

    // Vérifier via adminCredentials (admin sans adhérent) OU via membres
    const validAdminCred = await findAdminCredByCredentials(adminCredentials, email, code);
    const validMembre = await findMembreByCredentials(membres, email, code);

    if (!validAdminCred && !validMembre) return json({ ok: false, reason: "Identifiants incorrects." });
    if (!adminEmails.includes(email) && !validAdminCred) return json({ ok: false, reason: "Accès non autorisé." });

    const adminEmailEntry = adminEmailEntries.find((e) => e.email === email);
    const isReadOnly = validAdminCred?.readOnly === true || adminEmailEntry?.readOnly === true;
    const permissions = validAdminCred?.permissions ?? adminEmailEntry?.permissions ?? undefined;

    // 🔒 SÉCURITÉ : masquer les codes hashés dans la réponse admin (l'admin n'a pas besoin de les voir)
    // Les codes en clair restent visibles (legacy, l'admin doit pouvoir les transmettre aux membres)
    const maskedMembres = (membres as Record<string, unknown>[]).map((m) => ({
      ...m,
      code: isHashedCode(String(m.code || "")) ? "" : m.code,
      _codeHashed: isHashedCode(String(m.code || "")),
    }));
    const maskedAdminCreds = (adminCredentials as { email: string; code: string }[]).map((c) => ({
      ...c,
      code: isHashedCode(c.code) ? "" : c.code,
      _codeHashed: isHashedCode(c.code),
    }));

    // Normalise adminEmails en format objet (compat ancien format string[])
    const normalizedData = {
      ...d,
      adminEmails: adminEmailEntries,
      membres: maskedMembres,
      adminCredentials: maskedAdminCreds,
    };
    return json({ ok: true, data: normalizedData, readOnly: isReadOnly, permissions });
  }

  // ─── ACTION: Exporter la DB complète (pour sauvegarde locale) — AUTH ADMIN REQUISE ───
  // Retourne le JSON complet de saccb_db sans masquage des codes hashés
  // (la sauvegarde doit être fidèle pour permettre une restauration)
  if (action === "admin_export_backup") {
    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const currentData = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, currentData);
    if (authError) return authError;
    return json({
      ok: true,
      exportedAt: new Date().toISOString(),
      data: currentData,
    });
  }

  // ─── ACTION: Restaurer la DB depuis une sauvegarde JSON — AUTH ADMIN REQUISE ───
  // Remplace integralement le contenu de saccb_db.data par le payload fourni.
  // Securite : double check sur la structure + flag explicite confirmRestore=true.
  if (action === "admin_import_backup") {
    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const currentData = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, currentData);
    if (authError) return authError;

    const newData = body.backupData as Record<string, unknown> | undefined;
    if (!newData || typeof newData !== "object") {
      return json({ ok: false, reason: "backupData manquant ou invalide." }, 400);
    }
    // Verifications minimales que ca ressemble bien a une DB SACCB
    const looksLikeSACCB =
      Array.isArray(newData.membres) ||
      Array.isArray(newData.config_tournois) ||
      Array.isArray(newData.actualites);
    if (!looksLikeSACCB) {
      return json({ ok: false, reason: "Le fichier ne ressemble pas a une sauvegarde SACCB (aucun champ membres/tournois/actualites)." }, 400);
    }
    if (body.confirmRestore !== true) {
      return json({ ok: false, reason: "Flag de confirmation manquant." }, 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from("saccb_db")
      .update({ data: newData })
      .eq("id", 1);
    if (updateError) return json({ ok: false, reason: "Erreur lors de la restauration : " + updateError.message }, 500);

    const stats = {
      membres: Array.isArray(newData.membres) ? (newData.membres as unknown[]).length : 0,
      tournois: Array.isArray(newData.config_tournois) ? (newData.config_tournois as unknown[]).length : 0,
      actualites: Array.isArray(newData.actualites) ? (newData.actualites as unknown[]).length : 0,
    };
    return json({ ok: true, restoredAt: new Date().toISOString(), stats });
  }

  // ─── ACTION: Sauvegarder la DB en tant qu'admin membre ───
  if (action === "admin_save") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const newData = body.data as Record<string, unknown>;
    if (!email || !code || !newData) return json({ ok: false, reason: "Données manquantes." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];
    const adminEmailEntries = parseAdminEmails(d.adminEmails as unknown[] || []);
    const adminEmails = adminEmailEntries.map((e) => e.email);
    const adminCredentialsCheck = ((d.adminCredentials || []) as { email: string; code: string }[]);

    const validAdminCredSave = await findAdminCredByCredentials(adminCredentialsCheck, email, code);
    const validMembreSave = await findMembreByCredentials(membres, email, code);

    if (!validAdminCredSave && !validMembreSave) return json({ ok: false, reason: "Identifiants incorrects." });
    if (!adminEmails.includes(email) && !validAdminCredSave) return json({ ok: false, reason: "Accès non autorisé." });

    // Seuls les super-admins peuvent modifier la liste adminEmails (ajout/suppression)
    const SUPER_ADMINS = ["gabin.binay@gmail.com", "hernancm68@hotmail.com"];
    const currentAdminEmailSet = JSON.stringify(adminEmailEntries.map((e) => e.email).sort());
    const newAdminEmailSet = JSON.stringify(parseAdminEmails((newData.adminEmails as unknown[] || [])).map((e) => e.email).sort());
    if (currentAdminEmailSet !== newAdminEmailSet && !SUPER_ADMINS.includes(email)) {
      return json({ ok: false, reason: "Seul un super-administrateur peut modifier la liste des admins." }, 403);
    }

    // 🔒 SÉCURITÉ : préserver les codes hashés et hasher les nouveaux codes en clair
    // Si le code envoyé est vide (= masqué côté admin) → garder l'ancien code de la DB
    // Si le code envoyé est nouveau et en clair → le hasher avant sauvegarde
    const oldMembresMap = new Map<string, Record<string, unknown>>();
    membres.forEach((m) => oldMembresMap.set(String(m.id || ""), m));
    const newMembres = (newData.membres || []) as Record<string, unknown>[];
    for (const m of newMembres) {
      // Nettoyer le flag de masquage (si présent) avant de sauvegarder
      delete (m as Record<string, unknown>)._codeHashed;
      const c = String(m.code || "");
      if (!c) {
        // Code masqué côté admin → restaurer l'ancien code (hashé) depuis la DB
        const old = oldMembresMap.get(String(m.id || ""));
        if (old) m.code = old.code;
      } else if (!isHashedCode(c)) {
        // Nouveau code en clair → hasher avant sauvegarde
        m.code = await hashCode(c);
      }
      // Sinon : code déjà hashé, on garde tel quel
    }

    const oldAdminCredsMap = new Map<string, { email: string; code: string }>();
    adminCredentialsCheck.forEach((c) => oldAdminCredsMap.set(String(c.email || "").toLowerCase(), c));
    const newAdminCreds = (newData.adminCredentials || []) as { email: string; code: string }[];
    for (const c of newAdminCreds) {
      delete (c as Record<string, unknown>)._codeHashed;
      const v = String(c.code || "");
      if (!v) {
        const old = oldAdminCredsMap.get(String(c.email || "").toLowerCase());
        if (old) c.code = old.code;
      } else if (!isHashedCode(v)) {
        c.code = await hashCode(v);
      }
    }

    // 🔍 Détection de l'ouverture des commandes t-shirt (false → true)
    const tshirtJustOpened = d.tshirtOpen !== true && newData.tshirtOpen === true;

    const { error: saveError } = await supabaseAdmin.from("saccb_db").update({ data: newData }).eq("id", 1);
    if (saveError) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);

    // 🔄 Sync Google Sheets en temps réel après chaque modification admin (fire and forget)
    const sheetsWebhookSync = Deno.env.get("SHEETS_WEBHOOK");
    if (sheetsWebhookSync) {
      fetch(sheetsWebhookSync, {
        method: "POST",
        body: JSON.stringify(newData),
      }).catch((e) => console.warn("[admin_save] Sheets sync failed:", e));
    }

    // 👕 Notification automatique aux adhérents quand les commandes t-shirt s'ouvrent
    if (tshirtJustOpened) {
      const brevoKeyT = Deno.env.get("BREVO_API_KEY");
      if (brevoKeyT) {
        const tshirtPrice = typeof newData.tshirtPrice === "number" ? newData.tshirtPrice : null;
        const priceText = tshirtPrice !== null ? `Le t-shirt coûte ${tshirtPrice}€` : "Le prix vous sera précisé par le bureau";
        // Adhérents payés + newsletter activée (= ceux qui consentent à recevoir les news)
        const paidMembres = ((newData.membres || []) as Record<string, unknown>[])
          .filter((m) => m.ok === true && m.newsOptIn !== false)
          .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
          .filter((m) => m.email);
        // Fire-and-forget : on envoie en boucle avec throttle, sans bloquer la réponse admin
        (async () => {
          for (const r of paidMembres) {
            const greeting = r.prenom ? `Bonjour ${escapeHtml(r.prenom)},` : "Bonjour,";
            const greetingText = r.prenom ? `Bonjour ${r.prenom},` : "Bonjour,";
            // 📨 Design "mail perso" pour éviter le classement en Promotions Gmail.
            // Texte plein, pas de bouton CTA, pas de liste numérotée, pas de couleur vive.
            const subjectPrefix = r.prenom ? `${r.prenom}, ` : "";
            await sendBrevo(brevoKeyT, {
              from: "SACCB <contact@saccb.fr>",
              // 🚫 Pas de header List-Unsubscribe sur les mails 1-to-1 type "mail perso"
              // pour ne pas signaler à Gmail "ceci est un envoi de masse"
              to: [r.email],
              subject: `${subjectPrefix}les commandes de t-shirts sont ouvertes`,
              text: `${greetingText}\n\nPetit message rapide pour te dire que les commandes de t-shirts SACCB sont ouvertes.\n\nPour commander, tu te connectes à ton espace membre sur saccb.fr et tu trouveras le bloc de commande directement dans ton espace. Tu choisis ta taille et tu peux ajouter un nom ou surnom à floquer si tu veux.\n\nLe prix est ${priceText} et tu règleras de la main à la main quand tu viendras chercher ton t-shirt.\n\nTu peux modifier ou annuler ta commande à tout moment depuis ton espace membre.\n\nÀ bientôt,\nLe bureau du SACCB`,
              // HTML très sobre, presque du texte brut avec juste un peu de mise en forme
              html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0; padding: 16px; color: #1f2937; line-height: 1.6; font-size: 15px;">
                <p style="margin: 0 0 14px;">${greeting}</p>
                <p style="margin: 0 0 14px;">Petit message rapide pour te dire que les commandes de t-shirts SACCB sont ouvertes.</p>
                <p style="margin: 0 0 14px;">Pour commander, tu te connectes à ton espace membre sur <a href="https://saccb.fr/?member=1" style="color: #1f2937;">saccb.fr</a> et tu trouveras le bloc de commande directement dans ton espace. Tu choisis ta taille et tu peux ajouter un nom ou surnom à floquer si tu veux.</p>
                <p style="margin: 0 0 14px;">Le prix est ${priceText} et tu règleras de la main à la main quand tu viendras chercher ton t-shirt.</p>
                <p style="margin: 0 0 14px;">Tu peux modifier ou annuler ta commande à tout moment depuis ton espace.</p>
                <p style="margin: 14px 0 0;">À bientôt,<br/>Le bureau du SACCB</p>
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 22px; padding-top: 14px; border-top: 1px solid #e2e8f0; width: 100%;">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 12px; width: 44px;">
                      <img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" />
                    </td>
                    <td style="vertical-align: middle;">
                      <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                      <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> · <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                    </td>
                  </tr>
                </table>
              </div>`,
            }).catch(() => {});
            await sleep(EMAIL_THROTTLE_MS);
          }
          await logEmailToHistory(supabaseAdmin, {
            type: "tshirt_open_notification",
            subject: `Commandes de t-shirts SACCB ouvertes`,
            recipients: paidMembres.map((m) => m.email),
            sentCount: paidMembres.length,
            status: "sent",
          });
        })();
      }
    }

    return json({ ok: true });
  }

  // ─── ACTION: Inscription publique ───
  if (action === "add_membre") {
    // 🛡️ Honeypot anti-bot
    if (body.website || body.hp_url) {
      return json({ ok: true }); // fake success
    }
    // 🔒 SÉCURITÉ : rate limit pour empêcher le spam d'inscriptions automatiques
    if (isRegistrationRateLimited(ip)) {
      return json({ ok: false, reason: "Trop de tentatives d'inscription. Réessayez dans une heure." }, 429);
    }
    const nom = sanitize(String(body.nom || ""));
    const email = sanitize(String(body.email || "")).toLowerCase();
    const tel = sanitize(String(body.tel || ""));
    const type = body.type === "Etudiant" ? "Etudiant" : "Adulte";
    const paymentMethod = body.paymentMethod === "virement" ? "virement" : "online";
    const code = sanitize(String(body.code || ""));
    const newsOptIn = body.newsOptIn === true || body.newsOptIn === "true";
    const photoConsent = body.photoConsent === true || body.photoConsent === "true";
    const grouped = body.grouped === true; // inscription groupée = ne pas écraser les autres membres du même email

    // Validation
    if (!nom || nom.length < 2) return json({ ok: false, reason: "Nom invalide." }, 400);
    if (!isValidEmail(email)) return json({ ok: false, reason: "Email invalide." }, 400);
    if (!isValidPhone(tel)) return json({ ok: false, reason: "Téléphone invalide." }, 400);
    if (!code || code.length < 4) {
      return json({ ok: false, reason: "Le mot de passe doit contenir au moins 4 caractères." }, 400);
    }

    // Lire les données actuelles
    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];

    // 🔒 SÉCURITÉ : hasher le code avant stockage
    const hashedCode = await hashCode(code);

    // Renouvellement uniquement si inscription individuelle (pas groupée)
    if (!grouped) {
      const existingIdx = membres.findIndex((m) => String(m.email || "").toLowerCase() === email);
      if (existingIdx !== -1) {
        if (membres[existingIdx].ok === true) {
          // 🔒 Message volontairement neutre (anti-énumération d'emails) tout en restant compréhensible pour un vrai adhérent
          return json({ ok: false, reason: "Une adhésion active existe déjà pour ces informations. Connectez-vous à votre espace membre ou contactez l'association." });
        }
        // Renouvellement : on met à jour l'entrée existante
        const existing = membres[existingIdx];
        membres[existingIdx] = {
          ...existing,
          nom,
          tel: tel || existing.tel,
          type,
          paymentMethod,
          code: code ? hashedCode : existing.code,
          newsOptIn,
          photoConsent,
          ok: false,
        };
        currentData.membres = membres;
        const { error: renewError } = await supabaseAdmin
          .from("saccb_db")
          .update({ data: currentData })
          .eq("id", 1);
        if (renewError) return json({ ok: false, reason: "Erreur serveur." }, 500);

        // 📧 Mail de confirmation pour un renouvellement aussi (en attente de paiement)
        const brevoKeyRenew = Deno.env.get("BREVO_API_KEY");
        if (brevoKeyRenew) {
          const prenom = extractFirstName(nom);
          const greeting = prenom ? `Bonjour ${escapeHtml(prenom)},` : "Bonjour,";
          const greetingText = prenom ? `Bonjour ${prenom},` : "Bonjour,";
          const yearLabel = `${currentData.y1}–${currentData.y2}`;
          const isOnline = paymentMethod === "online";
          const paymentBlockHtml = isOnline
            ? `<p style="color: #475569; margin: 16px 0 8px;">Vous avez choisi le <strong>paiement en ligne (HelloAsso)</strong>.</p>
               <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 12px 0;"><p style="margin: 0 0 6px; color: #92400e; font-size: 13px;"><strong>⚠️ Attention au don pré-coché par HelloAsso</strong></p><p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">À la fin du paiement, HelloAsso propose une « contribution au fonctionnement » qui leur revient (et pas au SACCB). Elle est cochée par défaut. Pensez à la mettre à <strong>0&nbsp;€</strong> si vous voulez juste régler votre cotisation.</p></div>
               <p style="color: #475569;">Une fois votre paiement validé, vous recevrez automatiquement votre confirmation par email.</p>`
            : `<p style="color: #475569; margin: 16px 0 8px;">Vous avez choisi le <strong>paiement par virement</strong>.</p>
               <p style="color: #475569;">Rapprochez-vous d'un membre du bureau au prochain entraînement pour finaliser votre règlement. Vous recevrez votre confirmation dès que le virement sera validé.</p>`;
          const paymentBlockText = isOnline
            ? `Vous avez choisi le paiement en ligne (HelloAsso).\n\nATTENTION : à la fin du paiement, HelloAsso propose une contribution au fonctionnement qui leur est versée (pas au SACCB). Elle est cochée par défaut. Pensez à la mettre à 0 € si vous voulez juste régler votre cotisation.`
            : `Vous avez choisi le paiement par virement. Rapprochez-vous d'un membre du bureau au prochain entraînement pour finaliser votre règlement.`;
          sendBrevo(brevoKeyRenew, {
            from: "SACCB <contact@saccb.fr>",
            headers: {
              "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            to: [email],
            subject: `📝 Votre renouvellement au SACCB a bien été enregistré — saison ${yearLabel}`,
            text: `${greetingText}\n\nVotre renouvellement au SACCB pour la saison ${yearLabel} a bien été enregistré. Il est actuellement en attente de paiement.\n\n${paymentBlockText}\n\nÀ très bientôt sur les terrains 🏸\nLe bureau du SACCB`,
            html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1e3a5f; padding: 18px 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 14px;">
                <img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="background: white; border-radius: 10px; padding: 4px; display: block;" />
                <div><h1 style="color: white; margin: 0; font-size: 20px;">SACCB</h1><p style="color: rgba(255,255,255,0.7); margin: 2px 0 0; font-size: 12px;">Sainte-Adresse Club de Compétition de Badminton</p></div>
              </div>
              <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                <p style="color: #475569; margin: 0 0 14px;">${greeting}</p>
                <p style="color: #475569; line-height: 1.6;">Votre renouvellement d'adhésion au SACCB pour la saison <strong>${yearLabel}</strong> a bien été enregistré 🎉</p>
                <p style="color: #475569; line-height: 1.6;">Il est actuellement <strong>en attente de paiement</strong>.</p>
                ${paymentBlockHtml}
              </div>
            </div>`,
          }).then(async (res) => {
            await logEmailToHistory(supabaseAdmin, {
              type: "registration_pending",
              subject: `Renouvellement enregistré — saison ${yearLabel}`,
              recipients: [email],
              status: res.ok ? "sent" : "failed",
            });
          }).catch(() => {});
        }

        return json({ ok: true, membreId: String(existing.id), renewed: true });
      }
    } else {
      // Inscription groupée : vérifier qu'aucune adhésion active n'existe déjà pour ce nom+email
      const alreadyActive = membres.find(
        (m) => String(m.email || "").toLowerCase() === email && String(m.nom || "").toLowerCase() === nom.toLowerCase() && m.ok === true
      );
      if (alreadyActive) {
        return json({ ok: false, reason: `${nom} est déjà inscrit(e) avec une adhésion active !` });
      }
    }

    // Vérifier quota (dynamique, 65 par défaut)
    const quota = (currentData.quota as number) || 65;
    if (membres.length >= quota) {
      return json({ ok: false, reason: "L'association est complète !" });
    }

    const newMembre = {
      id: Date.now().toString(),
      nom,
      email,
      tel,
      type,
      ok: false,
      paymentMethod,
      code: hashedCode, // 🔒 Code hashé en base
      newsOptIn,
      photoConsent,
    };

    membres.push(newMembre);
    currentData.membres = membres;

    const { error: updateError } = await supabaseAdmin
      .from("saccb_db")
      .update({ data: currentData })
      .eq("id", 1);

    if (updateError) return json({ ok: false, reason: "Erreur serveur." }, 500);

    // 📧 Envoi du mail de confirmation d'inscription (avant paiement) — fire and forget
    const brevoKeyConfirm = Deno.env.get("BREVO_API_KEY");
    if (brevoKeyConfirm) {
      const prenom = extractFirstName(nom);
      const greeting = prenom ? `Bonjour ${escapeHtml(prenom)},` : "Bonjour,";
      const greetingText = prenom ? `Bonjour ${prenom},` : "Bonjour,";
      const yearLabel = `${currentData.y1}–${currentData.y2}`;
      const isOnline = paymentMethod === "online";
      const paymentBlockHtml = isOnline
        ? `
          <p style="color: #475569; margin: 16px 0 8px;">Vous avez choisi le <strong>paiement en ligne (HelloAsso)</strong>.</p>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 12px 0;">
            <p style="margin: 0 0 6px; color: #92400e; font-size: 13px;"><strong>⚠️ Attention au don pré-coché par HelloAsso</strong></p>
            <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">À la fin du paiement, HelloAsso propose une « contribution au fonctionnement » qui leur revient (et pas au SACCB). Elle est cochée par défaut. Pensez à la mettre à <strong>0&nbsp;€</strong> si vous voulez juste régler votre cotisation.</p>
          </div>
          <p style="color: #475569;">Une fois votre paiement validé, vous recevrez automatiquement un email de bienvenue avec votre code d'accès à l'espace membre.</p>
        `
        : `
          <p style="color: #475569; margin: 16px 0 8px;">Vous avez choisi le <strong>paiement par virement</strong>.</p>
          <p style="color: #475569;">Rapprochez-vous d'un membre du bureau au prochain entraînement pour finaliser votre règlement. Dès que le virement sera validé, vous recevrez un email de confirmation avec votre code d'accès.</p>
        `;
      const paymentBlockText = isOnline
        ? `Vous avez choisi le paiement en ligne (HelloAsso).\n\nATTENTION : à la fin du paiement, HelloAsso propose une contribution au fonctionnement qui leur est versée (pas au SACCB). Elle est cochée par défaut. Pensez à la mettre à 0 € si vous voulez juste régler votre cotisation.\n\nUne fois votre paiement validé, vous recevrez votre code d'accès par email.`
        : `Vous avez choisi le paiement par virement.\n\nRapprochez-vous d'un membre du bureau au prochain entraînement pour finaliser votre règlement. Vous recevrez votre code d'accès dès que le virement sera validé.`;

      sendBrevo(brevoKeyConfirm, {
        from: "SACCB <contact@saccb.fr>",
        headers: {
          "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        to: [email],
        subject: `📝 Votre inscription au SACCB a bien été enregistrée — saison ${yearLabel}`,
        text: `${greetingText}\n\nVotre inscription au SACCB pour la saison ${yearLabel} a bien été enregistrée. Elle est actuellement en attente de paiement.\n\n${paymentBlockText}\n\nÀ très bientôt sur les terrains 🏸\nLe bureau du SACCB\n\n--\nSACCB · Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 18px 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 14px;">
              <img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="background: white; border-radius: 10px; padding: 4px; display: block;" />
              <div>
                <h1 style="color: white; margin: 0; font-size: 20px;">SACCB</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 2px 0 0; font-size: 12px;">Sainte-Adresse Club de Compétition de Badminton</p>
              </div>
            </div>
            <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <p style="color: #475569; margin: 0 0 14px;">${greeting}</p>
              <p style="color: #475569; line-height: 1.6;">Votre inscription au SACCB pour la saison <strong>${yearLabel}</strong> a bien été enregistrée 🎉</p>
              <p style="color: #475569; line-height: 1.6;">Elle est actuellement <strong>en attente de paiement</strong>.</p>
              ${paymentBlockHtml}
              <p style="color: #94a3b8; font-size: 12px; margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.
              </p>
            </div>
          </div>
        `,
      }).then(async (res) => {
        await logEmailToHistory(supabaseAdmin, {
          type: "registration_pending",
          subject: `Inscription enregistrée — saison ${yearLabel}`,
          recipients: [email],
          status: res.ok ? "sent" : "failed",
        });
      }).catch(() => {});
    }

    // Webhook Google Sheets (fire and forget)
    const sheetsWebhook = Deno.env.get("SHEETS_WEBHOOK");
    if (sheetsWebhook) {
      fetch(sheetsWebhook, {
        method: "POST",
        body: JSON.stringify(currentData),
      }).catch(() => {});
    }

    return json({ ok: true, membreId: newMembre.id });
  }

  // ─── ACTION: Vérifier le statut de paiement d'un membre (retour HelloAsso) ───
  // ⚠️ SÉCURITÉ : cette action ne marque PLUS le paiement (l'ancienne version permettait
  // à n'importe qui de marquer un membre comme payé). Le paiement est uniquement validé
  // via le webhook HelloAsso (avec secret) ou manuellement par l'admin.
  // Cette action sert juste à vérifier l'état pour l'UX du retour HelloAsso.
  if (action === "mark_paid") {
    const membreId = String(body.membreId || "");
    if (!membreId) return json({ ok: false }, 400);

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];

    // On retourne juste le statut actuel (déjà payé ou pas), sans modification
    const membre = membres.find((m) => m.id === membreId);
    if (!membre) return json({ ok: false, reason: "Membre introuvable." });

    return json({ ok: true, paid: membre.ok === true });
  }


  // ─── ACTION: Sync Google Sheets (appelé depuis l'admin après saveDB) ───
  if (action === "sync_sheets") {
    // 🔒 SÉCURITÉ : Auth admin obligatoire (sinon n'importe qui peut spammer le webhook Sheets)
    const { data: dbDataSync } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!dbDataSync) return json({ ok: false }, 500);
    const dSync = dbDataSync.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, dSync);
    if (authError) return authError;

    const sheetsWebhook = Deno.env.get("SHEETS_WEBHOOK");
    if (sheetsWebhook && body.data) {
      fetch(sheetsWebhook, {
        method: "POST",
        body: JSON.stringify(body.data),
      }).catch(() => {});
    }
    return json({ ok: true });
  }

  // ─── ACTION: Inscription tournoi ───
  if (action === "register_tournoi") {
    // 🔒 SÉCURITÉ : rate limit pour empêcher le spam d'inscriptions tournoi
    if (isRegistrationRateLimited(ip)) {
      return json({ ok: false, reason: "Trop de tentatives d'inscription. Réessayez dans une heure." }, 429);
    }
    const tournoiId = sanitize(String(body.tournoiId || ""));
    const p1 = sanitize(String(body.p1 || ""));
    const p2 = sanitize(String(body.p2 || ""));
    // 🔒 SÉCURITÉ : auth membre obligatoire pour s'inscrire à un tournoi
    const memberEmail = sanitize(String(body.email || "")).toLowerCase();
    const memberCode = sanitize(String(body.code || ""));

    if (!tournoiId || !p1 || !p2) return json({ ok: false, reason: "Champs manquants." }, 400);
    if (p1.length < 2 || p2.length < 2) return json({ ok: false, reason: "Noms trop courts." }, 400);
    if (!memberEmail || !memberCode) return json({ ok: false, reason: "Vous devez être connecté pour vous inscrire à un tournoi." }, 401);

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    // 🔒 Vérifier que le membre existe ET qu'il a payé son adhésion
    const dbDataReg = data.data as Record<string, unknown>;
    const membresReg = (dbDataReg.membres || []) as Record<string, unknown>[];
    const membreReg = await findMembreByCredentials(membresReg, memberEmail, memberCode);
    if (!membreReg) return json({ ok: false, reason: "Identifiants incorrects." }, 401);
    if (membreReg.ok !== true) return json({ ok: false, reason: "Votre adhésion doit être validée pour vous inscrire à un tournoi." }, 403);

    const currentData = data.data as Record<string, unknown>;
    const tournois = (currentData.config_tournois || []) as Record<string, unknown>[];
    const inscrits = (currentData.inscrits_tournoi || []) as Record<string, unknown>[];

    const tournoi = tournois.find((t) => t.id === tournoiId);
    if (!tournoi) return json({ ok: false, reason: "Tournoi introuvable." });

    // Vérifier quota
    const tournoiInscrits = inscrits.filter((i) => i.tournoiId === tournoiId);
    if (tournoi.quota && tournoiInscrits.length >= (tournoi.quota as number)) {
      return json({ ok: false, reason: "Ce tournoi est complet !" });
    }

    // Covoiturage (optionnel)
    const covoRaw = body.covoiturage as Record<string, unknown> | undefined;
    const covoData = covoRaw && typeof covoRaw === "object" && Number(covoRaw.seats) > 0
      ? {
          seats: Math.min(Math.max(1, Number(covoRaw.seats)), 7),
          depart: covoRaw.depart ? String(covoRaw.depart).slice(0, 100) : undefined,
          contact: covoRaw.contact ? String(covoRaw.contact).slice(0, 100) : undefined,
        }
      : null;

    const newInscrit: Record<string, unknown> = {
      id: Date.now().toString(),
      tournoiId,
      joueurs: `${p1} / ${p2}`,
    };
    if (covoData) newInscrit.covoiturage = covoData;

    inscrits.push(newInscrit);
    currentData.inscrits_tournoi = inscrits;

    const { error: updateError } = await supabaseAdmin
      .from("saccb_db")
      .update({ data: currentData })
      .eq("id", 1);

    if (updateError) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const sheetsWebhook = Deno.env.get("SHEETS_WEBHOOK");
    if (sheetsWebhook) {
      fetch(sheetsWebhook, {
        method: "POST",
        body: JSON.stringify(currentData),
      }).catch(() => {});
    }

    return json({ ok: true });
  }

  // ─── ACTION: Notifier les adhérents par email ───
  if (action === "notify_membres") {
    const tournoiId = sanitize(String(body.tournoiId || ""));
    const tournoiName = sanitize(String(body.tournoiName || ""));
    const brevoKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoKey) {
      return json({ ok: false, reason: "Service email non configuré (BREVO_API_KEY manquant)." });
    }

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;

    // 🔒 SÉCURITÉ : Auth admin obligatoire pour empêcher le spam de masse
    const authError = await checkAdminAuth(body, currentData);
    if (authError) return authError;

    const membres = (currentData.membres || []) as Record<string, unknown>[];
    const tournois = (currentData.config_tournois || []) as Record<string, unknown>[];

    const tournoi = tournois.find((t) => t.id === tournoiId);
    if (!tournoi) return json({ ok: false, reason: "Tournoi introuvable." });

    // Récupère les membres ayant payé ET abonnés aux news (avec prénom pour personnalisation)
    const recipientsNotify = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
      .filter((r) => r.email);
    const emails = recipientsNotify.map((r) => r.email);

    if (emails.length === 0) {
      return json({ ok: false, reason: "Aucun adhérent actif trouvé." });
    }

    const dateStr = tournoi.dateLimit
      ? `Date limite d'inscription : ${tournoi.dateLimit}`
      : `Date du tournoi : ${tournoi.date}`;

    // 📧 Envoi INDIVIDUEL personnalisé (1 email par destinataire avec son prénom)
    let sentCount = 0;
    let lastError = "";
    for (const recipient of recipientsNotify) {
      const greetingN = recipient.prenom ? `Bonjour ${escapeHtml(recipient.prenom)},` : "Bonjour,";
      const greetingTextN = recipient.prenom ? `Bonjour ${recipient.prenom},` : "Bonjour,";
      const plainTextN = `${greetingTextN}\n\nUn nouveau tournoi vient d'être ajouté sur le site de l'association : ${tournoi.name}\n${dateStr}\n\nConnectez-vous à votre espace membre pour inscrire votre binôme : https://saccb.fr/#tournois\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;
      const sendRes = await sendBrevo(brevoKey, {
          from: "SACCB <contact@saccb.fr>",
          headers: {
            "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          to: [recipient.email],
          subject: recipient.prenom
            ? `${recipient.prenom}, nouveau tournoi : ${tournoi.name}`
            : `Nouveau tournoi : ${tournoi.name}`,
          text: plainTextN,
          html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
              <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
              <div>
                <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
              </div>
            </div>
            <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <p style="color: #475569; margin: 0 0 16px;">${greetingN}</p>
              <h2 style="color: #1e3a5f; margin-top: 0;">🏸 Nouveau tournoi disponible !</h2>
              <p style="color: #475569;">Un nouveau tournoi vient d'être ajouté sur le site de l'association :</p>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #1e3a5f;">${tournoi.name}</p>
                <p style="margin: 8px 0 0; color: #64748b;">${dateStr}</p>
                ${tournoi.type ? `<p style="margin: 4px 0 0; color: #64748b;">Type : Double ${tournoi.type}</p>` : ""}
              </div>
              <p style="color: #475569;">Connectez-vous à votre espace membre pour inscrire votre binôme.</p>
              <a href="https://saccb.fr/#tournois" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                Voir les tournois →
              </a>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; width: 100%;">
                <tr><td>
                  <p style="margin: 0; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains !</p>
                  <p style="margin: 4px 0 14px; color: #64748b; font-size: 13px;">Le bureau vous souhaite une excellente journée 🏸</p>
                  <p style="margin: 0 0 2px; color: #1e293b; font-size: 13px; font-weight: 600;">Hernan Camara <span style="color: #64748b; font-weight: 400;">· Président</span></p>
                  <p style="margin: 0 0 14px; color: #64748b; font-size: 12px; font-style: italic;">&amp; toute l'équipe du SACCB</p>
                  <table cellpadding="0" cellspacing="0" border="0"><tr>
                    <td style="vertical-align: middle; padding-right: 12px;"><img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" /></td>
                    <td style="vertical-align: middle;">
                      <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                      <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> &middot; <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                    </td>
                  </tr></table>
                  <p style="margin: 14px 0 0; color: #cbd5e1; font-size: 10px;">Vous recevez cet email car vous êtes membre du SACCB.</p>
                </td></tr>
              </table>
            </div>
          </div>
        `,
        });
      if (sendRes.ok) {
        sentCount++;
      } else {
        lastError = await sendRes.text().catch(() => "");
      }
      await sleep(EMAIL_THROTTLE_MS);
    }

    if (sentCount === 0) {
      return json({ ok: false, reason: "Aucun email envoyé. Erreur : " + lastError.slice(0, 200) });
    }

    await logEmailToHistory(supabaseAdmin, {
      type: "tournament_notification",
      subject: `Nouveau tournoi : ${tournoi.name}`,
      body: `Notification "nouveau tournoi" envoyée pour ${tournoi.name} (${tournoi.date || ""})`,
      recipients: emails,
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
      status: sentCount < emails.length ? "partial" : "sent",
      sentCount,
    });
    return json({ ok: true, sent: sentCount, total: emails.length });
  }

  // ─── ACTION: Notifier tous les anciens adhérents du début de nouvelle saison ───
  if (action === "notify_new_season") {
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;

    // 🔒 SÉCURITÉ : Auth admin obligatoire pour empêcher le spam de masse
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const membres = (d.membres || []) as Record<string, unknown>[];

    // Envoyer à tous les membres (anciens adhérents), peu importe newsOptIn (avec prénom pour personnalisation)
    const recipientsSeason = membres
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
      .filter((r) => r.email);
    const emails = recipientsSeason.map((r) => r.email);

    if (emails.length === 0) return json({ ok: false, reason: "Aucun adhérent trouvé." });

    // 📧 Envoi INDIVIDUEL personnalisé (1 email par destinataire avec son prénom)
    let sentCountSeason = 0;
    let lastErrorSeason = "";
    for (const recipient of recipientsSeason) {
      const greetingS = recipient.prenom ? `Bonjour ${escapeHtml(recipient.prenom)},` : "Bonjour,";
      const greetingTextS = recipient.prenom ? `Bonjour ${recipient.prenom},` : "Bonjour,";
      const plainTextS = `${greetingTextS}\n\nLa saison ${d.y1}-${d.y2} du SACCB est maintenant ouverte !\nLes places partent vite, alors ne tardez pas à renouveler votre adhésion.\n\nVotre code personnel vous permettra de vous reconnecter directement sur le site.\nSi vous l'avez oublié, cliquez sur "Code oublié ?" sur la page de connexion.\n\nJe renouvelle mon adhésion : https://saccb.fr/?member=1\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;
      const sendRes = await sendBrevo(brevoKey, {
          from: "SACCB <contact@saccb.fr>",
          headers: {
            "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          to: [recipient.email],
          subject: recipient.prenom
            ? `${recipient.prenom}, votre adhésion SACCB ${d.y1}–${d.y2}`
            : `Votre adhésion SACCB ${d.y1}–${d.y2}`,
          text: plainTextS,
          html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
              <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
              <div>
                <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
              </div>
            </div>
            <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <p style="color: #475569; margin: 0 0 16px;">${greetingS}</p>
              <h2 style="color: #1e3a5f; margin-top: 0;">🎉 La nouvelle saison est lancée !</h2>
              <p style="color: #475569;">
                La saison <strong>${d.y1}–${d.y2}</strong> du SACCB est maintenant ouverte !
                Les places partent vite, alors ne tardez pas à renouveler votre adhésion.
              </p>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">Votre code personnel vous permettra de vous reconnecter directement sur le site.</p>
                <p style="margin: 0; color: #64748b; font-size: 13px;">Si vous l'avez oublié, cliquez sur <strong>"Code oublié ?"</strong> sur la page de connexion.</p>
              </div>
              <a href="https://saccb.fr/?member=1" style="display: inline-block; background: #1e3a5f; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 8px;">
                🏸 Je renouvelle mon adhésion →
              </a>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; width: 100%;">
                <tr><td>
                  <p style="margin: 0; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains !</p>
                  <p style="margin: 4px 0 14px; color: #64748b; font-size: 13px;">Le bureau vous souhaite une excellente journée 🏸</p>
                  <p style="margin: 0 0 2px; color: #1e293b; font-size: 13px; font-weight: 600;">Hernan Camara <span style="color: #64748b; font-weight: 400;">· Président</span></p>
                  <p style="margin: 0 0 14px; color: #64748b; font-size: 12px; font-style: italic;">&amp; toute l'équipe du SACCB</p>
                  <table cellpadding="0" cellspacing="0" border="0"><tr>
                    <td style="vertical-align: middle; padding-right: 12px;"><img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" /></td>
                    <td style="vertical-align: middle;">
                      <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                      <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> &middot; <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </div>
          </div>
        `,
        });
      if (sendRes.ok) {
        sentCountSeason++;
      } else {
        lastErrorSeason = await sendRes.text().catch(() => "");
      }
      await sleep(EMAIL_THROTTLE_MS);
    }

    if (sentCountSeason === 0) {
      return json({ ok: false, reason: "Aucun email envoyé. Erreur : " + lastErrorSeason.slice(0, 200) });
    }

    await logEmailToHistory(supabaseAdmin, {
      type: "new_season",
      subject: `Nouvelle saison ${currentData.y1}–${currentData.y2}`,
      body: `Notification "nouvelle saison" envoyée aux anciens adhérents (renouvellement)`,
      recipients: emails,
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
      status: sentCountSeason < emails.length ? "partial" : "sent",
      sentCount: sentCountSeason,
    });
    return json({ ok: true, sent: sentCountSeason, total: emails.length });
  }

  // ─── ACTION: Rappels automatiques d'inscription (J-30 et J-15) ───
  if (action === "check_reminders") {
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "BREVO_API_KEY manquant." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;
    const inscCloseDate = String(d.insc_close_date || "");
    // ⚠️ Ne pas return ici : même sans date de fermeture saison, les rappels tournois doivent partir
    const todayTs = new Date(new Date().toISOString().slice(0, 10)).getTime();
    const parsedClose = inscCloseDate ? parseFlexibleDate(inscCloseDate) : null;
    const closeTs = parsedClose ? parsedClose.getTime() : NaN;
    const daysLeft = !isNaN(closeTs) ? Math.round((closeTs - todayTs) / (1000 * 60 * 60 * 24)) : NaN;

    const membres = (d.membres || []) as Record<string, unknown>[];

    // Membres non payés (inscrits mais pas encore réglé) — destinataires des rappels de réinscription
    // 🚪 On exclut ceux qui ont coché "je ne renouvelle pas" pour cette saison
    const currentSeasonKey = `${d.y1}-${d.y2}`;
    const unpaidRecipients = membres
      .filter((m) => m.ok !== true && String(m.renewalSkippedFor || "") !== currentSeasonKey)
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
      .filter((r) => r.email);
    const unpaidEmails = unpaidRecipients.map((r) => r.email);

    // Membres payés ayant accepté les news — destinataires des rappels tournois
    // On garde aussi l'id et la liste des tournois ignorés pour pouvoir filtrer
    // les rappels tournois (le membre a dit "pas intéressé" pour ce tournoi)
    const newsRecipients = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
      .map((m) => ({
        email: String(m.email || ""),
        prenom: extractFirstName(String(m.nom || "")),
        membreId: String(m.id || ""),
        tournoisIgnored: Array.isArray(m.tournoisIgnored) ? (m.tournoisIgnored as string[]) : [],
      }))
      .filter((r) => r.email);
    const newsEmails = newsRecipients.map((r) => r.email);

    const results: Record<string, unknown> = {};

    // ── Rappels fermeture des inscriptions saison (J-30 / J-15 / J-5 / J-1) ──
    // → envoyé aux membres NON PAYÉS pour les inciter à régler avant la date limite
    // (skippé si pas de date de fermeture configurée OU si seasonRemindersDisabled)
    const remindersDisabled = d.seasonRemindersDisabled === true;
    if (!remindersDisabled && !isNaN(daysLeft) && (daysLeft === 30 || daysLeft === 15 || daysLeft === 5 || daysLeft === 1)) {
      if (unpaidEmails.length > 0) {
        const closeFormatted = parsedClose ? parsedClose.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : inscCloseDate;
        const isUrgent = daysLeft <= 5;
        // Sujets sobres et personnels (= moins classés en Promotions par Gmail)
        const headingLabel = daysLeft === 1 ? "🚨 Dernière chance — plus que 24H !" : `⏰ Plus que ${daysLeft} jours !`;
        // 📧 Envoi INDIVIDUEL personnalisé (1 email par destinataire avec son prénom)
        for (const recipient of unpaidRecipients) {
          const greeting = recipient.prenom ? `Bonjour ${escapeHtml(recipient.prenom)},` : "Bonjour,";
          const greetingText = recipient.prenom ? `Bonjour ${recipient.prenom},` : "Bonjour,";
          // Sujet personnalisé + préfixe selon l'urgence
          const subjectPrefix = isUrgent ? "🚨 URGENT — " : "📢 ";
          const subjectLabel = subjectPrefix + (recipient.prenom
            ? `${recipient.prenom}, votre adhésion SACCB ${daysLeft === 1 ? "expire demain" : `expire dans ${daysLeft} jours`}`
            : `Votre adhésion SACCB ${daysLeft === 1 ? "expire demain" : `expire dans ${daysLeft} jours`}`);
          const closeFormattedSafe = closeFormatted;
          const plainText = `${greetingText}\n\nVotre adhésion au SACCB pour la saison ${d.y1}-${d.y2} n'est pas encore finalisée.\nLa date limite de paiement est le ${closeFormattedSafe}.\n\n${daysLeft === 1 ? "C'est votre dernière chance ! Pensez à régler votre cotisation dès aujourd'hui." : "Rapprochez-vous de Hernan au prochain entraînement pour régler votre cotisation."}\n\nFinaliser mon adhésion : https://saccb.fr/?member=1\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;
          await sendBrevo(brevoKey, {
              from: "SACCB <contact@saccb.fr>",
              headers: {
                "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
              to: [recipient.email],
              subject: subjectLabel,
              text: plainText,
              html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${isUrgent ? "#b91c1c" : "#1e3a5f"}; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
                  <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
                  <div>
                    <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                    <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
                  </div>
                </div>
                <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                  ${isUrgent
                    ? '<div style="display:inline-block;background:#fee2e2;color:#991b1b;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">⚠️ Annonce importante</div>'
                    : '<div style="display:inline-block;background:#dbeafe;color:#1e3a5f;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">📢 Annonce</div>'}
                  <p style="color: #475569; margin: 0 0 16px;">${greeting}</p>
                  <h2 style="color: ${isUrgent ? "#b91c1c" : "#1e3a5f"}; margin-top: 0;">${headingLabel}</h2>
                  <p style="color: #475569;">Votre adhésion au SACCB pour la saison ${d.y1}–${d.y2} n'est pas encore finalisée.</p>
                  <p style="color: #475569;">La date limite de paiement est le <strong>${closeFormatted}</strong>. Passé cette date, votre inscription sera annulée automatiquement.</p>
                  ${daysLeft === 1
                    ? `<p style="color: #b91c1c; font-weight: bold;">⚠️ C'est votre dernière chance ! Pensez à régler votre cotisation dès aujourd'hui.</p>`
                    : `<p style="color: #475569;">Rapprochez-vous de <strong>Hernan</strong> au prochain entraînement pour régler votre cotisation.</p>`
                  }
                  <a href="https://saccb.fr/?member=1" style="display: inline-block; background: ${isUrgent ? "#b91c1c" : "#1e3a5f"}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                    Finaliser mon adhésion →
                  </a>
                  <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; width: 100%;">
                    <tr><td>
                      <p style="margin: 0; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains !</p>
                      <p style="margin: 4px 0 14px; color: #64748b; font-size: 13px;">Le bureau vous souhaite une excellente journée 🏸</p>
                      <p style="margin: 0 0 2px; color: #1e293b; font-size: 13px; font-weight: 600;">Hernan Camara <span style="color: #64748b; font-weight: 400;">· Président</span></p>
                      <p style="margin: 0 0 14px; color: #64748b; font-size: 12px; font-style: italic;">&amp; toute l'équipe du SACCB</p>
                      <table cellpadding="0" cellspacing="0" border="0"><tr>
                        <td style="vertical-align: middle; padding-right: 12px;"><img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" /></td>
                        <td style="vertical-align: middle;">
                          <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                          <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                          <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> &middot; <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                        </td>
                      </tr></table>
                      <p style="margin: 14px 0 0; color: #cbd5e1; font-size: 10px;">Vous recevez cet email car vous avez une inscription en attente de paiement au SACCB.</p>
                    </td></tr>
                  </table>
                </div>
              </div>
            `,
            }).catch(() => {});
          await sleep(EMAIL_THROTTLE_MS);
        }
        results.season_reminder = { sent: unpaidEmails.length, daysLeft };
      }
    }

    // ── Suppression des non-payés après fermeture ──
    // (skippé si réouverture temporaire — sinon on supprimerait des adhérents existants
    //  qui n'avaient rien demandé)
    if (!remindersDisabled && !isNaN(daysLeft) && daysLeft < 0) {
      const before = membres.length;
      const kept = membres.filter((m) => m.ok === true);
      const removed = membres.filter((m) => m.ok !== true);
      if (removed.length > 0) {
        // Sauvegarder les anciens membres avant suppression
        const formerMembers = ((d.formerMembers || []) as Record<string, unknown>[]);
        const nowISO = new Date().toISOString();
        const saison = `${d.y1}-${d.y2}`;
        for (const m of removed) {
          formerMembers.push({
            nom: String(m.nom || ""),
            email: String(m.email || ""),
            type: String(m.type || "Adulte"),
            removedAt: nowISO,
            saison,
          });
        }
        d.formerMembers = formerMembers;
        d.membres = kept;
        d.insc_open = false;
        await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
        results.cleanup = { removed: removed.length };
      }
    }

    // ── Si réouverture temporaire arrivée à terme : juste fermer les inscriptions ──
    // (sans supprimer personne, ni envoyer de rappel)
    if (remindersDisabled && !isNaN(daysLeft) && daysLeft < 0 && d.insc_open === true) {
      d.insc_open = false;
      d.seasonRemindersDisabled = false; // on désactive le flag aussi
      await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
      results.tempReopenClosed = true;
    }

    // ── Rappels tournois (J-30 / J-15 / J-5 / J-1 avant dateLimit) ──
    const tournois = (d.config_tournois || []) as Record<string, unknown>[];
    const inscritsTournoi = (d.inscrits_tournoi || []) as Record<string, unknown>[];
    const tournoiRemindersSent: string[] = [];
    for (const t of tournois) {
      const dateLimit = String(t.dateLimit || t.date || "");
      if (!dateLimit) continue;
      const parsedT = parseFlexibleDate(dateLimit);
      if (!parsedT) continue; // date non parsable → on skip ce tournoi
      const tTs = parsedT.getTime();
      const tDaysLeft = Math.round((tTs - todayTs) / (1000 * 60 * 60 * 24));
      if (tDaysLeft !== 30 && tDaysLeft !== 15 && tDaysLeft !== 5 && tDaysLeft !== 1) continue;

      // 🎯 Exclure :
      //  - les membres déjà inscrits à CE tournoi (inutile de leur envoyer un rappel)
      //  - les membres qui ont coché "pas intéressé(e)" sur ce tournoi
      const tournoiId = String(t.id || "");
      const inscritsCeTournoi = inscritsTournoi.filter((i) => i.tournoiId === tournoiId);
      const inscritsNoms = inscritsCeTournoi
        .map((i) => String(i.joueurs || "").toLowerCase())
        .join(" | ");
      const newsRecipientsForThisT = newsRecipients.filter((r) => {
        // 🔕 Filtre 1 : pas intéressé(e) explicite
        if (r.tournoisIgnored.includes(tournoiId)) return false;
        // Filtre 2 : déjà inscrit (basé sur le prénom)
        if (!r.prenom) return true; // si pas de prénom, on ne peut pas matcher → on garde par sécurité
        const nameLower = r.prenom.toLowerCase();
        return !inscritsNoms.includes(nameLower);
      });

      if (newsRecipientsForThisT.length === 0) continue;

      const dateFormatted = parsedT.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      const tIsUrgent = tDaysLeft <= 5;
      const tHeading = tDaysLeft === 1 ? `Dernière chance — plus que 24H !` : `Plus que ${tDaysLeft} jours !`;

      // 📧 Envoi INDIVIDUEL personnalisé (1 email par destinataire avec son prénom)
      // Exclut les membres déjà inscrits à ce tournoi
      for (const recipient of newsRecipientsForThisT) {
        const greetingT = recipient.prenom ? `Bonjour ${escapeHtml(recipient.prenom)},` : "Bonjour,";
        const greetingTextT = recipient.prenom ? `Bonjour ${recipient.prenom},` : "Bonjour,";
        // Sujet personnalisé : 'Marie, inscription au tournoi X' au lieu de '🚨 Tournoi X — plus que 24H'
        const tSubject = recipient.prenom
          ? `${recipient.prenom}, inscription au tournoi ${t.name} (${tDaysLeft === 1 ? "demain" : `dans ${tDaysLeft} jours`})`
          : `Inscription au tournoi ${t.name} (${tDaysLeft === 1 ? "demain" : `dans ${tDaysLeft} jours`})`;
        const plainTextT = `${greetingTextT}\n\nLa date limite d'inscription pour le tournoi "${t.name}" approche !\nDate limite : ${dateFormatted}\n${tDaysLeft === 1 ? "C'est votre dernière chance pour vous inscrire !" : `Plus que ${tDaysLeft} jours.`}\n\nVoir les tournois : https://saccb.fr/#tournois\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;
        await sendBrevo(brevoKey, {
            from: "SACCB <contact@saccb.fr>",
            headers: {
              "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            to: [recipient.email],
            subject: tSubject,
            text: plainTextT,
            html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: ${tIsUrgent ? "#b91c1c" : "#1e3a5f"}; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
                <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
                <div>
                  <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
                </div>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                <p style="color: #475569; margin: 0 0 16px;">${greetingT}</p>
                <h2 style="color: ${tIsUrgent ? "#b91c1c" : "#1e3a5f"}; margin-top: 0;">${tHeading}</h2>
                <p style="color: #475569;">La date limite d'inscription pour le tournoi <strong>${t.name}</strong> approche !</p>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1e3a5f;">${t.name}</p>
                  <p style="margin: 8px 0 0; color: #64748b;">📅 Date limite : <strong>${dateFormatted}</strong></p>
                  ${t.type ? `<p style="margin: 4px 0 0; color: #64748b;">Type : Double ${t.type}</p>` : ""}
                </div>
                <a href="https://saccb.fr/#tournois" style="display: inline-block; background: ${tIsUrgent ? "#b91c1c" : "#1e3a5f"}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                  Voir les tournois →
                </a>
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; width: 100%;">
                  <tr><td>
                    <p style="margin: 0; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains !</p>
                    <p style="margin: 4px 0 14px; color: #64748b; font-size: 13px;">Le bureau vous souhaite une excellente journée 🏸</p>
                    <p style="margin: 0 0 2px; color: #1e293b; font-size: 13px; font-weight: 600;">Hernan Camara <span style="color: #64748b; font-weight: 400;">· Président</span></p>
                    <p style="margin: 0 0 14px; color: #64748b; font-size: 12px; font-style: italic;">&amp; toute l'équipe du SACCB</p>
                    <table cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="vertical-align: middle; padding-right: 12px;"><img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" /></td>
                      <td style="vertical-align: middle;">
                        <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                        <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                        <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> &middot; <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                      </td>
                    </tr></table>
                    <p style="margin: 14px 0 0; color: #cbd5e1; font-size: 10px;">Vous recevez cet email car vous avez accepté les news du SACCB.</p>
                  </td></tr>
                </table>
              </div>
            </div>
          `,
          }).catch(() => {});
        await sleep(EMAIL_THROTTLE_MS);
      }
      tournoiRemindersSent.push(String(t.name));
    }
    if (tournoiRemindersSent.length > 0) results.tournoi_reminders = tournoiRemindersSent;

    // ── Fermeture automatique des tournois dont la date limite est dépassée ──
    let tournoisUpdated = false;
    for (const t of tournois) {
      const dateLimit = String(t.dateLimit || t.date || "");
      if (!dateLimit || t.closed) continue;
      const parsedT = parseFlexibleDate(dateLimit);
      if (!parsedT) continue;
      const tDaysLeft = Math.round((parsedT.getTime() - todayTs) / (1000 * 60 * 60 * 24));
      if (tDaysLeft < 0) {
        t.closed = true;
        tournoisUpdated = true;
      }
    }
    if (tournoisUpdated) {
      d.config_tournois = tournois;
      await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
      results.tournois_closed = tournois.filter((t) => t.closed).map((t) => t.name);
    }

    return json({ ok: true, ...results });
  }

  // ─── ACTION: Code oublié — RÉINITIALISE le code (ne le récupère plus, car hashé en base) ───
  if (action === "forgot_code") {
    // 🔒 SÉCURITÉ : rate limit strict pour empêcher l'énumération d'emails
    if (isForgotRateLimited(ip)) {
      return json({ ok: false, reason: "Trop de demandes. Réessayez dans une heure." }, 429);
    }

    const email = sanitize(String(body.email || "")).toLowerCase();
    if (!isValidEmail(email)) return json({ ok: false, reason: "Email invalide." }, 400);

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];

    // ⚠️ Pas de filtre m.ok === true ici : un adhérent doit pouvoir récupérer son code
    // même s'il n'a pas encore (re)payé son adhésion (sinon il ne peut pas se reconnecter pour renouveler)
    const membreIdx = membres.findIndex(
      (m) => String(m.email || "").toLowerCase() === email
    );
    const membre = membreIdx !== -1 ? membres[membreIdx] : undefined;

    // On répond toujours ok:true pour ne pas révéler si l'email existe
    if (membre) {
      // 🔒 SÉCURITÉ : on génère un NOUVEAU code aléatoire, on le hash en base, on l'envoie en clair
      // Plus jamais de récupération de l'ancien code (impossible car hashé)
      const newPlainCode = String(Math.floor(100000 + Math.random() * 900000)); // 6 chiffres
      // 🔔 codeJustReset: flag pour proposer à l'adhérent de personnaliser le code dès sa prochaine connexion
      membres[membreIdx] = { ...membre, code: await hashCode(newPlainCode), codeJustReset: true };
      currentData.membres = membres;
      await supabaseAdmin.from("saccb_db").update({ data: currentData }).eq("id", 1);
      // Remplacement pour le template HTML ci-dessous
      (membre as Record<string, unknown>).code = newPlainCode;
      await sendBrevo(brevoKey, {
          from: "SACCB <contact@saccb.fr>",
          headers: {
            "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          to: [email],
          subject: "🔑 Votre code personnel SACCB",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
                <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
                <div>
                  <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
                </div>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1e3a5f; margin-top: 0;">Réinitialisation de code</h2>
                <p style="color: #475569;">Bonjour <strong>${membre.nom}</strong>,</p>
                <p style="color: #475569;">Vous avez demandé à réinitialiser votre code personnel. Voici votre <strong>nouveau code</strong> :</p>
                <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center;">
                  <p style="margin: 0 0 8px; color: #92400e; font-size: 13px; font-weight: bold;">🔑 Votre nouveau code personnel</p>
                  <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${membre.code}</p>
                </div>
                <p style="color: #64748b; font-size: 13px;">Utilisez ce nouveau code avec votre email pour vous connecter à votre espace membre sur saccb.fr. Vous pourrez le modifier ensuite depuis votre espace.</p>
                <a href="https://saccb.fr" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                  Se connecter →
                </a>
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; width: 100%;">
                  <tr><td>
                    <p style="margin: 0; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains !</p>
                    <p style="margin: 4px 0 14px; color: #64748b; font-size: 13px;">Le bureau vous souhaite une excellente journée 🏸</p>
                    <p style="margin: 0 0 2px; color: #1e293b; font-size: 13px; font-weight: 600;">Hernan Camara <span style="color: #64748b; font-weight: 400;">· Président</span></p>
                    <p style="margin: 0 0 14px; color: #64748b; font-size: 12px; font-style: italic;">&amp; toute l'équipe du SACCB</p>
                    <table cellpadding="0" cellspacing="0" border="0"><tr>
                      <td style="vertical-align: middle; padding-right: 12px;"><img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" /></td>
                      <td style="vertical-align: middle;">
                        <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                        <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                        <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> &middot; <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                      </td>
                    </tr></table>
                    <p style="margin: 14px 0 0; color: #cbd5e1; font-size: 10px;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.</p>
                  </td></tr>
                </table>
              </div>
            </div>
          `,
        }).catch(() => {});

      // 📝 Logging dans l'historique des emails (best-effort)
      await logEmailToHistory(supabaseAdmin, {
        type: "code_forgot",
        subject: "🔑 Votre code personnel SACCB",
        body: `Réinitialisation du code suite à un "Code oublié ?" pour ${membre.nom}`,
        recipients: [email],
        sentBy: "system",
      });
    }

    return json({ ok: true });
  }

  // ─── ACTION: Envoyer un rappel de paiement individuel a un adherent — AUTH ADMIN ───
  if (action === "admin_send_payment_reminder") {
    const membreId = String(body.membreId || "");
    if (!membreId) return json({ ok: false, reason: "membreId manquant." }, 400);

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const membres = (d.membres || []) as Record<string, unknown>[];
    const membre = membres.find((m) => m.id === membreId);
    if (!membre) return json({ ok: false, reason: "Adhérent introuvable." });
    if (membre.ok === true) return json({ ok: false, reason: "Cet adhérent est déjà à jour de cotisation." });
    const email = String(membre.email || "");
    if (!email) return json({ ok: false, reason: "Adhérent sans email." });

    const inscCloseDate = String(d.insc_close_date || "");
    const closeFormatted = inscCloseDate
      ? new Date(inscCloseDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const prenom = extractFirstName(String(membre.nom || ""));
    const greeting = prenom ? `Bonjour ${escapeHtml(prenom)},` : "Bonjour,";
    const greetingText = prenom ? `Bonjour ${prenom},` : "Bonjour,";
    const y1 = d.y1, y2 = d.y2;

    const sendRes = await sendBrevo(brevoKey, {
      from: "SACCB <contact@saccb.fr>",
      headers: {
        "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      to: [email],
      subject: prenom
        ? `🚨 URGENT — ${prenom}, finalisez votre adhésion SACCB`
        : `🚨 URGENT — Finalisez votre adhésion SACCB`,
      text: `${greetingText}\n\nVotre adhésion au SACCB pour la saison ${y1}–${y2} n'a pas encore été finalisée.\n\n${inscCloseDate ? `Pour pouvoir continuer à jouer, le règlement doit être effectué avant le ${closeFormatted}.\n\n` : ""}Vous pouvez régler en ligne via HelloAsso ou par virement à Hernan. Toutes les infos sont dans votre espace membre.\n\nAccéder à votre espace : https://saccb.fr/?member=1\n\nSi vous avez un souci ou souhaitez en discuter, répondez simplement à cet email.\n\n--\nLe bureau du SACCB\ncontact@saccb.fr · saccb.fr`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">SACCB</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">⚠️ Rappel cotisation</p>
          </div>
          <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
            <div style="display:inline-block;background:#fee2e2;color:#991b1b;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">⚠️ Annonce importante</div>
            <p style="color: #475569; margin: 0 0 16px;">${greeting}</p>
            <p style="color: #475569;">Votre adhésion au SACCB pour la saison <strong>${y1}–${y2}</strong> n'a pas encore été finalisée.</p>
            ${inscCloseDate ? `<div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 16px 0;"><p style="margin: 0; color: #92400e; font-size: 14px;">⏰ Pour pouvoir continuer à jouer, le règlement doit être effectué avant le <strong>${closeFormatted}</strong>.</p></div>` : ""}
            <p style="color: #475569;">Vous pouvez :</p>
            <ul style="color: #475569; padding-left: 20px;">
              <li>💳 Régler en ligne via <strong>HelloAsso</strong></li>
              <li>💵 Faire un <strong>virement à Hernan</strong></li>
            </ul>
            <p style="color: #475569;">Toutes les infos sont dans votre espace membre.</p>
            <a href="https://saccb.fr/?member=1" style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; margin-top: 8px;">
              🔑 Accéder à mon espace →
            </a>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
              Si vous avez un souci ou souhaitez en discuter, répondez simplement à cet email.
            </p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 14px; width: 100%;">
              <tr><td>
                <p style="margin: 0; color: #1e3a5f; font-size: 13px; font-weight: 600;">À très bientôt sur les terrains !</p>
                <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Le bureau du SACCB 🏸</p>
              </td></tr>
            </table>
          </div>
        </div>
      `,
    });
    if (!sendRes.ok) return json({ ok: false, reason: "Erreur d'envoi : " + sendRes.status });
    await logEmailToHistory(supabaseAdmin, {
      type: "payment_reminder",
      subject: prenom ? `${prenom}, pensez à finaliser votre adhésion SACCB` : `Pensez à finaliser votre adhésion SACCB`,
      body: `Rappel paiement adhésion saison ${y1}–${y2} envoyé à ${membre.nom}`,
      recipients: [email],
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
    });
    return json({ ok: true });
  }

  // ─── ACTION: Réinitialiser le code d'un adhérent depuis l'admin ───
  // Génère un nouveau code aléatoire, le hash, l'envoie par email et lève le flag codeJustReset
  // 🔓 Déblocage manuel d'un compte verrouillé après 5 échecs (admin only)
  if (action === "admin_unlock_account") {
    const targetEmail = sanitize(String(body.targetEmail || "")).toLowerCase();
    if (!targetEmail) return json({ ok: false, reason: "Email cible manquant." }, 400);
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const currentData = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, currentData);
    if (authError) return authError;
    clearLoginFailures(targetEmail);
    return json({ ok: true });
  }

  // 🔍 Récupère la liste des comptes actuellement bloqués (admin only)
  if (action === "admin_list_locked_accounts") {
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const currentData = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, currentData);
    if (authError) return authError;
    const now = Date.now();
    const locked: { email: string; minutesLeft: number }[] = [];
    for (const [email, e] of accountLockMap.entries()) {
      if (e.lockUntil > now) {
        locked.push({ email, minutesLeft: Math.ceil((e.lockUntil - now) / 60_000) });
      }
    }
    return json({ ok: true, locked });
  }

  if (action === "admin_reset_code") {
    const membreId = String(body.membreId || "");
    if (!membreId) return json({ ok: false, reason: "membreId manquant." }, 400);

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;

    // 🔒 SÉCURITÉ : Auth admin obligatoire
    const authError = await checkAdminAuth(body, currentData);
    if (authError) return authError;

    const membres = (currentData.membres || []) as Record<string, unknown>[];
    const membreIdx = membres.findIndex((m) => m.id === membreId);
    if (membreIdx === -1) return json({ ok: false, reason: "Adhérent introuvable." });

    const membre = membres[membreIdx];
    const email = String(membre.email || "");
    if (!email) return json({ ok: false, reason: "Adhérent sans email." });

    // 🔒 Nouveau code aléatoire à 6 chiffres + hash + flag codeJustReset
    const newPlainCode = String(Math.floor(100000 + Math.random() * 900000));
    membres[membreIdx] = { ...membre, code: await hashCode(newPlainCode), codeJustReset: true };
    currentData.membres = membres;
    const { error: saveErr } = await supabaseAdmin.from("saccb_db").update({ data: currentData }).eq("id", 1);
    if (saveErr) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);

    // Envoi email avec le nouveau code en clair
    await sendBrevo(brevoKey, {
      from: "SACCB <contact@saccb.fr>",
      headers: {
        "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      to: [email],
      subject: "🔑 Votre code SACCB a été réinitialisé",
      text: `Bonjour ${membre.nom},\n\nVotre code personnel SACCB vient d'être réinitialisé par un membre du bureau.\n\nNouveau code : ${newPlainCode}\n\nUtilisez ce code avec votre email pour vous connecter à votre espace membre sur saccb.fr. Une fois connecté, il vous sera proposé de personnaliser ce code.\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
          </div>
          <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e3a5f; margin-top: 0;">Code réinitialisé</h2>
            <p style="color: #475569;">Bonjour <strong>${escapeHtml(String(membre.nom))}</strong>,</p>
            <p style="color: #475569;">Votre code personnel SACCB vient d'être réinitialisé par un membre du bureau. Voici votre <strong>nouveau code</strong> :</p>
            <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center;">
              <p style="margin: 0 0 8px; color: #92400e; font-size: 13px; font-weight: bold;">🔑 Nouveau code personnel</p>
              <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${newPlainCode}</p>
            </div>
            <p style="color: #64748b; font-size: 13px;">Utilisez ce code avec votre email pour vous connecter à votre espace membre. Vous pourrez le personnaliser dès la prochaine connexion.</p>
            <a href="https://saccb.fr" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">Se connecter →</a>
          </div>
        </div>
      `,
    });

    await logEmailToHistory(supabaseAdmin, {
      type: "code_reset",
      subject: "🔑 Votre code SACCB a été réinitialisé",
      body: `Réinitialisation du code de ${membre.nom} par un admin`,
      recipients: [email],
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
    });
    return json({ ok: true });
  }

  // ─── ACTION: Changer le code personnel d'un membre ───
  if (action === "change_code") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const oldCode = sanitize(String(body.oldCode || ""));
    const newCode = sanitize(String(body.newCode || ""));

    if (!email || !oldCode || !newCode) return json({ ok: false, reason: "Champs manquants." }, 400);
    if (newCode.length < 4) return json({ ok: false, reason: "Le mot de passe doit contenir au moins 4 caractères." }, 400);

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];
    const adminCredentials = ((currentData.adminCredentials || []) as { email: string; code: string }[]);

    // Vérifier d'abord dans adminCredentials (avec verifyCode pour gérer hash + clair)
    const adminCred = await findAdminCredByCredentials(adminCredentials, email, oldCode);
    // Vérifier ensuite dans les adhérents
    const membre = await findMembreByCredentials(membres, email, oldCode);

    if (!adminCred && !membre) return json({ ok: false, reason: "Email ou code actuel incorrect." });

    // 🔒 SÉCURITÉ : hasher le nouveau code avant stockage
    const hashedNew = await hashCode(newCode);
    if (membre) {
      membre.code = hashedNew;
      // Si l'utilisateur change son code après un reset → on retire le flag (déjà retiré au verify mais ceinture-bretelles)
      if ((membre as Record<string, unknown>).codeJustReset) delete (membre as Record<string, unknown>).codeJustReset;
    }
    if (adminCred) adminCred.code = hashedNew;

    currentData.membres = membres;
    currentData.adminCredentials = adminCredentials;

    const { error: updateError } = await supabaseAdmin
      .from("saccb_db")
      .update({ data: currentData })
      .eq("id", 1);

    if (updateError) return json({ ok: false, reason: "Erreur serveur." }, 500);

    return json({ ok: true });
  }

  // ─── ACTION: Envoyer l'email de confirmation à un membre (virement validé par admin) ───
  if (action === "send_confirmation") {
    const membreId = String(body.membreId || "");
    if (!membreId) return json({ ok: false, reason: "membreId manquant." }, 400);

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;

    // 🔒 SÉCURITÉ : Auth admin obligatoire
    const authError = await checkAdminAuth(body, currentData);
    if (authError) return authError;

    const membres = (currentData.membres || []) as Record<string, unknown>[];
    const membre = membres.find((m) => m.id === membreId && m.ok === true);

    if (!membre) return json({ ok: false, reason: "Membre introuvable ou paiement non validé." });

    const prixMap: Record<string, number> = { Adulte: 50, Etudiant: 30 };
    const prix = prixMap[String(membre.type)] ?? 50;
    const membreCode = ""; // Codes hashés en base : on n'affiche plus le code dans l'email

    const sendRes = await sendBrevo(brevoKey, {
        from: "SACCB <contact@saccb.fr>",
        headers: {
          "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        to: [String(membre.email)],
        subject: "🎉 Paiement confirmé — Bienvenue au SACCB !",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
              <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
              <div>
                <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
              </div>
            </div>
            <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <div style="display:inline-block;background:#d1fae5;color:#065f46;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">🎉 Bonne nouvelle</div>
              <h2 style="color: #16a34a; margin-top: 0;">✅ Paiement confirmé !</h2>
              <p style="color: #475569;">Bonjour <strong>${membre.nom}</strong>,</p>
              <p style="color: #475569;">Votre paiement a bien été reçu. Votre adhésion au SACCB pour la saison ${currentData.y1}–${currentData.y2} est désormais <strong>validée</strong>.</p>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px; color: #64748b; font-size: 13px;">RÉCAPITULATIF</p>
                <p style="margin: 4px 0; color: #1e293b;"><strong>Nom :</strong> ${membre.nom}</p>
                <p style="margin: 4px 0; color: #1e293b;"><strong>Type :</strong> ${membre.type}</p>
                <p style="margin: 4px 0; color: #1e293b;"><strong>Montant réglé :</strong> ${prix}€</p>
              </div>
              <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 6px; color: #92400e; font-size: 13px; font-weight: bold;">🔑 Connexion à votre espace membre</p>
                <p style="margin: 0; color: #92400e; font-size: 13px;">Utilisez le code personnel que vous avez choisi à l'inscription pour vous connecter sur saccb.fr. Si vous l'avez oublié, cliquez sur « Code oublié ? » sur la page de connexion.</p>
              </div>

              <!-- ✨ Bloc "Tout ce que vous pouvez faire sur le site" -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 14px; color: #1e3a5f; font-size: 16px;">✨ Ce que vous pouvez faire sur le site</h3>
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size: 13px; color: #334155;">
                  <tr><td style="padding: 6px 0; vertical-align: top; width: 30px;">🏸</td><td style="padding: 6px 0;"><strong>Vous inscrire aux tournois</strong> en quelques clics avec votre binôme</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">📊</td><td style="padding: 6px 0;"><strong>Voir vos statistiques perso</strong> : participations, podiums, équipiers</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">🏆</td><td style="padding: 6px 0;"><strong>Consulter le classement des binômes</strong> de la saison et l'historique des tournois passés</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">📅</td><td style="padding: 6px 0;"><strong>Ajouter les tournois</strong> directement dans votre agenda (Google Calendar, iPhone, Outlook)</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">📋</td><td style="padding: 6px 0;"><strong>Lire les comptes-rendus</strong> des réunions et AG (saison actuelle + années précédentes)</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">📊</td><td style="padding: 6px 0;"><strong>Voter aux sondages</strong> du bureau et participer aux décisions de l'association</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">💡</td><td style="padding: 6px 0;"><strong>Proposer vos questions et idées</strong> pour préparer la prochaine assemblée générale</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">📝</td><td style="padding: 6px 0;"><strong>Générer votre procuration AG</strong> en 1 clic si vous ne pouvez pas être présent(e)</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">🔑</td><td style="padding: 6px 0;"><strong>Modifier votre code personnel</strong> à tout moment depuis votre espace</td></tr>
                  <tr><td style="padding: 6px 0; vertical-align: top;">📱</td><td style="padding: 6px 0;"><strong>Installer le site comme une app</strong> sur votre téléphone — voir le bloc ci-dessous 👇</td></tr>
                </table>
              </div>

              <!-- 📱 Installer l'app sur téléphone -->
              <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 12px; color: #6b21a8; font-size: 16px;">📱 Installer SACCB sur votre téléphone</h3>
                <p style="margin: 0 0 14px; color: #475569; font-size: 13px;">Comme une vraie app : icône sur l'écran d'accueil, ouverture en plein écran, et toujours à jour automatiquement.</p>

                <!-- iPhone -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 10px;">
                  <p style="margin: 0 0 8px; color: #1e3a5f; font-size: 14px; font-weight: bold;">🍎 iPhone (Safari)</p>
                  <ol style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.7;">
                    <li>Ouvrez <strong>saccb.fr</strong> dans <strong>Safari</strong> (pas Chrome)</li>
                    <li>Appuyez sur le bouton <strong>Partager</strong> (carré avec flèche ↑) en bas de l'écran</li>
                    <li>Faites défiler et touchez <strong>"Sur l'écran d'accueil"</strong></li>
                    <li>Touchez <strong>"Ajouter"</strong> en haut à droite ✅</li>
                  </ol>
                </div>

                <!-- Android -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
                  <p style="margin: 0 0 8px; color: #1e3a5f; font-size: 14px; font-weight: bold;">🤖 Android (Chrome)</p>
                  <ol style="margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.7;">
                    <li>Ouvrez <strong>saccb.fr</strong> dans <strong>Chrome</strong></li>
                    <li>Appuyez sur le menu <strong>⋮</strong> (3 points) en haut à droite</li>
                    <li>Touchez <strong>"Installer l'application"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong></li>
                    <li>Confirmez ✅</li>
                  </ol>
                </div>
              </div>

              ${currentData.whatsappLink ? `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <p style="margin: 0 0 10px; color: #166534; font-size: 14px;">📱 Rejoignez aussi le groupe WhatsApp de l'association pour échanger entre adhérents :</p>
                <a href="${currentData.whatsappLink}" style="display: inline-flex; align-items: center; gap: 8px; background: #25D366; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                  💬 Rejoindre le groupe WhatsApp
                </a>
              </div>
              ` : ""}

              <div style="text-align: center; margin: 24px 0 16px;">
                <a href="https://saccb.fr/?member=1" style="display: inline-block; background: #1e3a5f; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                  🚀 Accéder à mon espace membre →
                </a>
              </div>

              <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; width: 100%;">
                <tr><td>
                  <p style="margin: 0; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains !</p>
                  <p style="margin: 4px 0 14px; color: #64748b; font-size: 13px;">Le bureau vous souhaite une excellente journée 🏸</p>
                  <p style="margin: 0 0 2px; color: #1e293b; font-size: 13px; font-weight: 600;">Hernan Camara <span style="color: #64748b; font-weight: 400;">· Président</span></p>
                  <p style="margin: 0 0 14px; color: #64748b; font-size: 12px; font-style: italic;">&amp; toute l'équipe du SACCB</p>
                  <table cellpadding="0" cellspacing="0" border="0"><tr>
                    <td style="vertical-align: middle; padding-right: 12px;"><img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" /></td>
                    <td style="vertical-align: middle;">
                      <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                      <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> &middot; <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </div>
          </div>
        `,
      });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return json({ ok: false, reason: "Erreur envoi email : " + errText });
    }

    await logEmailToHistory(supabaseAdmin, {
      type: "payment_confirmation",
      subject: "🏸 Paiement confirmé — Bienvenue au SACCB !",
      body: `Confirmation paiement envoyée à ${membre.nom} (${prix}€, ${membre.type})`,
      recipients: [String(membre.email)],
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
    });
    return json({ ok: true });
  }

  // ─── ACTION: Formulaire de contact public ───
  if (action === "contact") {
    // 🛡️ Honeypot anti-bot : champ caché qui doit rester vide. Si rempli = bot → on simule un succès.
    if (body.website || body.hp_url) {
      return json({ ok: true }); // fake success pour ne pas alerter le bot
    }
    // Rate limit spécifique contact : max 3 par heure par IP
    if (isContactRateLimited(ip)) {
      return json({ ok: false, reason: "Trop de messages envoyés. Réessayez dans une heure." }, 429);
    }

    const name = sanitize(String(body.name || ""));
    const email = sanitize(String(body.email || "")).toLowerCase();
    const message = String(body.message || "").slice(0, 1000).replace(/[<>]/g, "");

    if (!name || name.length < 2) return json({ ok: false, reason: "Nom invalide." }, 400);
    if (!isValidEmail(email)) return json({ ok: false, reason: "Email invalide." }, 400);
    if (!message || message.length < 5) return json({ ok: false, reason: "Message trop court." }, 400);

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    // Lire les emails de contact depuis la DB, sinon fallback sur les emails par défaut
    const { data: dbData } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    const dbD = (dbData?.data ?? {}) as Record<string, unknown>;
    const contactEmails = ((dbD.contactEmails || []) as string[]);
    const toEmails = contactEmails.length > 0 ? contactEmails : ["gabin.binay@gmail.com", "hernancm68@hotmail.com"];

    const sendRes = await sendBrevo(brevoKey, {
        from: "SACCB Site <contact@saccb.fr>",
        headers: {
          "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        to: toEmails.length > 0 ? [toEmails[0]] : ["contact@saccb.fr"],
        bcc: toEmails.length > 1 ? toEmails.slice(1) : undefined,
        reply_to: [email],
        subject: `📩 Message de ${name} via saccb.fr`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1e3a5f;">Nouveau message depuis saccb.fr</h2>
            <p><strong>De :</strong> ${name}</p>
            <p><strong>Email :</strong> <a href="mailto:${email}">${email}</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <p style="white-space: pre-wrap; color: #475569;">${message}</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">Message reçu via le formulaire de contact de saccb.fr</p>
          </div>
        `,
      });

    if (!sendRes.ok) {
      const errBody = await sendRes.json().catch(() => ({}));
      return json({ ok: false, reason: `Erreur Brevo (${sendRes.status}): ${JSON.stringify(errBody)}` });
    }

    // 💾 Sauvegarde du message dans la boîte de réception partagée admin
    try {
      const dbCurrent = (dbD ?? {}) as Record<string, unknown>;
      const messages = (dbCurrent.contactMessages || []) as Record<string, unknown>[];
      messages.push({
        id: Date.now().toString(),
        name,
        email,
        message,
        createdAt: new Date().toISOString(),
      });
      // Conserver max 200 messages (on coupe les + anciens si > 200)
      const trimmed = messages.length > 200 ? messages.slice(messages.length - 200) : messages;
      dbCurrent.contactMessages = trimmed;
      await supabaseAdmin.from("saccb_db").update({ data: dbCurrent }).eq("id", 1);
    } catch (_e) {
      // L'email est parti, c'est l'essentiel — on n'echoue pas si la sauvegarde echoue
    }

    await logEmailToHistory(supabaseAdmin, {
      type: "contact_form",
      subject: `📩 Message de ${name} via saccb.fr`,
      body: `Message reçu via le formulaire de contact de ${name} (${email}) : ${message.slice(0, 200)}${message.length > 200 ? "..." : ""}`,
      recipients: toEmails,
      sentBy: "system",
    });
    return json({ ok: true });
  }

  // ─── ACTION: Marquer un message comme repondu (boîte partagée) — AUTH ADMIN ───
  if (action === "admin_mark_message_responded") {
    const messageId = String(body.messageId || "");
    if (!messageId) return json({ ok: false, reason: "messageId manquant." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const adminEmail = sanitize(String(body.adminEmail || "")).toLowerCase();
    const messages = (d.contactMessages || []) as Record<string, unknown>[];
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return json({ ok: false, reason: "Message introuvable." });

    const unmark = body.unmark === true;
    if (unmark) {
      const { respondedBy: _r, respondedAt: _t, ...rest } = messages[idx] as Record<string, unknown>;
      messages[idx] = rest;
    } else {
      messages[idx] = { ...messages[idx], respondedBy: adminEmail, respondedAt: new Date().toISOString() };
    }
    d.contactMessages = messages;

    const { error: saveError } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveError) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // ─── ACTION: Archiver/supprimer un message — AUTH ADMIN ───
  if (action === "admin_archive_message") {
    const messageId = String(body.messageId || "");
    if (!messageId) return json({ ok: false, reason: "messageId manquant." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const messages = (d.contactMessages || []) as Record<string, unknown>[];
    const action_kind = body.delete === true ? "delete" : "archive";

    if (action_kind === "delete") {
      d.contactMessages = messages.filter((m) => m.id !== messageId);
    } else {
      d.contactMessages = messages.map((m) =>
        m.id === messageId ? { ...m, archived: body.archived !== false } : m
      );
    }
    const { error: saveError } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveError) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // ─── ACTION: Email de bienvenue (ajout manuel par admin) ───
  if (action === "send_welcome") {
    const membreId = String(body.membreId || "");
    if (!membreId) return json({ ok: false, reason: "membreId manquant." }, 400);

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;

    // 🔒 SÉCURITÉ : Auth admin obligatoire
    const authError = await checkAdminAuth(body, currentData);
    if (authError) return authError;

    const membres = (currentData.membres || []) as Record<string, unknown>[];
    const membreIdx = membres.findIndex((m) => m.id === membreId);
    if (membreIdx === -1) return json({ ok: false, reason: "Membre introuvable." });
    const membre = membres[membreIdx];

    // 🔒 SÉCURITÉ : on génère TOUJOURS un nouveau code aléatoire pour l'envoi de bienvenue
    // (les codes en base sont hashés, on ne peut plus les récupérer)
    const membreCode = String(Math.floor(100000 + Math.random() * 900000));
    membres[membreIdx] = { ...membre, code: await hashCode(membreCode) };
    currentData.membres = membres;
    await supabaseAdmin.from("saccb_db").update({ data: currentData }).eq("id", 1);

    const sendRes = await sendBrevo(brevoKey, {
        from: "SACCB <contact@saccb.fr>",
        headers: {
          "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        to: [String(membre.email)],
        subject: "🎉 Bienvenue au SACCB — Votre accès espace membre",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
              <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
              <div>
                <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
              </div>
            </div>
            <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <div style="display:inline-block;background:#d1fae5;color:#065f46;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">🎉 Bienvenue</div>
              <h2 style="color: #047857; margin-top: 0;">🎉 Bienvenue dans l’association, ${membre.nom} !</h2>
              <p style="color: #475569;">
                Vous avez été inscrit(e) au SACCB pour la saison <strong>${currentData.y1}–${currentData.y2}</strong>.
                Vous avez accès à votre espace membre sur le site de l'association.
              </p>

              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px; color: #64748b; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">Vos identifiants de connexion</p>
                <p style="margin: 6px 0; color: #1e293b;"><strong>Site :</strong> <a href="https://saccb.fr" style="color: #1e3a5f;">saccb.fr</a></p>
                <p style="margin: 6px 0; color: #1e293b;"><strong>Email :</strong> ${membre.email}</p>
              </div>

              <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center;">
                <p style="margin: 0 0 6px; color: #92400e; font-size: 13px; font-weight: bold;">🔑 Votre code provisoire</p>
                <p style="margin: 0 0 12px; color: #92400e; font-size: 12px;">Utilisez ce code pour vous connecter la première fois</p>
                <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${membreCode}</p>
              </div>

              <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 10px; color: #0c4a6e; font-size: 14px; font-weight: bold;">Comment accéder à votre espace membre :</p>
                <ol style="margin: 0; padding-left: 20px; color: #0369a1; font-size: 13px; line-height: 1.8;">
                  <li>Rendez-vous sur <a href="https://saccb.fr" style="color: #1e3a5f; font-weight: bold;">saccb.fr</a></li>
                  <li>Cliquez sur <strong>«&nbsp;Espace membre&nbsp;»</strong> en haut de la page</li>
                  <li>Entrez votre email et votre code provisoire ci-dessus</li>
                </ol>
              </div>

              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 16px 0;">
                <p style="margin: 0; color: #166534; font-size: 13px;">
                  💡 <strong>Changer votre code :</strong> une fois connecté, cliquez sur
                  <em>«&nbsp;Changer mon code personnel&nbsp;»</em> dans votre espace.
                  Vous pouvez aussi utiliser <em>«&nbsp;Code oublié ?&nbsp;»</em> sur la page de connexion.
                </p>
              </div>

              ${currentData.whatsappLink ? `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <p style="margin: 0 0 10px; color: #166534; font-size: 14px;">📱 Rejoignez le groupe WhatsApp de l'association :</p>
                <a href="${currentData.whatsappLink}" style="display: inline-flex; align-items: center; gap: 8px; background: #25D366; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                  💬 Rejoindre le groupe WhatsApp
                </a>
              </div>
              ` : ""}

              <a href="https://saccb.fr" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
                Accéder au site →
              </a>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px; border-top: 1px solid #e2e8f0; padding-top: 18px; width: 100%;">
                <tr><td>
                  <p style="margin: 0; color: #1e3a5f; font-size: 14px; font-weight: 600;">À très bientôt sur les terrains !</p>
                  <p style="margin: 4px 0 14px; color: #64748b; font-size: 13px;">Le bureau vous souhaite une excellente journée 🏸</p>
                  <p style="margin: 0 0 2px; color: #1e293b; font-size: 13px; font-weight: 600;">Hernan Camara <span style="color: #64748b; font-weight: 400;">· Président</span></p>
                  <p style="margin: 0 0 14px; color: #64748b; font-size: 12px; font-style: italic;">&amp; toute l'équipe du SACCB</p>
                  <table cellpadding="0" cellspacing="0" border="0"><tr>
                    <td style="vertical-align: middle; padding-right: 12px;"><img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" /></td>
                    <td style="vertical-align: middle;">
                      <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                      <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> &middot; <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </div>
          </div>
        `,
      });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return json({ ok: false, reason: "Erreur envoi email : " + errText });
    }

    await logEmailToHistory(supabaseAdmin, {
      type: "welcome",
      subject: "🏸 Bienvenue au SACCB — Votre accès espace membre",
      body: `Bienvenue + code provisoire envoyé à ${membre.nom}`,
      recipients: [String(membre.email)],
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
    });
    return json({ ok: true });
  }

  // ─── ACTION: Nettoyage automatique des membres non payés après date limite ───
  if (action === "cleanup_expired") {
    // Sécurisé par un secret pour éviter les appels non autorisés
    const secret = String(body.secret || "");
    const expectedSecret = Deno.env.get("CRON_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return json({ ok: false, reason: "Non autorisé." }, 401);
    }

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;
    const inscCloseDate = String(d.insc_close_date || "");

    // Pas de date limite configurée → rien à faire
    if (!inscCloseDate) return json({ ok: true, skipped: true, reason: "Pas de date limite configurée." });

    const today = new Date().toISOString().slice(0, 10);
    // Date limite pas encore atteinte → rien à faire
    if (today < inscCloseDate) return json({ ok: true, skipped: true, reason: `Date limite ${inscCloseDate} pas encore atteinte.` });

    const membres = (d.membres || []) as Record<string, unknown>[];
    const before = membres.length;
    const kept = membres.filter((m) => m.ok === true); // on garde uniquement les payés
    const removedList = membres.filter((m) => m.ok !== true);
    const removed = removedList.length;

    if (removed === 0) return json({ ok: true, removed: 0, reason: "Aucun membre à supprimer." });

    // Sauvegarder les anciens membres avant suppression
    const formerMembers = ((d.formerMembers || []) as Record<string, unknown>[]);
    const nowISO = new Date().toISOString();
    const saison = `${d.y1}-${d.y2}`;
    for (const m of removedList) {
      formerMembers.push({
        nom: String(m.nom || ""),
        email: String(m.email || ""),
        type: String(m.type || "Adulte"),
        removedAt: nowISO,
        saison,
      });
    }
    d.formerMembers = formerMembers;
    d.membres = kept;
    const { error: saveError } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveError) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);

    // Notifier les admins par email
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (brevoKey) {
      await sendBrevo(brevoKey, {
          from: "SACCB <contact@saccb.fr>",
          headers: {
            "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          to: ["gabin.binay@gmail.com", "hernancm68@hotmail.com"],
          subject: `🏸 SACCB — ${removed} adhérent(s) supprimé(s) automatiquement`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1e3a5f;">Nettoyage automatique effectué</h2>
              <p>La date limite d'inscription (<strong>${inscCloseDate}</strong>) est dépassée.</p>
              <p><strong>${removed} adhérent(s)</strong> non payé(s) ont été supprimés automatiquement.</p>
              <p>Il reste <strong>${kept.length} adhérent(s)</strong> actifs.</p>
              <p style="color: #94a3b8; font-size: 12px;">Ceci est un message automatique de saccb.fr</p>
            </div>
          `,
        }).catch(() => {});
    }

    return json({ ok: true, removed, kept: kept.length });
  }

  // ─── ACTION: Vérifier qu'une session membre est toujours valide ───
  if (action === "check_session") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const membreId = String(body.membreId || "");

    if (!email || !membreId) return json({ ok: false });

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: true }); // Erreur serveur : on laisse passer

    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];
    const adminCredentials = ((d.adminCredentials || []) as { email: string; code: string }[]);

    // Vérifier si c'est un admin credential (pas un adhérent normal)
    const isAdminCred = adminCredentials.some((c) => String(c.email || "").toLowerCase() === email);
    if (isAdminCred) return json({ ok: true });

    // Vérifier si le membre existe encore par email + id
    const membre = membres.find(
      (m) => String(m.email || "").toLowerCase() === email && String(m.id || "") === membreId
    );

    if (!membre) return json({ ok: false, reason: "Session expirée ou compte supprimé." });
    return json({ ok: true, paid: membre.ok === true });
  }

  // ─── ACTION: Upload image via admin (contourne RLS via service_role) ───
  if (action === "upload_image") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const fileData = String(body.fileData || ""); // base64 (avec ou sans préfixe data:...)
    const fileName = String(body.fileName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
    const contentType = String(body.contentType || "image/jpeg").slice(0, 100);
    const bucket = String(body.bucket || "actualities");
    const pathPrefix = String(body.pathPrefix || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);

    if (!email || !code) return json({ ok: false, reason: "Identifiants manquants." }, 400);
    if (!fileData) return json({ ok: false, reason: "Données fichier manquantes." }, 400);

    // Buckets autorisés (reports = comptes-rendus de réunion en PDF)
    const allowedBuckets = ["actualities", "factures", "reports"];
    if (!allowedBuckets.includes(bucket)) return json({ ok: false, reason: "Bucket non autorisé." }, 400);

    // Vérifier les credentials admin (avec verifyCode pour gérer hash + clair)
    const { data: dbDataImg, error: dbErrorImg } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (dbErrorImg || !dbDataImg) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const dImg = dbDataImg.data as Record<string, unknown>;
    const membresImg = (dImg.membres || []) as Record<string, unknown>[];
    const adminEmailsImg = parseAdminEmails(dImg.adminEmails as unknown[] || []).map((e) => e.email);
    const adminCredentialsImg = ((dImg.adminCredentials || []) as { email: string; code: string }[]);

    const validAdminCredImg = await findAdminCredByCredentials(adminCredentialsImg, email, code);
    const validMembreImg = await findMembreByCredentials(membresImg, email, code);

    if (!validAdminCredImg && !validMembreImg) return json({ ok: false, reason: "Identifiants incorrects." }, 401);
    if (!adminEmailsImg.includes(email) && !validAdminCredImg) return json({ ok: false, reason: "Accès non autorisé." }, 403);

    // 🔒 SÉCURITÉ : limite la taille du base64 à ~27MB (= ~20MB de fichier décodé)
    const MAX_BASE64_LENGTH = 27_000_000;
    const base64Data = fileData.includes(",") ? fileData.split(",")[1] : fileData;
    if (base64Data.length > MAX_BASE64_LENGTH) {
      return json({ ok: false, reason: "Fichier trop volumineux (20 Mo max)." }, 413);
    }

    // 🔒 SÉCURITÉ : whitelist des types MIME acceptés
    const allowedTypes = [
      "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
      "application/pdf", // factures
    ];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
      return json({ ok: false, reason: "Type de fichier non autorisé." }, 400);
    }

    // Décoder le base64
    let bytes: Uint8Array;
    try {
      const binaryStr = atob(base64Data);
      bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
    } catch {
      return json({ ok: false, reason: "Données fichier invalides." }, 400);
    }

    // 🔒 SÉCURITÉ : double-check sur la taille décodée (20 Mo max)
    if (bytes.length > 20_000_000) {
      return json({ ok: false, reason: "Fichier trop volumineux (20 Mo max)." }, 413);
    }

    // 🔒 SÉCURITÉ : validation des "magic bytes" pour confirmer le vrai type de fichier
    // (empêche d'envoyer un script en se faisant passer pour une image)
    const isValidMagicBytes = (bytes: Uint8Array, declared: string): boolean => {
      if (bytes.length < 4) return false;
      const t = declared.toLowerCase();
      // JPEG: FF D8 FF
      if (t === "image/jpeg" || t === "image/jpg") {
        return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      }
      // PNG: 89 50 4E 47
      if (t === "image/png") {
        return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      }
      // GIF: 47 49 46 38
      if (t === "image/gif") {
        return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
      }
      // WEBP: RIFF....WEBP
      if (t === "image/webp") {
        return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      }
      // PDF: %PDF
      if (t === "application/pdf") {
        return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
      }
      return false;
    };
    if (!isValidMagicBytes(bytes, contentType)) {
      return json({ ok: false, reason: "Le contenu du fichier ne correspond pas au type déclaré." }, 400);
    }

    const prefix = pathPrefix ? `${pathPrefix}/` : "";
    const path = `${prefix}${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: false });

    if (uploadError) return json({ ok: false, reason: "Erreur upload : " + uploadError.message }, 500);

    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return json({ ok: true, url: urlData.publicUrl, path });
  }

  // ─── ACTION: Voter à un sondage (membre authentifié) ───
  // 👕 Commande de t-shirt par un membre connecté
  if (action === "tshirt_order") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");
    const taille = String(body.taille || "");
    const nomFloque = sanitize(String(body.nomFloque || "")).slice(0, 30);

    const TAILLES = ["XS", "S", "M", "L", "XL"];
    if (!email || !code || !membreId) return json({ ok: false, reason: "Authentification requise." }, 400);
    if (!TAILLES.includes(taille)) return json({ ok: false, reason: "Taille invalide." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];

    const membre = await findMembreByCredentials(membres, email, code);
    if (!membre) return json({ ok: false, reason: "Email ou code incorrect." }, 403);
    if (String(membre.id) !== membreId) return json({ ok: false, reason: "Session périmée." }, 403);
    if (membre.ok !== true) return json({ ok: false, reason: "Votre adhésion doit être validée pour commander." }, 403);
    if (d.tshirtOpen !== true) return json({ ok: false, reason: "Les commandes de t-shirts ne sont pas ouvertes." }, 403);

    // 🔒 SÉCURITÉ : on prend nom/prénom UNIQUEMENT depuis le compte du membre, pas du client
    const fullName = String(membre.nom || "").trim();
    const parts = fullName.split(/\s+/);
    const prenom = parts[0] || "";
    const nom = parts.slice(1).join(" ") || "";

    const orders = (d.tshirtOrders || []) as Record<string, unknown>[];
    // 1 commande par membre uniquement (modifier si déjà existante)
    const existingIdx = orders.findIndex((o) => o.membreId === membreId);
    const newOrder = {
      id: existingIdx !== -1 ? orders[existingIdx].id : `tshirt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      membreId,
      nom,
      prenom,
      taille,
      nomFloque: nomFloque || undefined,
      createdAt: existingIdx !== -1 ? orders[existingIdx].createdAt : new Date().toISOString(),
      status: existingIdx !== -1 ? orders[existingIdx].status : "pending",
      saison: `${d.y1}-${d.y2}`,
    };
    if (existingIdx !== -1) orders[existingIdx] = newOrder;
    else orders.push(newOrder);

    d.tshirtOrders = orders;
    const { error: saveErr } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveErr) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // 👕 Récupère la commande t-shirt du membre connecté
  if (action === "tshirt_my_order") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");
    if (!email || !code || !membreId) return json({ ok: false, reason: "Authentification requise." }, 400);
    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];
    const membre = await findMembreByCredentials(membres, email, code);
    if (!membre || String(membre.id) !== membreId) return json({ ok: false, reason: "Session invalide." }, 403);
    const orders = (d.tshirtOrders || []) as Record<string, unknown>[];
    const my = orders.find((o) => o.membreId === membreId) || null;
    return json({
      ok: true,
      order: my,
      open: d.tshirtOpen === true,
      price: typeof d.tshirtPrice === "number" ? d.tshirtPrice : null,
    });
  }

  // 👕 [ADMIN] Supprime une commande t-shirt
  if (action === "admin_delete_tshirt_order") {
    const orderId = String(body.orderId || "");
    if (!orderId) return json({ ok: false, reason: "orderId manquant." }, 400);
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;
    d.tshirtOrders = ((d.tshirtOrders || []) as Record<string, unknown>[]).filter((o) => o.id !== orderId);
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    return json({ ok: true });
  }

  if (action === "vote_poll") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");
    const pollId = sanitize(String(body.pollId || ""));
    const optionIdx = Number(body.optionIdx);

    if (!email || !code || !membreId || !pollId || isNaN(optionIdx)) {
      return json({ ok: false, reason: "Paramètres manquants." }, 400);
    }

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];

    // Vérifier auth membre + paiement (messages d'erreur précis pour debug)
    const membre = await findMembreByCredentials(membres, email, code);
    if (!membre) {
      return json({ ok: false, reason: "Email ou code incorrect. Reconnectez-vous à votre espace membre." }, 403);
    }
    if (String(membre.id) !== membreId) {
      return json({ ok: false, reason: "Session périmée. Reconnectez-vous à votre espace membre." }, 403);
    }
    if (membre.ok !== true) {
      return json({ ok: false, reason: "Votre adhésion doit être validée pour voter." }, 403);
    }

    const polls = (d.polls || []) as Record<string, unknown>[];
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return json({ ok: false, reason: "Sondage introuvable." });
    if (poll.closed === true) return json({ ok: false, reason: "Sondage fermé." });

    const options = (poll.options as string[]) || [];
    if (optionIdx < 0 || optionIdx >= options.length) {
      return json({ ok: false, reason: "Option invalide." }, 400);
    }

    const votes = (poll.votes || []) as { membreId: string; optionIdx: number; date: string }[];
    const multiple = poll.multipleChoice === true;

    if (multiple) {
      // Toggle : si déjà voté pour cette option → retirer, sinon ajouter
      const existingIdx = votes.findIndex((v) => v.membreId === membreId && v.optionIdx === optionIdx);
      if (existingIdx !== -1) votes.splice(existingIdx, 1);
      else votes.push({ membreId, optionIdx, date: new Date().toISOString() });
    } else {
      // Choix unique : supprimer ancien vote du membre s'il existe, puis ajouter
      const filtered = votes.filter((v) => v.membreId !== membreId);
      filtered.push({ membreId, optionIdx, date: new Date().toISOString() });
      poll.votes = filtered;
    }
    if (multiple) poll.votes = votes;

    d.polls = polls;
    const { error: saveErr } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveErr) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // ─── ACTION: Soumettre une question/idée à l'AG (membre authentifié) ───
  if (action === "submit_ag_item") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");
    const text = String(body.text || "").slice(0, 2000).replace(/[<>]/g, "");
    const itemType = body.type === "amelioration" ? "amelioration" : "question";
    const anonymous = body.anonymous === true;

    if (!email || !code || !membreId) return json({ ok: false, reason: "Auth requise." }, 401);
    if (!text || text.trim().length < 5) return json({ ok: false, reason: "Texte trop court." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];

    const membre = await findMembreByCredentials(membres, email, code);
    if (!membre) {
      return json({ ok: false, reason: "Email ou code incorrect. Reconnectez-vous à votre espace membre." }, 403);
    }
    if (String(membre.id) !== membreId) {
      return json({ ok: false, reason: "Session périmée. Reconnectez-vous à votre espace membre." }, 403);
    }
    if (membre.ok !== true) {
      return json({ ok: false, reason: "Votre adhésion doit être validée pour soumettre une question." }, 403);
    }

    const agItems = (d.agItems || []) as Record<string, unknown>[];
    agItems.push({
      id: Date.now().toString(),
      type: itemType,
      text: text.trim(),
      anonymous,
      authorMembreId: anonymous ? null : membreId,
      authorNom: anonymous ? null : String(membre.nom || ""),
      createdAt: new Date().toISOString(),
      saison: `${d.y1}-${d.y2}`,
      resolved: false,
      reponse: null,
    });
    d.agItems = agItems;

    const { error: saveErr } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveErr) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // ─── ACTION: Récupérer les votes d'un membre (pour afficher ce qu'il a voté) ───
  if (action === "fetch_my_votes") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const code = sanitize(String(body.code || ""));
    const membreId = String(body.membreId || "");

    if (!email || !code || !membreId) return json({ ok: false }, 401);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false }, 500);
    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];

    const membre = await findMembreByCredentials(membres, email, code);
    if (!membre || String(membre.id) !== membreId) return json({ ok: false }, 403);

    const polls = (d.polls || []) as Record<string, unknown>[];
    const myVotes: Record<string, number[]> = {};
    for (const p of polls) {
      const votes = ((p.votes as { membreId: string; optionIdx: number }[]) || []).filter((v) => v.membreId === membreId);
      if (votes.length > 0) {
        myVotes[String(p.id)] = votes.map((v) => v.optionIdx);
      }
    }
    return json({ ok: true, myVotes });
  }

  // ─── ACTION: Envoi d'un email personnalisé aux adhérents (avec pièces jointes) ───
  // ⏰ ANCIENNE ACTION désactivée : envoi programmé des brouillons.
  // Désormais on ne supporte que les brouillons manuels (pas de programmation).
  // Si un éventuel workflow cron externe appelle encore cette action, on répond
  // simplement {ok:true, sent:0} pour ne pas casser. Le code complet est conservé
  // pour pouvoir réactiver facilement si besoin un jour.
  if (action === "cron_send_scheduled_drafts") {
    return json({ ok: true, sent: 0, disabled: true });
  }

  // ⚠️ CODE INACTIF — ancien envoi programmé, conservé pour référence
  // (jamais exécuté car l'action est interceptée juste au-dessus)
  if (action === "__DISABLED_cron_send_scheduled_drafts__") {
    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "DB error" }, 500);
    const d = data.data as Record<string, unknown>;
    const drafts = (d.emailDrafts || []) as Array<Record<string, unknown>>;
    const now = Date.now();
    const dueDrafts = drafts.filter((x) =>
      x.scheduledAt && new Date(String(x.scheduledAt)).getTime() <= now
    );
    if (dueDrafts.length === 0) return json({ ok: true, sent: 0 });

    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "BREVO_API_KEY missing" }, 500);

    const membres = (d.membres || []) as Array<Record<string, unknown>>;
    let sentDrafts = 0;
    const remainingDrafts = drafts.filter((x) => !dueDrafts.some((dd) => dd.id === x.id));

    for (const draft of dueDrafts) {
      try {
        const draftSubject = String(draft.subject || "");
        const draftBody = String(draft.body || "");
        const draftMode = String(draft.targetMode || "");
        const draftCustomIds = (draft.customMembreIds as string[]) || [];
        const draftExtra = (draft.extraEmails as string[]) || [];
        const variant = String(draft.variant || "default") as "urgent" | "annonce" | "bonne_nouvelle" | "info" | "default";

        // Reconstruction de la liste de destinataires (même logique que admin_send_email)
        let recipients: string[] = [];
        if (draftMode === "all") {
          recipients = membres.map((m) => String(m.email || "")).filter(Boolean);
        } else if (draftMode === "paid") {
          recipients = membres.filter((m) => m.ok === true).map((m) => String(m.email || "")).filter(Boolean);
        } else if (draftMode === "unpaid") {
          recipients = membres.filter((m) => m.ok !== true).map((m) => String(m.email || "")).filter(Boolean);
        } else if (draftMode === "news") {
          recipients = membres.filter((m) => m.ok === true && m.newsOptIn !== false).map((m) => String(m.email || "")).filter(Boolean);
        } else if (draftMode === "custom") {
          recipients = draftCustomIds
            .map((id) => String(membres.find((m) => m.id === id)?.email || ""))
            .filter(Boolean);
        }
        recipients = [...recipients, ...draftExtra.map((e) => String(e || "").toLowerCase().trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))];
        recipients = Array.from(new Set(recipients.map((e) => e.toLowerCase().trim()))).filter(Boolean);

        if (recipients.length === 0) {
          console.warn(`[cron_send] draft ${draft.id}: no recipients, skipping`);
          continue;
        }

        // Variant config simplifié pour le cron (équivalent du admin_send_email)
        const variantConfig: Record<string, { headerBg: string; subjectPrefix: string; badge: string | null }> = {
          urgent: { headerBg: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)", subjectPrefix: "🚨 URGENT — ", badge: '<div style="display:inline-block;background:#fee2e2;color:#991b1b;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">⚠️ Annonce importante</div>' },
          annonce: { headerBg: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)", subjectPrefix: "📢 ", badge: '<div style="display:inline-block;background:#dbeafe;color:#1e3a5f;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">📢 Annonce</div>' },
          bonne_nouvelle: { headerBg: "linear-gradient(135deg, #059669 0%, #047857 100%)", subjectPrefix: "🎉 ", badge: '<div style="display:inline-block;background:#d1fae5;color:#065f46;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">🎉 Bonne nouvelle</div>' },
          info: { headerBg: "linear-gradient(135deg, #64748b 0%, #475569 100%)", subjectPrefix: "ℹ️ ", badge: '<div style="display:inline-block;background:#f1f5f9;color:#475569;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">ℹ️ Information</div>' },
          default: { headerBg: "#1e3a5f", subjectPrefix: "", badge: null },
        };
        const vc = variantConfig[variant] || variantConfig.default;
        const finalSubject = (vc.subjectPrefix + draftSubject.trim()).slice(0, 300);

        let totalSent = 0;
        for (const email of recipients) {
          await sendBrevo(brevoKey, {
            from: "SACCB <contact@saccb.fr>",
            headers: {
              "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
            to: [email],
            subject: finalSubject,
            text: `${draftBody.replace(/<[^>]+>/g, "")}\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`,
            html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: ${vc.headerBg}; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
                <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
                <div><h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1><p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p></div>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                ${vc.badge || ""}
                <div style="color: #1f2937; line-height: 1.6; white-space: pre-wrap; font-size: 15px;">${draftBody}</div>
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; width: 100%;">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 12px; width: 44px;">
                      <img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" />
                    </td>
                    <td style="vertical-align: middle;">
                      <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                      <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> · <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                    </td>
                  </tr>
                </table>
              </div>
            </div>`,
          }).then((res) => { if (res.ok) totalSent++; }).catch(() => {});
          await sleep(EMAIL_THROTTLE_MS);
        }

        // Log dans l'historique
        await logEmailToHistory(supabaseAdmin, {
          type: "manual_scheduled",
          subject: finalSubject,
          body: draftBody.slice(0, 5000),
          recipients,
          sentBy: String(draft.createdBy || "system"),
          status: totalSent === recipients.length ? "sent" : totalSent > 0 ? "partial" : "failed",
          sentCount: totalSent,
        });
        sentDrafts++;
      } catch (err) {
        console.warn(`[cron_send] draft ${draft.id} failed:`, err);
      }
    }

    // Met à jour la DB en retirant les brouillons consommés
    d.emailDrafts = remainingDrafts;
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    return json({ ok: true, sent: sentDrafts });
  }

  // 📝 [ADMIN] Liste les brouillons d'emails (partagés entre tous les admins)
  if (action === "admin_drafts_list") {
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;
    return json({ ok: true, drafts: d.emailDrafts || [] });
  }

  // 📝 [ADMIN] Crée ou met à jour un brouillon
  if (action === "admin_draft_save") {
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const draftId = String(body.draftId || ""); // vide = création
    const subject = String(body.subject || "").slice(0, 300);
    const draftBody = String(body.body || "").slice(0, 100_000);
    const targetMode = String(body.targetMode || "");
    const customMembreIds = Array.isArray(body.customMembreIds) ? body.customMembreIds.map(String) : [];
    const extraEmails = Array.isArray(body.extraEmails) ? body.extraEmails.map(String) : [];
    const variant = String(body.variant || "default");
    const scheduledAt = body.scheduledAt ? String(body.scheduledAt) : undefined;
    const adminEmailUsed = String(body.adminEmail || body.email || "").toLowerCase().trim();

    const drafts = (d.emailDrafts || []) as Record<string, unknown>[];
    const existingIdx = draftId ? drafts.findIndex((x) => x.id === draftId) : -1;
    const now = new Date().toISOString();

    const draft = {
      id: existingIdx !== -1 ? draftId : `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subject,
      body: draftBody,
      targetMode,
      customMembreIds,
      extraEmails,
      variant,
      scheduledAt,
      createdAt: existingIdx !== -1 ? drafts[existingIdx].createdAt : now,
      updatedAt: now,
      createdBy: existingIdx !== -1 ? drafts[existingIdx].createdBy : adminEmailUsed,
      updatedBy: adminEmailUsed,
    };

    if (existingIdx !== -1) drafts[existingIdx] = draft;
    else drafts.push(draft);
    d.emailDrafts = drafts;
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    return json({ ok: true, draftId: draft.id });
  }

  // 📝 [ADMIN] Supprime un brouillon
  if (action === "admin_draft_delete") {
    const draftId = String(body.draftId || "");
    if (!draftId) return json({ ok: false, reason: "draftId manquant." }, 400);
    const { data } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (!data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;
    d.emailDrafts = ((d.emailDrafts || []) as { id: string }[]).filter((x) => x.id !== draftId);
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    return json({ ok: true });
  }

  if (action === "admin_send_email") {
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    // 🔒 SÉCURITÉ : Auth admin obligatoire
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const subject = String(body.subject || "").slice(0, 300).replace(/[\r\n]/g, " ");
    const htmlBody = String(body.htmlBody || "").slice(0, 100_000);
    const targetMode = String(body.targetMode || "all"); // all | paid | unpaid | news | custom
    const variant = String(body.variant || "default") as "urgent" | "annonce" | "bonne_nouvelle" | "info" | "default";

    // 🎨 Templates visuels selon le type d'email choisi par l'admin
    const variantConfig: Record<string, { headerBg: string; subjectPrefix: string; badge: string | null; intro: string | null }> = {
      urgent: {
        headerBg: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
        subjectPrefix: "🚨 URGENT — ",
        badge: '<div style="display:inline-block;background:#fee2e2;color:#991b1b;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">⚠️ Annonce importante</div>',
        intro: null,
      },
      annonce: {
        headerBg: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)",
        subjectPrefix: "📢 ",
        badge: '<div style="display:inline-block;background:#dbeafe;color:#1e3a5f;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">📢 Annonce</div>',
        intro: null,
      },
      bonne_nouvelle: {
        headerBg: "linear-gradient(135deg, #059669 0%, #047857 100%)",
        subjectPrefix: "🎉 ",
        badge: '<div style="display:inline-block;background:#d1fae5;color:#065f46;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">🎉 Bonne nouvelle</div>',
        intro: null,
      },
      info: {
        headerBg: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
        subjectPrefix: "ℹ️ ",
        badge: '<div style="display:inline-block;background:#f1f5f9;color:#475569;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px;">ℹ️ Information</div>',
        intro: null,
      },
      default: {
        headerBg: "#1e3a5f",
        subjectPrefix: "",
        badge: null,
        intro: null,
      },
    };
    const vc = variantConfig[variant] || variantConfig.default;
    const finalSubject = (vc.subjectPrefix + subject.trim()).slice(0, 300);
    const customEmails = Array.isArray(body.customEmails) ? body.customEmails as string[] : [];
    const extraEmails = Array.isArray(body.extraEmails) ? body.extraEmails as string[] : [];
    const attachments = Array.isArray(body.attachments) ? body.attachments as { filename: string; content: string; contentType?: string }[] : [];

    if (!subject.trim() || subject.trim().length < 3) {
      return json({ ok: false, reason: "Le sujet est requis (min. 3 caractères)." }, 400);
    }
    if (!htmlBody.trim() || htmlBody.trim().length < 5) {
      return json({ ok: false, reason: "Le corps de l'email est requis (min. 5 caractères)." }, 400);
    }

    // Calcul des destinataires
    const membres = (d.membres || []) as Record<string, unknown>[];
    let recipientEmails: string[] = [];
    if (targetMode === "all") {
      recipientEmails = membres.map((m) => String(m.email || "")).filter(Boolean);
    } else if (targetMode === "paid") {
      recipientEmails = membres.filter((m) => m.ok === true).map((m) => String(m.email || "")).filter(Boolean);
    } else if (targetMode === "unpaid") {
      recipientEmails = membres.filter((m) => m.ok !== true).map((m) => String(m.email || "")).filter(Boolean);
    } else if (targetMode === "news") {
      recipientEmails = membres.filter((m) => m.ok === true && m.newsOptIn !== false).map((m) => String(m.email || "")).filter(Boolean);
    } else if (targetMode === "custom") {
      recipientEmails = customEmails
        .map((e) => String(e || "").toLowerCase().trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    } else {
      return json({ ok: false, reason: "Mode de destinataires invalide." }, 400);
    }

    // Ajouter les emails externes (validés côté client mais on revérifie)
    const validExtraEmails = extraEmails
      .map((e) => String(e || "").toLowerCase().trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    recipientEmails = [...recipientEmails, ...validExtraEmails];

    // Dédoublonner
    recipientEmails = Array.from(new Set(recipientEmails.map((e) => e.toLowerCase().trim()))).filter(Boolean);

    if (recipientEmails.length === 0) {
      return json({ ok: false, reason: "Aucun destinataire correspondant." });
    }

    // 🔒 Validation des pièces jointes (taille totale max ~25 Mo en base64)
    let totalAttachmentSize = 0;
    for (const att of attachments) {
      if (!att.filename || !att.content) continue;
      totalAttachmentSize += att.content.length;
    }
    if (totalAttachmentSize > 35_000_000) {
      return json({ ok: false, reason: "Pièces jointes trop volumineuses (25 Mo max au total)." }, 413);
    }

    // Construction du payload email (avec attachments si présents)
    const emailAttachments = attachments
      .filter((a) => a.filename && a.content)
      .map((a) => ({
        filename: String(a.filename).slice(0, 200).replace(/[^a-zA-Z0-9._-]/g, "_"),
        content: String(a.content), // déjà en base64
      }));

    // Map email → prénom pour personnalisation (uniquement pour les adhérents trouvés en base)
    const emailToPrenom = new Map<string, string>();
    for (const m of membres) {
      const e = String(m.email || "").toLowerCase().trim();
      if (e) emailToPrenom.set(e, extractFirstName(String(m.nom || "")));
    }

    // 📧 Envoi INDIVIDUEL personnalisé (1 email par destinataire)
    let totalSent = 0;
    const errors: string[] = [];
    for (const recipientEmail of recipientEmails) {
      const prenomAdmin = emailToPrenom.get(recipientEmail.toLowerCase()) || "";
      // 🚫 On n'ajoute plus de "Bonjour [Prénom]" automatique ni de signature auto :
      // l'admin écrit le mail complet (introduction + corps + signature) lui-même
      // pour éviter les doublons quand l'admin met déjà Bonjour / Bureau du SACCB.
      void prenomAdmin; // (variable conservée pour usage futur éventuel)
      // Plain text = juste le corps écrit par l'admin + footer minimal (mention asso)
      const plainTextA = `${htmlBody.replace(/<[^>]+>/g, "")}\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;
      const sendRes = await sendBrevo(brevoKey, {
          from: "SACCB <contact@saccb.fr>",
          headers: {
            "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          to: [recipientEmail],
          subject: finalSubject,
          text: plainTextA,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: ${vc.headerBg}; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
                <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
                <div>
                  <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
                </div>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                ${vc.badge || ""}
                <!-- Corps du mail tel qu'écrit par l'admin (préserve les retours à la ligne) -->
                <div style="color: #1f2937; line-height: 1.6; white-space: pre-wrap; font-size: 15px;">${htmlBody}</div>
                <!-- Footer minimaliste avec logo : identifie clairement l'expéditeur -->
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; width: 100%;">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 12px; width: 44px;">
                      <img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" />
                    </td>
                    <td style="vertical-align: middle;">
                      <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                      <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                      <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> · <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                    </td>
                  </tr>
                </table>
              </div>
            </div>
          `,
          ...(emailAttachments.length > 0 ? { attachments: emailAttachments } : {}),
        });
      if (!sendRes.ok) {
        const t = await sendRes.text().catch(() => "");
        errors.push(`${recipientEmail}: ${sendRes.status} ${t.slice(0, 100)}`);
      } else {
        totalSent++;
      }
      await sleep(EMAIL_THROTTLE_MS);
    }

    if (errors.length > 0 && totalSent === 0) {
      return json({ ok: false, reason: "Aucun email envoyé. Erreurs : " + errors.join(" | ") });
    }

    // Enregistrer dans l'historique
    try {
      const adminEmailUsed = String(body.adminEmail || body.email || "").toLowerCase().trim();
      const emailHistory = (d.emailHistory || []) as Record<string, unknown>[];
      emailHistory.push({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        subject: finalSubject,
        body: htmlBody.slice(0, 5000), // limite à 5000 chars pour pas exploser la DB
        recipientCount: recipientEmails.length,
        recipientsPreview: recipientEmails.slice(0, 3),
        targetMode,
        sentBy: adminEmailUsed,
        attachmentNames: emailAttachments.map((a) => a.filename),
        status: errors.length > 0 ? "partial" : "sent",
        sentCount: totalSent,
        totalCount: recipientEmails.length,
        variant, // 🎨 style visuel (urgent, annonce, etc.)
        type: "manual", // 👤 envoyé manuellement par un admin (vs automatique)
      });
      // Garder uniquement les 100 derniers (anti-explosion DB)
      const trimmed = emailHistory.slice(-100);
      d.emailHistory = trimmed;
      // 📝 Si l'envoi vient d'un brouillon, on le supprime maintenant qu'il a servi
      const consumedDraftId = String(body.draftId || "");
      if (consumedDraftId) {
        d.emailDrafts = ((d.emailDrafts || []) as { id: string }[]).filter((x) => x.id !== consumedDraftId);
      }
      await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    } catch (e) {
      console.warn("[admin_send_email] Failed to log:", e);
    }

    return json({
      ok: true,
      sent: totalSent,
      total: recipientEmails.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  // ─── ACTION: Supprimer une entrée de l'historique d'emails ───
  if (action === "delete_email_log") {
    const logId = String(body.logId || "");
    if (!logId) return json({ ok: false, reason: "logId manquant." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    // 🔒 SÉCURITÉ : Auth admin obligatoire
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const emailHistory = (d.emailHistory || []) as Record<string, unknown>[];
    const filtered = emailHistory.filter((l) => l.id !== logId);
    if (filtered.length === emailHistory.length) {
      return json({ ok: false, reason: "Entrée introuvable." });
    }
    d.emailHistory = filtered;
    const { error: saveErr } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveErr) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // ─── ACTION: Vider tout l'historique d'emails ───
  if (action === "clear_email_history") {
    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    d.emailHistory = [];
    const { error: saveErr } = await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
    if (saveErr) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // ─── ACTION: Notifier les adhérents qu'un nouveau sondage est disponible ───
  if (action === "notify_new_poll") {
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const pollId = String(body.pollId || "");
    if (!pollId) return json({ ok: false, reason: "pollId manquant." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    // 🔒 Auth admin obligatoire
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    // Trouver le sondage
    const polls = (d.polls || []) as Record<string, unknown>[];
    const poll = polls.find((p) => p.id === pollId);
    if (!poll) return json({ ok: false, reason: "Sondage introuvable." });

    const membres = (d.membres || []) as Record<string, unknown>[];
    const recipients = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
      .filter((r) => r.email);

    if (recipients.length === 0) return json({ ok: false, reason: "Aucun adhérent à notifier." });

    let sentCount = 0;
    const errors: string[] = [];
    const pollQuestion = String(poll.question || "Sondage");
    const optionsList = ((poll.options as string[]) || []).slice(0, 5).map((o) => `• ${o}`).join("\n");

    for (const recipient of recipients) {
      const greeting = recipient.prenom ? `Bonjour ${escapeHtml(recipient.prenom)},` : "Bonjour,";
      const greetingText = recipient.prenom ? `Bonjour ${recipient.prenom},` : "Bonjour,";
      const subject = recipient.prenom
        ? `${recipient.prenom}, votre avis sur "${pollQuestion}"`
        : `Votre avis sur "${pollQuestion}"`;
      const plainText = `${greetingText}\n\nUn nouveau sondage est disponible sur le site de l'association :\n\n"${pollQuestion}"\n\n${optionsList}\n\nDonnez votre avis : https://saccb.fr/?member=1\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;

      // 📨 Design "mail perso" sobre pour éviter le classement en Promotions
      const optionsHtml = ((poll.options as string[]) || []).slice(0, 5).map((o) => `<p style="margin: 2px 0; padding-left: 18px;">— ${escapeHtml(o)}</p>`).join("");
      const sendRes = await sendBrevo(brevoKey, {
          from: "SACCB <contact@saccb.fr>",
          to: [recipient.email],
          subject,
          text: plainText,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0; padding: 16px; color: #1f2937; line-height: 1.6; font-size: 15px;">
            <p style="margin: 0 0 14px;">${greeting}</p>
            <p style="margin: 0 0 14px;">Le bureau aimerait avoir ton avis sur cette question :</p>
            <p style="margin: 0 0 6px; font-weight: 600;">« ${escapeHtml(pollQuestion)} »</p>
            ${optionsHtml}
            <p style="margin: 14px 0;">Tu peux y répondre en te connectant à ton espace membre sur <a href="https://saccb.fr/?member=1" style="color: #1f2937;">saccb.fr</a>.</p>
            <p style="margin: 14px 0 0;">Merci pour ton retour,<br/>Le bureau du SACCB</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 22px; padding-top: 14px; border-top: 1px solid #e2e8f0; width: 100%;">
              <tr>
                <td style="vertical-align: middle; padding-right: 12px; width: 44px;">
                  <img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" />
                </td>
                <td style="vertical-align: middle;">
                  <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                  <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                  <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> · <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                </td>
              </tr>
            </table>
          </div>`,
        });
      if (sendRes.ok) sentCount++;
      else errors.push(`${recipient.email}: ${sendRes.status}`);
      await sleep(EMAIL_THROTTLE_MS);
    }

    if (sentCount === 0) return json({ ok: false, reason: "Aucun email envoyé. " + errors.slice(0, 3).join(" | ") });
    await logEmailToHistory(supabaseAdmin, {
      type: "poll_notification",
      subject: `Nouveau sondage : ${pollQuestion}`,
      body: `Notification d'un nouveau sondage envoyée aux adhérents (payés + news)`,
      recipients: recipients.map((r) => r.email),
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
      status: sentCount < recipients.length ? "partial" : "sent",
      sentCount,
    });
    return json({ ok: true, sent: sentCount, total: recipients.length });
  }

  // ─── ACTION: Notifier les adhérents que la section Sondages & AG est ouverte ───
  if (action === "notify_engagement_open") {
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    // 🔒 Auth admin obligatoire
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const includePolls = body.includePolls === true;
    const includeAG = body.includeAG === true;
    const includeReports = body.includeReports === true;
    if (!includePolls && !includeAG && !includeReports) {
      return json({ ok: false, reason: "Au moins une section (sondages, AG ou comptes-rendus) doit être incluse." }, 400);
    }

    const membres = (d.membres || []) as Record<string, unknown>[];
    const recipients = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
      .filter((r) => r.email);

    if (recipients.length === 0) return json({ ok: false, reason: "Aucun adhérent à notifier." });

    // Construction du contenu selon ce qui est ouvert
    const parts: string[] = [];
    if (includePolls) parts.push("sondages");
    if (includeAG) parts.push("préparation AG");
    if (includeReports) parts.push("comptes-rendus");
    const topic =
      parts.length === 3
        ? "Sondages, AG et comptes-rendus"
        : parts.length === 2
        ? parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(" + ")
        : includePolls
        ? "Sondages en cours"
        : includeAG
        ? "Préparation de l'assemblée générale"
        : "Comptes-rendus de réunion";
    const topicEmail =
      includePolls && includeAG && includeReports
        ? "consulter les sondages en cours, préparer la prochaine assemblée générale et lire les derniers comptes-rendus"
        : includePolls && includeAG
        ? "préparer ensemble la prochaine assemblée générale et participer aux sondages en cours"
        : includePolls && includeReports
        ? "participer aux sondages en cours et consulter les derniers comptes-rendus"
        : includeAG && includeReports
        ? "préparer la prochaine assemblée générale et consulter les derniers comptes-rendus"
        : includePolls
        ? "donner votre avis sur les sondages en cours"
        : includeAG
        ? "préparer ensemble la prochaine assemblée générale en posant vos questions et en partageant vos idées"
        : "consulter les comptes-rendus des dernières réunions";

    // Bloc procuration : ajoute uniquement si l'AG est concernee
    const procurationBlockHtml = includeAG ? `
                <div style="margin-top: 22px; padding: 16px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;">
                  <p style="margin: 0 0 10px; color: #92400e; font-weight: 600; font-size: 14px;">📝 Pas disponible le jour de l'AG&nbsp;?</p>
                  <p style="margin: 0 0 12px; color: #92400e; font-size: 13px;">Vous pouvez générer votre <strong>procuration</strong> directement depuis votre espace membre pour vous faire représenter par un autre adhérent.</p>
                  <a href="https://saccb.fr/?member=1&procuration=1" style="display: inline-block; background: #b45309; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px;">
                    📝 Générer ma procuration →
                  </a>
                </div>` : "";
    const procurationBlockText = includeAG
      ? `\n\nPas disponible le jour de l'AG ?\nGénérez votre procuration en 1 clic depuis votre espace membre : https://saccb.fr/?member=1&procuration=1`
      : "";

    let sentCount = 0;
    const errors: string[] = [];
    for (const recipient of recipients) {
      const greeting = recipient.prenom ? `Bonjour ${escapeHtml(recipient.prenom)},` : "Bonjour,";
      const greetingText = recipient.prenom ? `Bonjour ${recipient.prenom},` : "Bonjour,";
      const subject = recipient.prenom
        ? `${recipient.prenom}, ${topic.toLowerCase()} au SACCB`
        : `${topic} au SACCB`;
      // 🎯 Phrase d'incitation adaptée : si SEULEMENT comptes-rendus (lecture seule),
      // on ne dit pas "donne ton avis" car il n'y a rien à voter / commenter.
      const onlyReports = includeReports && !includePolls && !includeAG;
      const callToAction = onlyReports
        ? "Bonne lecture !"
        : "C'est l'occasion de donner ton avis et de contribuer à la vie de l'association.";
      const callToActionText = onlyReports
        ? "Bonne lecture !"
        : "C'est l'occasion de faire entendre votre voix et de contribuer à la vie de l'association.";

      const plainText = `${greetingText}\n\nUne nouvelle section est disponible sur le site de l'association !\n\nVous pouvez maintenant ${topicEmail}.\n\n${callToActionText}\n\nAccéder à l'espace : https://saccb.fr/?member=1${procurationBlockText}\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;

      // 📨 Design "mail perso" sobre + logo SACCB en signature
      const sendRes = await sendBrevo(brevoKey, {
          from: "SACCB <contact@saccb.fr>",
          to: [recipient.email],
          subject,
          text: plainText,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0; padding: 16px; color: #1f2937; line-height: 1.6; font-size: 15px;">
            <p style="margin: 0 0 14px;">${greeting}</p>
            <p style="margin: 0 0 14px;">Petit message pour t'informer qu'une nouvelle section est ouverte sur le site : tu peux maintenant ${topicEmail}.</p>
            <p style="margin: 0 0 14px;">${callToAction} Tu peux y accéder en te connectant à ton espace membre sur <a href="https://saccb.fr/?member=1" style="color: #1f2937;">saccb.fr</a>.</p>
            ${procurationBlockHtml}
            <p style="margin: 14px 0 0;">À bientôt,<br/>Le bureau du SACCB</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 22px; padding-top: 14px; border-top: 1px solid #e2e8f0; width: 100%;">
              <tr>
                <td style="vertical-align: middle; padding-right: 12px; width: 44px;">
                  <img src="https://saccb.fr/logo.png" alt="SACCB" width="44" height="44" style="display: block; border-radius: 8px;" />
                </td>
                <td style="vertical-align: middle;">
                  <p style="margin: 0; color: #1e3a5f; font-weight: 700; font-size: 13px;">SACCB</p>
                  <p style="margin: 0; color: #64748b; font-size: 11px;">Sainte-Adresse Club de Compétition de Badminton</p>
                  <p style="margin: 4px 0 0; color: #94a3b8; font-size: 11px;"><a href="mailto:contact@saccb.fr" style="color: #1e3a5f; text-decoration: none;">contact@saccb.fr</a> · <a href="https://saccb.fr" style="color: #1e3a5f; text-decoration: none;">saccb.fr</a></p>
                </td>
              </tr>
            </table>
          </div>`,
        });
      if (sendRes.ok) sentCount++;
      else errors.push(`${recipient.email}: ${sendRes.status}`);
      await sleep(EMAIL_THROTTLE_MS);
    }

    if (sentCount === 0) {
      return json({ ok: false, reason: "Aucun email envoyé. " + errors.slice(0, 3).join(" | ") });
    }
    await logEmailToHistory(supabaseAdmin, {
      type: "engagement_notification",
      subject: `${topic} au SACCB`,
      body: `Notification "engagement ouvert" (${parts.join(" + ")}) envoyée aux adhérents`,
      recipients: recipients.map((r) => r.email),
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
      status: sentCount < recipients.length ? "partial" : "sent",
      sentCount,
    });
    return json({ ok: true, sent: sentCount, total: recipients.length });
  }

  // ─── ACTION: Envoyer un compte-rendu specifique a tous les adherents — AUTH ADMIN ───
  if (action === "send_report_to_members") {
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configuré." });

    const reportId = String(body.reportId || "");
    if (!reportId) return json({ ok: false, reason: "reportId manquant." }, 400);

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    // 🔒 Auth admin
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    const reports = (d.reunionReports || []) as Record<string, unknown>[];
    const report = reports.find((r) => r.id === reportId);
    if (!report) return json({ ok: false, reason: "Compte-rendu introuvable." });

    const membres = (d.membres || []) as Record<string, unknown>[];
    const recipients = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
      .filter((r) => r.email);

    if (recipients.length === 0) return json({ ok: false, reason: "Aucun adhérent à notifier." });

    const reportTitle = String(report.title || "Compte-rendu");
    const reportDate = String(report.date || "");
    const reportDateFormatted = reportDate
      ? new Date(reportDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const reportContent = String(report.content || "").trim();
    const reportPdfUrl = String(report.pdfUrl || "");
    const reportPdfName = String(report.pdfName || "");
    // Aperçu du texte (premiers 500 caracteres)
    const contentPreview = reportContent.length > 0
      ? reportContent.length > 500
        ? reportContent.slice(0, 500) + "..."
        : reportContent
      : "";

    const pdfBlockHtml = reportPdfUrl
      ? `<div style="margin-top: 18px; padding: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <p style="margin: 0 0 10px; color: #1e3a5f; font-size: 13px;">📎 Le compte-rendu complet est disponible en PDF&nbsp;:</p>
          <a href="${escapeHtml(reportPdfUrl)}" style="display: inline-block; background: #1e3a5f; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px;">
            📄 Télécharger le PDF${reportPdfName ? ` (${escapeHtml(reportPdfName)})` : ""}
          </a>
        </div>`
      : "";

    let sentCount = 0;
    const errors: string[] = [];
    for (const recipient of recipients) {
      const greeting = recipient.prenom ? `Bonjour ${escapeHtml(recipient.prenom)},` : "Bonjour,";
      const greetingText = recipient.prenom ? `Bonjour ${recipient.prenom},` : "Bonjour,";
      const subject = recipient.prenom
        ? `${recipient.prenom}, compte-rendu : ${reportTitle}`
        : `Compte-rendu : ${reportTitle}`;
      const plainText = `${greetingText}\n\nLe bureau de l'association met à votre disposition le compte-rendu suivant :\n\n${reportTitle}${reportDateFormatted ? ` — ${reportDateFormatted}` : ""}\n\n${contentPreview || "(voir PDF joint)"}${reportPdfUrl ? `\n\nPDF complet : ${reportPdfUrl}` : ""}\n\nVous pouvez aussi retrouver ce compte-rendu et les précédents dans la section Comptes-rendus du site : https://saccb.fr/#engagement\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;

      const sendRes = await sendBrevo(brevoKey, {
        from: "SACCB <contact@saccb.fr>",
        headers: {
          "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        to: [recipient.email],
        subject,
        text: plainText,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 22px;">SACCB</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">Compte-rendu de réunion</p>
            </div>
            <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <p style="color: #475569; margin: 0 0 16px;">${greeting}</p>
              <h2 style="color: #1e3a5f; margin-top: 0; font-size: 20px;">📋 ${escapeHtml(reportTitle)}</h2>
              ${reportDateFormatted ? `<p style="color: #64748b; font-size: 13px; margin: 0 0 16px;">Réunion du ${reportDateFormatted}</p>` : ""}
              ${contentPreview ? `<div style="white-space: pre-wrap; color: #334155; line-height: 1.6; padding: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 8px;">${escapeHtml(contentPreview)}</div>` : ""}
              ${pdfBlockHtml}
              <p style="color: #64748b; font-size: 12px; margin-top: 18px;">
                Vous pouvez aussi consulter ce compte-rendu et les précédents dans la section "Comptes-rendus" du site.
              </p>
              <a href="https://saccb.fr/#engagement" style="display: inline-block; margin-top: 8px; color: #1e3a5f; text-decoration: underline; font-size: 13px;">
                Voir tous les comptes-rendus →
              </a>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 14px; width: 100%;">
                <tr><td>
                  <p style="margin: 0; color: #1e3a5f; font-size: 13px; font-weight: 600;">Bonne lecture !</p>
                  <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Le bureau du SACCB 🏸</p>
                </td></tr>
              </table>
            </div>
          </div>
        `,
      });
      if (sendRes.ok) sentCount++;
      else errors.push(`${recipient.email}: ${sendRes.status}`);
      await sleep(EMAIL_THROTTLE_MS);
    }

    if (sentCount === 0) {
      return json({ ok: false, reason: "Aucun email envoyé. " + errors.slice(0, 3).join(" | ") });
    }
    await logEmailToHistory(supabaseAdmin, {
      type: "report_sent",
      subject: `Compte-rendu : ${reportTitle}`,
      body: `Envoi du compte-rendu "${reportTitle}" du ${reportDateFormatted} aux adhérents${reportPdfUrl ? " (avec PDF joint)" : ""}`,
      recipients: recipients.map((r) => r.email),
      sentBy: String(body.adminEmail || "").toLowerCase().trim() || "admin",
      status: sentCount < recipients.length ? "partial" : "sent",
      sentCount,
    });
    return json({ ok: true, sent: sentCount, total: recipients.length });
  }

  // ─── ACTION: Envoyer la sauvegarde complète par email — AUTH ADMIN REQUISE ───
  if (action === "send_backup_email") {
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configure." });

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;
    const authError = await checkAdminAuth(body, d);
    if (authError) return authError;

    // Determiner l'email de destination
    const backupConfig = d.backupEmailConfig as Record<string, unknown> | undefined;
    const destEmail = (backupConfig?.email as string) || String(body.adminEmail || "").toLowerCase().trim();
    if (!destEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destEmail)) {
      return json({ ok: false, reason: "Email de destination invalide. Configurez-le dans les parametres de sauvegarde." });
    }

    // Generer le JSON de sauvegarde
    const backupJson = JSON.stringify(d, null, 2);
    const backupBase64 = btoa(unescape(encodeURIComponent(backupJson)));
    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const filename = `saccb_backup_${ts}.txt`;

    // Compter les stats
    const nbMembres = Array.isArray(d.membres) ? (d.membres as unknown[]).length : 0;
    const nbTournois = Array.isArray(d.config_tournois) ? (d.config_tournois as unknown[]).length : 0;

    // Envoyer via sendBrevo (avec fallback Resend)
    const sendRes = await sendBrevo(brevoKey, {
      from: "SACCB Backup <contact@saccb.fr>",
      to: [destEmail],
      subject: `Sauvegarde SACCB — ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px 20px;">
          <div style="background: #1e3a5f; border-radius: 12px; padding: 20px 24px; text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; color: white; font-size: 20px;">Sauvegarde SACCB</h1>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Voici la sauvegarde complete de la base de donnees SACCB au <strong>${new Date().toLocaleDateString("fr-FR")}</strong>.
          </p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #475569;">
              <strong>${nbMembres}</strong> adherent${nbMembres > 1 ? "s" : ""} |
              <strong>${nbTournois}</strong> tournoi${nbTournois > 1 ? "s" : ""}
            </p>
          </div>
          <p style="color: #64748b; font-size: 12px;">
            Le fichier JSON en piece jointe peut etre utilise pour restaurer la base via le panneau admin (bouton "Restaurer").
          </p>
        </div>
      `,
      attachments: [{ filename, content: backupBase64 }],
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text().catch(() => "");
      return json({ ok: false, reason: `Erreur d'envoi email (${sendRes.status}): ${errText.slice(0, 200)}` });
    }

    // Mettre a jour lastSentAt
    const updatedConfig = {
      ...(backupConfig || {}),
      lastSentAt: new Date().toISOString(),
    };
    d.backupEmailConfig = updatedConfig;
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);

    return json({ ok: true });
  }

  // ─── ACTION: Backup email automatique (appele par cron/keepalive) ───
  if (action === "check_backup_email") {
    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    const backupConfig = d.backupEmailConfig as Record<string, unknown> | undefined;
    if (!backupConfig || backupConfig.enabled !== true || !backupConfig.email) {
      return json({ ok: false, reason: "Backup email non active." });
    }

    // Verifier si le dernier envoi date de plus de 30 jours
    const lastSent = backupConfig.lastSentAt ? new Date(String(backupConfig.lastSentAt)).getTime() : 0;
    const daysSinceLast = (Date.now() - lastSent) / (1000 * 60 * 60 * 24);
    if (daysSinceLast < 28) {
      return json({ ok: false, reason: `Dernier envoi il y a ${Math.floor(daysSinceLast)} jours (< 28j).` });
    }

    // Declencher l'envoi (meme logique que send_backup_email mais sans auth)
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) return json({ ok: false, reason: "Service email non configure." });

    const destEmail = String(backupConfig.email);
    const backupJson = JSON.stringify(d, null, 2);
    const backupBase64 = btoa(unescape(encodeURIComponent(backupJson)));
    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const filename = `saccb_auto_backup_${ts}.txt`;
    const nbMembres = Array.isArray(d.membres) ? (d.membres as unknown[]).length : 0;
    const nbTournois = Array.isArray(d.config_tournois) ? (d.config_tournois as unknown[]).length : 0;

    const sendRes = await sendBrevo(brevoKey, {
      from: "SACCB Backup Auto <contact@saccb.fr>",
      to: [destEmail],
      subject: `[Auto] Sauvegarde SACCB — ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px 20px;">
          <div style="background: linear-gradient(135deg, #059669, #047857); border-radius: 12px; padding: 20px 24px; text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; color: white; font-size: 20px;">Sauvegarde automatique SACCB</h1>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Sauvegarde mensuelle automatique du <strong>${new Date().toLocaleDateString("fr-FR")}</strong>.
          </p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #475569;">
              <strong>${nbMembres}</strong> adherent${nbMembres > 1 ? "s" : ""} |
              <strong>${nbTournois}</strong> tournoi${nbTournois > 1 ? "s" : ""}
            </p>
          </div>
          <p style="color: #64748b; font-size: 12px;">
            Cet email est envoye automatiquement chaque mois. Vous pouvez desactiver cette fonctionnalite dans les parametres de sauvegarde du panneau admin.
          </p>
        </div>
      `,
      attachments: [{ filename, content: backupBase64 }],
    });

    if (!sendRes.ok) return json({ ok: false, reason: "Erreur d'envoi." });

    d.backupEmailConfig = { ...backupConfig, lastSentAt: new Date().toISOString() };
    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);

    return json({ ok: true, message: "Backup automatique envoye." });
  }

  // ─── ACTION: Toggle mode présentation (code secret via env var) ───
  if (action === "toggle_presentation") {
    const rawSecret = String(body.secret || "").trim();
    const isRemove = rawSecret.endsWith(":remove");
    const isRestore = rawSecret.endsWith(":restore");
    const secret = rawSecret.replace(/:(remove|restore)$/, "");
    const expected = Deno.env.get("PRESENTATION_SECRET");
    if (!expected) return json({ ok: false, reason: "Code secret non configure sur le serveur." });
    if (secret !== expected) return json({ ok: false, reason: "Code incorrect." });

    const { data, error } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);
    const d = data.data as Record<string, unknown>;

    if (isRemove) {
      // Suppression définitive : désactiver + marquer comme supprimé
      d.presentationMode = false;
      d.presentationModeRemoved = true;
      await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
      return json({ ok: true, presentationMode: false, removed: true });
    }

    if (isRestore) {
      // Restaurer le bouton présentation (annuler le :remove)
      d.presentationModeRemoved = false;
      await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
      return json({ ok: true, restored: true });
    }

    const currentMode = d.presentationMode === true;
    d.presentationMode = !currentMode;

    await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);

    return json({ ok: true, presentationMode: !currentMode });
  }

  return json({ error: "Action inconnue" }, 400);
});
