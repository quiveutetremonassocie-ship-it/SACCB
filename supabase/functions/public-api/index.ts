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
    const allowedIPs = ["51.138.206.200"];
    const callerIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    if (!allowedIPs.includes(callerIP)) {
      return json({ ok: false, reason: "IP non autorisée." }, 403);
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
                  <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">SACCB — Sainte-Adresse, Le Havre</p>
                </div>
              </div>
            `,
          }),
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
    const adminCredentials = ((currentData.adminCredentials || []) as { email: string; code: string }[]);
    const adminEmails = ((currentData.adminEmails || []) as string[]).map((e: string) => e.toLowerCase());

    // Vérifier d'abord les credentials admin indépendants (pas besoin d'être adhérent)
    const adminCred = adminCredentials.find(
      (c) => String(c.email || "").toLowerCase() === email && String(c.code || "") === code
    );
    if (adminCred) {
      return json({
        ok: true,
        paid: true,
        isAdmin: true,
        membre: { id: "admin-" + email, nom: email, type: "Adulte", email },
      });
    }

    // Sinon vérifier dans les adhérents normaux
    const membre = membres.find(
      (m) =>
        String(m.email || "").toLowerCase() === email &&
        String(m.code || "") === code
    );

    if (!membre) {
      return json({ ok: false, reason: "Email ou code incorrect." });
    }

    const isAdmin = adminEmails.includes(email);

    return json({
      ok: true,
      paid: membre.ok === true,
      isAdmin,
      membre: {
        id: membre.id,
        nom: membre.nom,
        type: membre.type,
        email: membre.email,
      },
    });
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
    const adminEmails = ((d.adminEmails || []) as string[]).map((e: string) => e.toLowerCase());
    const adminCredentials = ((d.adminCredentials || []) as { email: string; code: string }[]);

    // Vérifier via adminCredentials (admin sans adhérent) OU via membres
    const validAdminCred = adminCredentials.find((c) => String(c.email || "").toLowerCase() === email && String(c.code || "") === code);
    const validMembre = membres.find((m) => String(m.email || "").toLowerCase() === email && String(m.code || "") === code);

    if (!validAdminCred && !validMembre) return json({ ok: false, reason: "Identifiants incorrects." });
    if (!adminEmails.includes(email) && !validAdminCred) return json({ ok: false, reason: "Accès non autorisé." });

    return json({ ok: true, data: d });
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
    const adminEmails = ((d.adminEmails || []) as string[]).map((e: string) => e.toLowerCase());
    const adminCredentialsCheck = ((d.adminCredentials || []) as { email: string; code: string }[]);

    const validAdminCredSave = adminCredentialsCheck.find((c) => String(c.email || "").toLowerCase() === email && String(c.code || "") === code);
    const validMembreSave = membres.find((m) => String(m.email || "").toLowerCase() === email && String(m.code || "") === code);

    if (!validAdminCredSave && !validMembreSave) return json({ ok: false, reason: "Identifiants incorrects." });
    if (!adminEmails.includes(email) && !validAdminCredSave) return json({ ok: false, reason: "Accès non autorisé." });

    // Seuls les super-admins peuvent modifier la liste adminEmails
    const SUPER_ADMINS = ["gabin.binay@gmail.com", "hernancm68@hotmail.com"];
    const currentAdminEmails = JSON.stringify([...(d.adminEmails || [])].map((e: string) => String(e).toLowerCase()).sort());
    const newAdminEmails = JSON.stringify([...((newData.adminEmails || []) as string[])].map((e: string) => String(e).toLowerCase()).sort());
    if (currentAdminEmails !== newAdminEmails && !SUPER_ADMINS.includes(email)) {
      return json({ ok: false, reason: "Seul un super-administrateur peut modifier la liste des admins." }, 403);
    }

    const { error: saveError } = await supabaseAdmin.from("saccb_db").update({ data: newData }).eq("id", 1);
    if (saveError) return json({ ok: false, reason: "Erreur sauvegarde." }, 500);
    return json({ ok: true });
  }

  // ─── ACTION: Inscription publique ───
  if (action === "add_membre") {
    const nom = sanitize(String(body.nom || ""));
    const email = sanitize(String(body.email || "")).toLowerCase();
    const tel = sanitize(String(body.tel || ""));
    const type = body.type === "Etudiant" ? "Etudiant" : "Adulte";
    const paymentMethod = body.paymentMethod === "virement" ? "virement" : "online";
    const code = sanitize(String(body.code || ""));
    const newsOptIn = body.newsOptIn === true || body.newsOptIn === "true";
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

    // Renouvellement uniquement si inscription individuelle (pas groupée)
    if (!grouped) {
      const existingIdx = membres.findIndex((m) => String(m.email || "").toLowerCase() === email);
      if (existingIdx !== -1) {
        if (membres[existingIdx].ok === true) {
          return json({ ok: false, reason: "Cet email est déjà inscrit et son adhésion est active !" });
        }
        // Renouvellement : on met à jour l'entrée existante
        const existing = membres[existingIdx];
        membres[existingIdx] = {
          ...existing,
          nom,
          tel: tel || existing.tel,
          type,
          paymentMethod,
          code: code || existing.code,
          newsOptIn,
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
      code,
      newsOptIn,
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

    // Récupère les emails des membres ayant payé ET abonnés aux news
    // (les anciens membres sans le champ newsOptIn reçoivent par défaut)
    const emails = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
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

  // ─── ACTION: Notifier tous les anciens adhérents du début de nouvelle saison ───
  if (action === "notify_new_season") {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ ok: false, reason: "Service email non configuré." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;
    const membres = (d.membres || []) as Record<string, unknown>[];

    // Envoyer à tous les membres (anciens adhérents), peu importe newsOptIn
    const emails = membres
      .map((m) => String(m.email || ""))
      .filter(Boolean);

    if (emails.length === 0) return json({ ok: false, reason: "Aucun adhérent trouvé." });

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SACCB <contact@saccb.fr>",
        to: ["contact@saccb.fr"],
        bcc: emails,
        subject: `🏸 La saison ${d.y1}–${d.y2} est ouverte — inscrivez-vous vite !`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
            </div>
            <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
              <h2 style="color: #1e3a5f; margin-top: 0;">🎉 La nouvelle saison est lancée !</h2>
              <p style="color: #475569;">Bonjour,</p>
              <p style="color: #475569;">
                La saison <strong>${d.y1}–${d.y2}</strong> du SACCB est maintenant ouverte !
                Les places partent vite, alors ne tardez pas à renouveler votre adhésion.
              </p>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">Votre code personnel vous permettra de vous reconnecter directement sur le site.</p>
                <p style="margin: 0; color: #64748b; font-size: 13px;">Si vous l'avez oublié, cliquez sur <strong>"Code oublié ?"</strong> sur la page de connexion.</p>
              </div>
              <a href="https://saccb.fr/#inscription" style="display: inline-block; background: #1e3a5f; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 8px;">
                🏸 Je renouvelle mon adhésion →
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
      return json({ ok: false, reason: "Erreur envoi : " + errText });
    }

    return json({ ok: true, sent: emails.length });
  }

  // ─── ACTION: Rappels automatiques d'inscription (J-30 et J-15) ───
  if (action === "check_reminders") {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ ok: false, reason: "RESEND_API_KEY manquant." });

    const { data, error } = await supabaseAdmin
      .from("saccb_db")
      .select("data")
      .eq("id", 1)
      .single();

    if (error || !data) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const d = data.data as Record<string, unknown>;
    const inscCloseDate = String(d.insc_close_date || "");
    if (!inscCloseDate) return json({ ok: true, skipped: "Pas de date de fermeture configurée." });

    const closeTs = new Date(inscCloseDate).getTime();
    const todayTs = new Date(new Date().toISOString().slice(0, 10)).getTime();
    const daysLeft = Math.round((closeTs - todayTs) / (1000 * 60 * 60 * 24));

    const membres = (d.membres || []) as Record<string, unknown>[];
    const newsEmails = membres
      .filter((m) => m.ok === true && m.newsOptIn !== false)
      .map((m) => String(m.email || ""))
      .filter(Boolean);

    const results: Record<string, unknown> = {};

    // ── Rappels fermeture des inscriptions saison (J-30 / J-15 / J-5 / J-1) ──
    if (daysLeft === 30 || daysLeft === 15 || daysLeft === 5 || daysLeft === 1) {
      if (newsEmails.length > 0) {
        const closeFormatted = new Date(inscCloseDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        const isUrgent = daysLeft <= 5;
        const subjectLabel = daysLeft === 1 ? "🚨 Plus que 24H pour s'inscrire au SACCB !" : `⏰ Plus que ${daysLeft} jours pour s'inscrire au SACCB !`;
        const headingLabel = daysLeft === 1 ? "🚨 Dernière chance — plus que 24H !" : `⏰ Plus que ${daysLeft} jours !`;
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "SACCB <contact@saccb.fr>",
            to: ["contact@saccb.fr"],
            bcc: newsEmails,
            subject: subjectLabel,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: ${isUrgent ? "#b91c1c" : "#1e3a5f"}; padding: 24px; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                  <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
                </div>
                <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
                  <h2 style="color: ${isUrgent ? "#b91c1c" : "#1e3a5f"}; margin-top: 0;">${headingLabel}</h2>
                  <p style="color: #475569;">Les inscriptions pour la saison ${d.y1}–${d.y2} ferment le <strong>${closeFormatted}</strong>.</p>
                  ${daysLeft === 1
                    ? `<p style="color: #b91c1c; font-weight: bold;">C'est votre dernière chance ! Les inscriptions ferment demain définitivement.</p>`
                    : `<p style="color: #475569;">Faites passer le mot autour de vous — il reste encore de la place !</p>`
                  }
                  <a href="https://saccb.fr/#inscription" style="display: inline-block; background: ${isUrgent ? "#b91c1c" : "#1e3a5f"}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                    S'inscrire maintenant →
                  </a>
                  <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Vous recevez cet email car vous avez accepté les news du SACCB.</p>
                </div>
              </div>
            `,
          }),
        }).catch(() => {});
        results.season_reminder = { sent: newsEmails.length, daysLeft };
      }
    }

    // ── Suppression des non-payés après fermeture ──
    if (daysLeft < 0) {
      const before = membres.length;
      const kept = membres.filter((m) => m.ok === true);
      if (kept.length < before) {
        d.membres = kept;
        d.insc_open = false;
        await supabaseAdmin.from("saccb_db").update({ data: d }).eq("id", 1);
        results.cleanup = { removed: before - kept.length };
      }
    }

    // ── Rappels tournois (J-30 / J-15 / J-5 / J-1 avant dateLimit) ──
    const tournois = (d.config_tournois || []) as Record<string, unknown>[];
    const tournoiRemindersSent: string[] = [];
    for (const t of tournois) {
      const dateLimit = String(t.dateLimit || t.date || "");
      if (!dateLimit) continue;
      const tTs = new Date(dateLimit.includes("/")
        ? dateLimit.split("/").reverse().join("-")
        : dateLimit).getTime();
      const tDaysLeft = Math.round((tTs - todayTs) / (1000 * 60 * 60 * 24));
      if (tDaysLeft !== 30 && tDaysLeft !== 15 && tDaysLeft !== 5 && tDaysLeft !== 1) continue;
      if (newsEmails.length === 0) continue;

      const dateFormatted = new Date(tTs).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      const tIsUrgent = tDaysLeft <= 5;
      const tSubject = tDaysLeft === 1
        ? `🚨 Tournoi "${t.name}" — plus que 24H pour s'inscrire !`
        : `🏸 Tournoi "${t.name}" — plus que ${tDaysLeft} jours pour s'inscrire !`;
      const tHeading = tDaysLeft === 1 ? `🚨 Dernière chance — plus que 24H !` : `🏸 Plus que ${tDaysLeft} jours !`;

      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SACCB <contact@saccb.fr>",
          to: ["contact@saccb.fr"],
          bcc: newsEmails,
          subject: tSubject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: ${tIsUrgent ? "#b91c1c" : "#1e3a5f"}; padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
                <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
              </div>
              <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
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
                <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Vous recevez cet email car vous avez accepté les news du SACCB.</p>
              </div>
            </div>
          `,
        }),
      }).catch(() => {});
      tournoiRemindersSent.push(String(t.name));
    }
    if (tournoiRemindersSent.length > 0) results.tournoi_reminders = tournoiRemindersSent;

    // ── Fermeture automatique des tournois dont la date limite est dépassée ──
    let tournoisUpdated = false;
    for (const t of tournois) {
      const dateLimit = String(t.dateLimit || t.date || "");
      if (!dateLimit || t.closed) continue;
      const tTs = new Date(dateLimit.includes("/")
        ? dateLimit.split("/").reverse().join("-")
        : dateLimit).getTime();
      const tDaysLeft = Math.round((tTs - todayTs) / (1000 * 60 * 60 * 24));
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

    // Vérifier d'abord dans adminCredentials
    const adminCred = adminCredentials.find(
      (c) => String(c.email || "").toLowerCase() === email && String(c.code || "") === oldCode
    );

    // Vérifier ensuite dans les adhérents
    const membre = membres.find(
      (m) => String(m.email || "").toLowerCase() === email && String(m.code || "") === oldCode
    );

    if (!adminCred && !membre) return json({ ok: false, reason: "Email ou code actuel incorrect." });

    // Mettre à jour dans les deux endroits si besoin
    if (membre) membre.code = newCode;
    if (adminCred) adminCred.code = newCode;

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

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ ok: false, reason: "Service email non configuré." });

    // Lire les emails de contact depuis la DB, sinon fallback sur les emails par défaut
    const { data: dbData } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    const dbD = (dbData?.data ?? {}) as Record<string, unknown>;
    const contactEmails = ((dbD.contactEmails || []) as string[]);
    const toEmails = contactEmails.length > 0 ? contactEmails : ["gabin.binay@gmail.com", "hernancm68@hotmail.com"];

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SACCB Site <contact@saccb.fr>",
        to: ["contact@saccb.fr"],
        bcc: toEmails,
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
      }),
    });

    if (!sendRes.ok) {
      const errBody = await sendRes.json().catch(() => ({}));
      return json({ ok: false, reason: `Erreur Resend (${sendRes.status}): ${JSON.stringify(errBody)}` });
    }
    return json({ ok: true });
  }

  // ─── ACTION: Email de bienvenue (ajout manuel par admin) ───
  if (action === "send_welcome") {
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
    const membre = membres.find((m) => m.id === membreId);

    if (!membre) return json({ ok: false, reason: "Membre introuvable." });

    const membreCode = String(membre.code || "");
    if (!membreCode) return json({ ok: false, reason: "Ce membre n'a pas de code." });

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SACCB <contact@saccb.fr>",
        to: [String(membre.email)],
        subject: "🏸 Bienvenue au SACCB — Votre accès espace membre",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1e3a5f; padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">SACCB</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0;">Sainte-Adresse Club de Compétition de Badminton</p>
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
              <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">SACCB — Sainte-Adresse, Le Havre</p>
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
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "SACCB <contact@saccb.fr>",
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
        }),
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

    // Buckets autorisés
    const allowedBuckets = ["actualities", "factures"];
    if (!allowedBuckets.includes(bucket)) return json({ ok: false, reason: "Bucket non autorisé." }, 400);

    // Vérifier les credentials admin
    const { data: dbDataImg, error: dbErrorImg } = await supabaseAdmin.from("saccb_db").select("data").eq("id", 1).single();
    if (dbErrorImg || !dbDataImg) return json({ ok: false, reason: "Erreur serveur." }, 500);

    const dImg = dbDataImg.data as Record<string, unknown>;
    const membresImg = (dImg.membres || []) as Record<string, unknown>[];
    const adminEmailsImg = ((dImg.adminEmails || []) as string[]).map((e: string) => e.toLowerCase());
    const adminCredentialsImg = ((dImg.adminCredentials || []) as { email: string; code: string }[]);

    const validAdminCredImg = adminCredentialsImg.find(
      (c) => String(c.email || "").toLowerCase() === email && String(c.code || "") === code
    );
    const validMembreImg = membresImg.find(
      (m) => String(m.email || "").toLowerCase() === email && String(m.code || "") === code
    );

    if (!validAdminCredImg && !validMembreImg) return json({ ok: false, reason: "Identifiants incorrects." }, 401);
    if (!adminEmailsImg.includes(email) && !validAdminCredImg) return json({ ok: false, reason: "Accès non autorisé." }, 403);

    // Décoder le base64 (retirer le préfixe data:... si présent)
    const base64Data = fileData.includes(",") ? fileData.split(",")[1] : fileData;
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

    const prefix = pathPrefix ? `${pathPrefix}/` : "";
    const path = `${prefix}${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: false });

    if (uploadError) return json({ ok: false, reason: "Erreur upload : " + uploadError.message }, 500);

    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return json({ ok: true, url: urlData.publicUrl, path });
  }

  return json({ error: "Action inconnue" }, 400);
});
