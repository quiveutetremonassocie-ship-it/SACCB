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
                  ${currentData.whatsappLink ? `
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 16px;">
                    <p style="margin: 0 0 10px; color: #166534; font-size: 14px;">📱 Rejoignez le groupe WhatsApp du club :</p>
                    <a href="${currentData.whatsappLink}" style="display: inline-flex; align-items: center; gap: 8px; background: #25D366; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                      💬 Rejoindre le groupe WhatsApp
                    </a>
                  </div>
                  ` : ""}
                  <a href="https://saccb.fr" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
                    Accéder à mon espace membre →
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
      clubRules: d.clubRules ?? "",
      clubRulesPdfUrl: d.clubRulesPdfUrl ?? null,
      clubRulesPdfName: d.clubRulesPdfName ?? null,
    });
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
    const membre = matchedMembre && String(matchedMembre.id || "") === membreId && matchedMembre.ok === true ? matchedMembre : undefined;
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

    if (!email || !code) return json({ ok: false, reason: "Email et code requis." }, 400);

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

    // Vérifier d'abord les credentials admin indépendants (pas besoin d'être adhérent)
    const adminCred = await findAdminCredByCredentials(adminCredentials, email, code);
    if (adminCred) {
      // Migration douce du code en clair → hashé
      if (!isHashedCode(adminCred.code)) {
        await migrateCodeIfNeeded(supabaseAdmin, currentData, { type: "adminCred", email, plainCode: code });
      }
      return json({
        ok: true,
        paid: true,
        isAdmin: true,
        membre: { id: "admin-" + email, nom: email, type: "Adulte", email },
      });
    }

    // Sinon vérifier dans les adhérents normaux
    const membre = await findMembreByCredentials(membres, email, code);

    if (!membre) {
      return json({ ok: false, reason: "Email ou code incorrect." });
    }

    // Migration douce du code en clair → hashé
    if (!isHashedCode(String(membre.code || ""))) {
      await migrateCodeIfNeeded(supabaseAdmin, currentData, { type: "membre", id: String(membre.id), plainCode: code });
    }

    const isAdmin = adminEmails.includes(email);
    const codeJustReset = membre.codeJustReset === true;

    // Si le flag est levé, on le retire en base : la popup ne s'affichera qu'une fois après reset
    if (codeJustReset) {
      const idx = membres.findIndex((m) => m.id === membre.id);
      if (idx !== -1) {
        const { codeJustReset: _drop, ...rest } = membres[idx] as Record<string, unknown>;
        membres[idx] = rest;
        currentData.membres = membres;
        await supabaseAdmin.from("saccb_db").update({ data: currentData }).eq("id", 1);
      }
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
      },
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

    return json({ ok: true });
  }

  // ─── ACTION: Inscription publique ───
  if (action === "add_membre") {
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
          return json({ ok: false, reason: "Une adhésion active existe déjà pour ces informations. Connectez-vous à votre espace membre ou contactez le club." });
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
      return json({ ok: false, reason: "Le club est complet !" });
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

    inscrits.push({
      id: Date.now().toString(),
      tournoiId,
      joueurs: `${p1} / ${p2}`,
    });
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
      const plainTextN = `${greetingTextN}\n\nUn nouveau tournoi vient d'être ajouté sur le site du club : ${tournoi.name}\n${dateStr}\n\nConnectez-vous à votre espace membre pour inscrire votre binôme : https://saccb.fr/#tournois\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;
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
              <p style="color: #475569;">Un nouveau tournoi vient d'être ajouté sur le site du club :</p>
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
    const unpaidRecipients = membres
      .filter((m) => m.ok !== true)
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
      .filter((r) => r.email);
    const unpaidEmails = unpaidRecipients.map((r) => r.email);

    // Membres payés ayant accepté les news — destinataires des rappels tournois
    const newsRecipients = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
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
          // Sujet personnalisé : 'Marie, votre adhésion SACCB' au lieu de '⏰ Plus que X jours'
          const subjectLabel = recipient.prenom
            ? `${recipient.prenom}, votre adhésion SACCB ${daysLeft === 1 ? "expire demain" : `expire dans ${daysLeft} jours`}`
            : `Votre adhésion SACCB ${daysLeft === 1 ? "expire demain" : `expire dans ${daysLeft} jours`}`;
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
      if (kept.length < before) {
        d.membres = kept;
        d.insc_open = false;
        await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
        results.cleanup = { removed: before - kept.length };
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

      // 🎯 Exclure les membres déjà inscrits à CE tournoi (inutile de leur envoyer un rappel)
      const inscritsCeTournoi = inscritsTournoi.filter((i) => i.tournoiId === t.id);
      const inscritsNoms = inscritsCeTournoi
        .map((i) => String(i.joueurs || "").toLowerCase())
        .join(" | ");
      const newsRecipientsForThisT = newsRecipients.filter((r) => {
        if (!r.prenom) return true; // si pas de prénom, on ne peut pas matcher → on garde par sécurité
        const nameLower = r.prenom.toLowerCase();
        // Si le prénom du membre apparaît dans la liste des inscrits → on l'exclut
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
    }

    return json({ ok: true });
  }

  // ─── ACTION: Réinitialiser le code d'un adhérent depuis l'admin ───
  // Génère un nouveau code aléatoire, le hash, l'envoie par email et lève le flag codeJustReset
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
              ${currentData.whatsappLink ? `
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 16px;">
                <p style="margin: 0 0 10px; color: #166534; font-size: 14px;">📱 Rejoignez le groupe WhatsApp du club pour rester informé des entraînements et tournois :</p>
                <a href="${currentData.whatsappLink}" style="display: inline-flex; align-items: center; gap: 8px; background: #25D366; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                  💬 Rejoindre le groupe WhatsApp
                </a>
              </div>
              ` : ""}
              <a href="https://saccb.fr" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
                Accéder à mon espace membre →
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

    return json({ ok: true });
  }

  // ─── ACTION: Formulaire de contact public ───
  if (action === "contact") {
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
        subject: "🏸 Bienvenue au SACCB — Votre accès espace membre",
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
              <h2 style="color: #1e3a5f; margin-top: 0;">🎉 Bienvenue au club, ${membre.nom} !</h2>
              <p style="color: #475569;">
                Vous avez été inscrit(e) au SACCB pour la saison <strong>${currentData.y1}–${currentData.y2}</strong>.
                Vous avez accès à votre espace membre sur le site du club.
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
                <p style="margin: 0 0 10px; color: #166534; font-size: 14px;">📱 Rejoignez le groupe WhatsApp du club :</p>
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
    const removed = before - kept.length;

    if (removed === 0) return json({ ok: true, removed: 0, reason: "Aucun membre à supprimer." });

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
      const greetingA = prenomAdmin ? `Bonjour ${escapeHtml(prenomAdmin)},` : "Bonjour,";
      const greetingTextA = prenomAdmin ? `Bonjour ${prenomAdmin},` : "Bonjour,";
      const plainTextA = `${greetingTextA}\n\n${htmlBody.replace(/<[^>]+>/g, "")}\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;
      const sendRes = await sendBrevo(brevoKey, {
          from: "SACCB <contact@saccb.fr>",
          headers: {
            "List-Unsubscribe": "<mailto:contact@saccb.fr?subject=unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          to: [recipientEmail],
          subject: subject.trim(),
          text: plainTextA,
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
                <p style="color: #475569; margin: 0 0 16px;">${greetingA}</p>
                <div style="color: #475569; line-height: 1.6; white-space: pre-wrap;">${htmlBody}</div>
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
        subject: subject.trim(),
        body: htmlBody.slice(0, 5000), // limite à 5000 chars pour pas exploser la DB
        recipientCount: recipientEmails.length,
        recipientsPreview: recipientEmails.slice(0, 3),
        targetMode,
        sentBy: adminEmailUsed,
        attachmentNames: emailAttachments.map((a) => a.filename),
        status: errors.length > 0 ? "partial" : "sent",
        sentCount: totalSent,
        totalCount: recipientEmails.length,
      });
      // Garder uniquement les 100 derniers (anti-explosion DB)
      const trimmed = emailHistory.slice(-100);
      d.emailHistory = trimmed;
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
      const plainText = `${greetingText}\n\nUn nouveau sondage est disponible sur le site du club :\n\n"${pollQuestion}"\n\n${optionsList}\n\nDonnez votre avis : https://saccb.fr/?member=1\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;

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
              <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
                <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
                <div>
                  <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
                </div>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                <p style="color: #475569; margin: 0 0 16px;">${greeting}</p>
                <h2 style="color: #1e3a5f; margin-top: 0;">📊 Un nouveau sondage vous attend !</h2>
                <p style="color: #475569;">Le bureau souhaite recueillir votre avis :</p>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 0 0 12px; font-size: 16px; font-weight: bold; color: #1e3a5f;">${escapeHtml(pollQuestion)}</p>
                  ${((poll.options as string[]) || []).slice(0, 5).map((o) => `<p style="margin: 4px 0; color: #64748b; font-size: 13px;">• ${escapeHtml(o)}</p>`).join("")}
                </div>
                <a href="https://saccb.fr/?member=1" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                  📊 Donner mon avis →
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
      if (sendRes.ok) sentCount++;
      else errors.push(`${recipient.email}: ${sendRes.status}`);
      await sleep(EMAIL_THROTTLE_MS);
    }

    if (sentCount === 0) return json({ ok: false, reason: "Aucun email envoyé. " + errors.slice(0, 3).join(" | ") });
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

    const includePolls = body.includePolls !== false;
    const includeAG = body.includeAG !== false;
    if (!includePolls && !includeAG) {
      return json({ ok: false, reason: "Au moins un des 2 (sondages ou AG) doit être inclus." }, 400);
    }

    const membres = (d.membres || []) as Record<string, unknown>[];
    const recipients = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
      .map((m) => ({ email: String(m.email || ""), prenom: extractFirstName(String(m.nom || "")) }))
      .filter((r) => r.email);

    if (recipients.length === 0) return json({ ok: false, reason: "Aucun adhérent à notifier." });

    // Construction du contenu selon ce qui est ouvert
    let topic = "";
    let topicEmail = "";
    if (includePolls && includeAG) {
      topic = "Sondages et préparation de l'AG";
      topicEmail = "préparer ensemble la prochaine assemblée générale et participer aux sondages en cours";
    } else if (includePolls) {
      topic = "Sondages en cours";
      topicEmail = "donner votre avis sur les sondages en cours";
    } else {
      topic = "Préparation de l'assemblée générale";
      topicEmail = "préparer ensemble la prochaine assemblée générale en posant vos questions et en partageant vos idées";
    }

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
      const plainText = `${greetingText}\n\nUne nouvelle section est disponible sur le site du club !\n\nVous pouvez maintenant ${topicEmail}.\n\nC'est l'occasion de faire entendre votre voix et de contribuer à la vie du club.\n\nAccéder à l'espace : https://saccb.fr/?member=1${procurationBlockText}\n\n--\nSACCB - Sainte-Adresse Club de Compétition de Badminton\ncontact@saccb.fr · saccb.fr`;

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
              <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 16px;">
                <img src="https://saccb.fr/logo.png" alt="SACCB" width="56" height="56" style="background: white; border-radius: 12px; padding: 4px; display: block;" />
                <div>
                  <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
                </div>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                <p style="color: #475569; margin: 0 0 16px;">${greeting}</p>
                <h2 style="color: #1e3a5f; margin-top: 0;">📣 ${topic}</h2>
                <p style="color: #475569;">Une nouvelle section est disponible sur le site du club !</p>
                <p style="color: #475569;">Vous pouvez maintenant <strong>${topicEmail}</strong>.</p>
                <p style="color: #475569;">C'est l'occasion de faire entendre votre voix et de contribuer à la vie du club.</p>
                <a href="https://saccb.fr/?member=1" style="display: inline-block; background: #1e3a5f; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 8px;">
                  📣 Accéder à l'espace →
                </a>
                ${procurationBlockHtml}
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
      if (sendRes.ok) sentCount++;
      else errors.push(`${recipient.email}: ${sendRes.status}`);
      await sleep(EMAIL_THROTTLE_MS);
    }

    if (sentCount === 0) {
      return json({ ok: false, reason: "Aucun email envoyé. " + errors.slice(0, 3).join(" | ") });
    }
    return json({ ok: true, sent: sentCount, total: recipients.length });
  }

  return json({ error: "Action inconnue" }, 400);
});
