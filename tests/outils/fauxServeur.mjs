// 🧪 Fait tourner le vrai code du serveur (supabase/functions/public-api/index.ts) dans Node,
// avec une FAUSSE base de données en mémoire et AUCUNE connexion vers l'extérieur :
// - les lectures/écritures de la base sont servies par `base` ci-dessous (jamais la vraie base) ;
// - tout autre appel réseau (Brevo, Resend, HelloAsso, Google…) est intercepté et noté, jamais envoyé.
import { compiler } from "./compiler.mjs";

const URL_FAUSSE_BASE = "http://fausse-base.test";

export const ENV = {
  SUPABASE_URL: URL_FAUSSE_BASE,
  SUPABASE_SERVICE_ROLE_KEY: "fausse-cle",
  BREVO_API_KEY: "fausse-cle-brevo", // présente pour que le serveur PRÉPARE les mails : ils sont interceptés
  RESEND_API_KEY: "fausse-cle-resend",
  CRON_SECRET: "secret-taches-test",
  HELLOASSO_WEBHOOK_SECRET: "secret-helloasso-test",
  BREVO_INBOUND_SECRET: "secret-inbound-test",
};

export const etat = {
  base: null, // contenu de la fausse base (objet JSON)
  ecritures: 0,
  appelsExterieurs: [], // { url, corps } : tout ce qui aurait quitté le serveur
};

/** Mails que le serveur a essayé d'envoyer (interceptés) */
export const mailsIntercepte = () =>
  etat.appelsExterieurs.filter((a) => /brevo\.com|resend\.com/.test(a.url)).map((a) => a.corps);

const reponseJson = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });

async function fauxFetch(entree, init = {}) {
  const url = new URL(typeof entree === "string" ? entree : entree.url ?? String(entree));
  const methode = (init.method || entree.method || "GET").toUpperCase();
  const corps = init.body ?? null;

  if (url.origin !== URL_FAUSSE_BASE) {
    // 🚫 Rien ne sort : on note l'appel et on répond « service indisponible »
    let lu = corps;
    try { lu = JSON.parse(String(corps)); } catch { /* texte brut */ }
    etat.appelsExterieurs.push({ url: url.href, corps: lu });
    return reponseJson({ message: "intercepté par les tests" }, 503);
  }

  // Fausse API de la base (format PostgREST utilisé par supabase-js)
  if (url.pathname === "/rest/v1/saccb_db") {
    const q = url.searchParams;
    if (methode === "GET") {
      if ((q.get("select") || "").startsWith("rev:")) return reponseJson({ rev: String(etat.base._rev ?? "") });
      return reponseJson({ data: structuredClone(etat.base) });
    }
    if (methode === "PATCH") {
      const attendu = q.get("data->>_rev");
      const rev = etat.base._rev;
      const ok = attendu === null || (attendu === "is.null" ? rev == null : attendu === "eq." + String(rev));
      if (!ok) return reponseJson([]);
      etat.base = JSON.parse(String(corps)).data;
      etat.ecritures++;
      return reponseJson([{ id: 1 }]);
    }
  }
  // Fichiers (stockage) et autres tables : vide
  if (url.pathname.startsWith("/storage/")) return reponseJson([]);
  return reponseJson([]);
}

let gestionnaire = null;
let n = 0;

/** Charge le serveur une seule fois */
export async function demarrer() {
  if (gestionnaire) return;
  globalThis.fetch = fauxFetch;
  globalThis.Deno = {
    env: { get: (k) => ENV[k] },
    serve: (f) => { gestionnaire = f; },
  };
  const url = compiler("supabase/functions/public-api/index.ts", "serveur.mjs", (s) =>
    s.replace(`import { createClient } from "https://esm.sh/@supabase/supabase-js@2";`, `import { createClient } from "@supabase/supabase-js";`)
      + "\nexport { merge3, erreurScoreLive };\n");
  const mod = await import(url);
  if (!gestionnaire) throw new Error("Le serveur n'a pas démarré");
  return mod;
}

/** Envoie une requête au serveur comme le ferait le site ; chaque appel a sa propre adresse IP sauf si `ip` est donnée */
export async function appeler(corps, ip) {
  const req = new Request("http://serveur.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip || `10.0.${Math.floor(++n / 250)}.${n % 250}` },
    body: JSON.stringify(corps),
  });
  const res = await gestionnaire(req);
  const texte = await res.text();
  let json = null;
  try { json = JSON.parse(texte); } catch { /* pas du JSON */ }
  return { status: res.status, texte, json };
}
