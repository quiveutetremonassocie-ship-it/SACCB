import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Rate limiting simple en mémoire (par IP, reset au redéploiement)
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    return json({
      insc_open: d.insc_open ?? true,
      y1: d.y1 ?? 2024,
      y2: d.y2 ?? 2025,
      quota: d.quota ?? 65,
      config_tournois: d.config_tournois ?? [],
      inscrits_tournoi: d.inscrits_tournoi ?? [],
      actualites: d.actualites ?? [],
      membresCount: ((d.membres as unknown[]) || []).length,
    });
  }

  // ─── ACTION: Inscription publique ───
  if (action === "add_membre") {
    const nom = sanitize(String(body.nom || ""));
    const email = sanitize(String(body.email || "")).toLowerCase();
    const tel = sanitize(String(body.tel || ""));
    const type = body.type === "Etudiant" ? "Etudiant" : "Adulte";
    const paymentMethod = body.paymentMethod === "virement" ? "virement" : "online";

    // Validation
    if (!nom || nom.length < 2) return json({ ok: false, reason: "Nom invalide." }, 400);
    if (!isValidEmail(email)) return json({ ok: false, reason: "Email invalide." }, 400);
    if (!isValidPhone(tel)) return json({ ok: false, reason: "Téléphone invalide." }, 400);

    // Lire les données actuelles
    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];

    // Vérifier doublon email
    if (membres.find((m) => m.email === email)) {
      return json({ ok: false, reason: "Cet email est déjà inscrit !" });
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

  // ─── ACTION: Marquer un membre comme payé (retour HelloAsso) ───
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

    let found = false;
    for (const m of membres) {
      if (m.id === membreId && !m.ok) {
        m.ok = true;
        m.paymentDate = new Date().toISOString();
        found = true;
        break;
      }
    }

    if (!found) return json({ ok: false });

    currentData.membres = membres;
    const { error: updateError } = await supabaseAdmin
      .from("saccb_db")
      .update({ data: currentData })
      .eq("id", 1);

    if (updateError) return json({ ok: false }, 500);

    const sheetsWebhook = Deno.env.get("SHEETS_WEBHOOK");
    if (sheetsWebhook) {
      fetch(sheetsWebhook, {
        method: "POST",
        body: JSON.stringify(currentData),
      }).catch(() => {});
    }

    return json({ ok: true });
  }

  // ─── ACTION: Sync Google Sheets (appelé depuis l'admin après saveDB) ───
  if (action === "sync_sheets") {
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
    const tournoiId = sanitize(String(body.tournoiId || ""));
    const p1 = sanitize(String(body.p1 || ""));
    const p2 = sanitize(String(body.p2 || ""));

    if (!tournoiId || !p1 || !p2) return json({ ok: false, reason: "Champs manquants." }, 400);
    if (p1.length < 2 || p2.length < 2) return json({ ok: false, reason: "Noms trop courts." }, 400);

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

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

  return json({ error: "Action inconnue" }, 400);
});
