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

  // ─── WEBHOOK HELLOASSO (notification automatique de paiement) ───
  // HelloAsso envoie un payload avec eventType, pas de champ "action"
  if (body.eventType === "Payment" || body.eventType === "Order") {
    // Vérifier que l'appel vient bien de HelloAsso (IP whitelist)
    const helloassoIP = "51.138.206.200";
    const callerIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

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
        break;
      }
    }

    if (found) {
      currentData.membres = membres;
      await supabaseAdmin
        .from("saccb_db")
        .update({ data: currentData })
        .eq("id", 1);

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

    // Incrémenter le compteur de visites du jour
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const pageviews = (d.pageviews || {}) as Record<string, number>;
    pageviews[today] = (pageviews[today] || 0) + 1;

    // Garder seulement les 60 derniers jours pour ne pas surcharger
    const keys = Object.keys(pageviews).sort();
    if (keys.length > 60) {
      keys.slice(0, keys.length - 60).forEach((k) => delete pageviews[k]);
    }
    d.pageviews = pageviews;

    // Sauvegarder les visites (fire and forget)
    supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1).then(() => {});

    // On ne renvoie JAMAIS les données sensibles (emails, tels, factures)
    return json({
      insc_open: d.insc_open ?? true,
      y1: d.y1 ?? 2024,
      y2: d.y2 ?? 2025,
      quota: d.quota ?? 65,
      config_tournois: d.config_tournois ?? [],
      inscrits_tournoi: d.inscrits_tournoi ?? [],
      actualites: d.actualites ?? [],
      archives: d.archives ?? [],
      whatsappLink: d.whatsappLink ?? null,
      membresCount: ((d.membres as unknown[]) || []).length,
      pageviews,
    });
  }

  // ─── ACTION: Vérification membre (connexion espace membre) ───
  if (action === "verify_membre") {
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

    const membre = membres.find(
      (m) =>
        String(m.email || "").toLowerCase() === email &&
        String(m.code || "") === code &&
        m.ok === true
    );

    if (!membre) {
      return json({
        ok: false,
        reason: "Email ou code incorrect, ou adhésion non encore validée.",
      });
    }

    return json({
      ok: true,
      membre: {
        id: membre.id,
        nom: membre.nom,
        type: membre.type,
        email: membre.email,
      },
    });
  }

  // ─── ACTION: Inscription publique ───
  if (action === "add_membre") {
    const nom = sanitize(String(body.nom || ""));
    const email = sanitize(String(body.email || "")).toLowerCase();
    const tel = sanitize(String(body.tel || ""));
    const type = body.type === "Etudiant" ? "Etudiant" : "Adulte";
    const paymentMethod = body.paymentMethod === "virement" ? "virement" : "online";
    const code = sanitize(String(body.code || ""));

    // Validation
    if (!nom || nom.length < 2) return json({ ok: false, reason: "Nom invalide." }, 400);
    if (!isValidEmail(email)) return json({ ok: false, reason: "Email invalide." }, 400);
    if (!isValidPhone(tel)) return json({ ok: false, reason: "Téléphone invalide." }, 400);
    if (!code || !/^\d{4,}$/.test(code)) {
      return json({ ok: false, reason: "Le code doit contenir au moins 4 chiffres." }, 400);
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
      code,
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

    // Email de confirmation de paiement (fire and forget)
    const paidMembre = membres.find((m) => m.id === membreId);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && paidMembre) {
      const prixMap: Record<string, number> = { Adulte: 50, Etudiant: 30 };
      const prix = prixMap[String(paidMembre.type)] ?? 50;
      const membreCode = String(paidMembre.code || "");
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SACCB <contact@saccb.fr>",
          to: [String(paidMembre.email)],
          subject: "🏸 Paiement confirmé — Bienvenue au SACCB !",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
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
                  <p style="margin: 0 0 6px; color: #92400e; font-size: 13px; font-weight: bold;">🔑 Votre code personnel</p>
                  <p style="margin: 0 0 8px; color: #92400e; font-size: 13px;">Conservez-le précieusement pour vous connecter à votre espace membre sur saccb.fr :</p>
                  <p style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e3a5f; text-align: center;">${membreCode}</p>
                </div>
                <a href="https://saccb.fr" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                  Accéder à mon espace membre →
                </a>
                ${currentData.whatsappLink ? `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 16px;">
                  <p style="margin: 0 0 10px; color: #166534; font-size: 14px;">📱 Rejoignez le groupe WhatsApp du club pour rester informé des entraînements et tournois :</p>
                  <a href="${currentData.whatsappLink}" style="display: inline-flex; align-items: center; gap: 8px; background: #25D366; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                    💬 Rejoindre le groupe WhatsApp
                  </a>
                </div>
                ` : ""}
                <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
                  SACCB — Sainte-Adresse, Le Havre
                </p>
              </div>
            </div>
          `,
        }),
      }).catch(() => {});
    }

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

  // ─── ACTION: Notifier les adhérents par email ───
  if (action === "notify_membres") {
    const tournoiId = sanitize(String(body.tournoiId || ""));
    const tournoiName = sanitize(String(body.tournoiName || ""));
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return json({ ok: false, reason: "Service email non configuré (RESEND_API_KEY manquant)." });
    }

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];
    const tournois = (currentData.config_tournois || []) as Record<string, unknown>[];

    const tournoi = tournois.find((t) => t.id === tournoiId);
    if (!tournoi) return json({ ok: false, reason: "Tournoi introuvable." });

    // Récupère les emails des membres ayant payé
    const emails = membres
      .filter((m) => m.ok === true)
      .map((m) => String(m.email || ""))
      .filter(Boolean);

    if (emails.length === 0) {
      return json({ ok: false, reason: "Aucun adhérent actif trouvé." });
    }

    const dateStr = tournoi.dateLimit
      ? `Date limite d'inscription : ${tournoi.dateLimit}`
      : `Date du tournoi : ${tournoi.date}`;

    // Envoi via Resend (BCC pour ne pas exposer les emails entre membres)
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SACCB <contact@saccb.fr>",
        to: ["contact@saccb.fr"],
        bcc: emails,
        subject: `🏸 Nouveau tournoi disponible : ${tournoi.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
            </div>
            <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <h2 style="color: #1e3a5f; margin-top: 0;">🏸 Nouveau tournoi disponible !</h2>
              <p style="color: #475569;">Bonjour,</p>
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
              <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
                Vous recevez cet email car vous êtes membre du SACCB.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return json({ ok: false, reason: "Erreur envoi email : " + errText });
    }

    return json({ ok: true, sent: emails.length });
  }

  // ─── ACTION: Code oublié — envoyer le code par email ───
  if (action === "forgot_code") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    if (!isValidEmail(email)) return json({ ok: false, reason: "Email invalide." }, 400);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];

    const membre = membres.find(
      (m) => String(m.email || "").toLowerCase() === email && m.ok === true
    );

    // On répond toujours ok:true pour ne pas révéler si l'email existe
    if (membre && membre.code) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SACCB <contact@saccb.fr>",
          to: [email],
          subject: "🔑 Votre code personnel SACCB",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                <h2 style="color: #1e3a5f; margin-top: 0;">Récupération de code</h2>
                <p style="color: #475569;">Bonjour <strong>${membre.nom}</strong>,</p>
                <p style="color: #475569;">Vous avez demandé à récupérer votre code personnel. Le voici :</p>
                <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center;">
                  <p style="margin: 0 0 8px; color: #92400e; font-size: 13px; font-weight: bold;">🔑 Votre code personnel</p>
                  <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e3a5f;">${membre.code}</p>
                </div>
                <p style="color: #64748b; font-size: 13px;">Utilisez ce code avec votre email pour vous connecter à votre espace membre sur saccb.fr.</p>
                <a href="https://saccb.fr" style="display: inline-block; background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                  Se connecter →
                </a>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
                  Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
                </p>
              </div>
            </div>
          `,
        }),
      }).catch(() => {});
    }

    return json({ ok: true });
  }

  // ─── ACTION: Changer le code personnel d'un membre ───
  if (action === "change_code") {
    const email = sanitize(String(body.email || "")).toLowerCase();
    const oldCode = sanitize(String(body.oldCode || ""));
    const newCode = sanitize(String(body.newCode || ""));

    if (!email || !oldCode || !newCode) return json({ ok: false, reason: "Champs manquants." }, 400);
    if (!/^\d{4,}$/.test(newCode)) return json({ ok: false, reason: "Le nouveau code doit contenir au moins 4 chiffres." }, 400);

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];

    const membre = membres.find(
      (m) => String(m.email || "").toLowerCase() === email && String(m.code || "") === oldCode
    );

    if (!membre) return json({ ok: false, reason: "Email ou code actuel incorrect." });

    membre.code = newCode;
    currentData.membres = membres;

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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const currentData = data.data as Record<string, unknown>;
    const membres = (currentData.membres || []) as Record<string, unknown>[];
    const membre = membres.find((m) => m.id === membreId && m.ok === true);

    if (!membre) return json({ ok: false, reason: "Membre introuvable ou paiement non validé." });

    const prixMap: Record<string, number> = { Adulte: 50, Etudiant: 30 };
    const prix = prixMap[String(membre.type)] ?? 50;
    const membreCode = String(membre.code || "");

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SACCB <contact@saccb.fr>",
        to: [String(membre.email)],
        subject: "🏸 Paiement confirmé — Bienvenue au SACCB !",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
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
                <p style="margin: 0 0 6px; color: #92400e; font-size: 13px; font-weight: bold;">🔑 Votre code personnel</p>
                <p style="margin: 0 0 8px; color: #92400e; font-size: 13px;">Conservez-le précieusement pour vous connecter à votre espace membre sur saccb.fr :</p>
                <p style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e3a5f; text-align: center;">${membreCode}</p>
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
              <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
                SACCB — Sainte-Adresse, Le Havre
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      return json({ ok: false, reason: "Erreur envoi email : " + errText });
    }

    return json({ ok: true });
  }

  return json({ error: "Action inconnue" }, 400);
});
