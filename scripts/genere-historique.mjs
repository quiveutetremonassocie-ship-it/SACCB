// 📘 Génère l'historique des modifications du site (lancé automatiquement avant chaque build).
// Il alimente le PDF « Fiche du site pour Claude » du Journal admin.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const git = (cmd) => {
  try { return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
};

const modifications = git(`log --no-merges --date=short "--pretty=format:%h|%ad|%s" -n 600`)
  .split("\n")
  .filter(Boolean)
  .map((l) => { const [hash, date, ...m] = l.split("|"); return { hash, date, message: m.join("|") }; })
  .filter((c) => !/keepalive/i.test(c.message))
  .slice(0, 300);

const pointsDeRetour = git(`for-each-ref --sort=-creatordate "--format=%(refname:short)|%(creatordate:short)" refs/tags/sauvegarde-*`)
  .split("\n")
  .filter(Boolean)
  .map((l) => { const [nom, date] = l.split("|"); return { nom, date }; });

const historique = {
  genereLe: new Date().toISOString(),
  version: git("rev-parse --short HEAD"),
  nbModifications: Number(git("rev-list --count HEAD")) || modifications.length,
  modifications,
  pointsDeRetour,
};

writeFileSync(new URL("../src/lib/historiqueSite.json", import.meta.url), JSON.stringify(historique, null, 1));
console.log(`📘 Historique du site : ${modifications.length} modifications, ${pointsDeRetour.length} points de retour`);
