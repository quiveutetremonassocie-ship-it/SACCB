// 🔗 Liens et expéditeurs d'un message du formulaire de contact (même règles que le serveur)

// http(s)://…, www.… ou un nom de domaine à terminaison très utilisée par le spam (sans « http »)
const MOTIF_LIEN = /(?:https?:\/\/|www\.)[^\s<>"')\]]+|\b[a-z0-9][a-z0-9-]*\.(?:online|xyz|top|click|site|live|icu|link|buzz|cfd|sbs|store|fun)\b[^\s<>"')\]]*/gi;

/** Liens trouvés dans un texte (5 maximum, sans ponctuation finale) */
export function extraireLiens(texte: string): string[] {
  const trouves = texte.match(MOTIF_LIEN) || [];
  return [...new Set(trouves.map((l) => l.replace(/[.,;:!?]+$/, "")))].slice(0, 5);
}

/** Adresse complète à ouvrir (ajoute https:// si le lien n'en avait pas) ; null si ce n'est pas du http(s) */
export function urlDuLien(lien: string): string | null {
  const u = /^https?:\/\//i.test(lien) ? lien : "https://" + lien;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

// Domaines de messagerie très répandus : jamais bloqués en entier (le serveur applique la même règle)
export const DOMAINES_PUBLICS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr", "live.com", "live.fr", "msn.com",
  "yahoo.com", "yahoo.fr", "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "neuf.fr", "laposte.net", "bbox.fr", "numericable.fr",
  "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "gmx.fr", "aol.com",
]);

export function domaineDe(email: string): string {
  return (email.toLowerCase().trim().split("@")[1] || "");
}

/** « adresse », « domaine » ou null : cet expéditeur est-il bloqué ? */
export function blocageDe(bloques: string[] | undefined, email: string): "adresse" | "domaine" | null {
  const liste = (bloques ?? []).map((x) => x.toLowerCase().trim());
  const e = email.toLowerCase().trim();
  if (liste.includes(e)) return "adresse";
  const dom = domaineDe(e);
  if (dom && !DOMAINES_PUBLICS.has(dom) && liste.includes("@" + dom)) return "domaine";
  return null;
}
