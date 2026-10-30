// 🖨 QR codes à imprimer : une fiche par club (lien + code d'accès) et une pour l'écran géant
import { InterClub } from "./types";

const SITE = "https://saccb.fr";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function imprimerQrCodes(t: InterClub) {
  // La fenêtre s'ouvre tout de suite (sinon le navigateur la bloque), le contenu arrive ensuite
  const w = window.open("", "_blank");
  if (!w) { alert("Le navigateur a bloqué la fenêtre : autorise les fenêtres pop-up pour saccb.fr puis réessaie."); return; }
  w.document.write("<p style='font-family:sans-serif;padding:20px'>Préparation des QR codes…</p>");

  const QRCode = (await import("qrcode")).default;
  const qr = (url: string) => QRCode.toDataURL(url, { width: 520, margin: 1, errorCorrectionLevel: "M", color: { dark: "#1e3a5f", light: "#ffffff" } });
  const date = t.date ? new Date(t.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "";

  const fiches: string[] = [];
  for (const c of t.clubs) {
    const lien = `${SITE}/interclub/#${c.token}`;
    fiches.push(`
      <section class="fiche">
        <p class="sur">Tournoi inter-clubs · ${esc(date)}</p>
        <h1>${esc(t.name)}</h1>
        <h2>${esc(c.nom || "Club")}</h2>
        <img src="${await qr(lien)}" alt="QR code" />
        <p class="aide">Scannez pour inscrire vos binômes, suivre le tournoi en direct et entrer vos scores</p>
        ${c.code ? `<p class="code">Code d'accès : <strong>${esc(c.code)}</strong></p>` : ""}
        <p class="lien">${esc(lien)}</p>
      </section>`);
  }
  if (t.live?.liveToken) {
    const lien = `${SITE}/interclub/#ecran=${t.live.liveToken}`;
    fiches.push(`
      <section class="fiche">
        <p class="sur">Tournoi inter-clubs · ${esc(date)}</p>
        <h1>${esc(t.name)}</h1>
        <h2>📺 Résultats en direct</h2>
        <img src="${await qr(lien)}" alt="QR code" />
        <p class="aide">Scannez pour voir les poules et les classements en direct</p>
        <p class="lien">${esc(lien)}</p>
      </section>`);
  }

  w.document.open();
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QR codes — ${esc(t.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1e3a5f; background: #f1f5f9; }
  .barre { position: sticky; top: 0; background: #1e3a5f; color: #fff; padding: 12px 20px; display: flex; gap: 12px; align-items: center; }
  .barre button { background: #10b981; color: #fff; border: 0; border-radius: 8px; padding: 10px 18px; font-weight: bold; font-size: 15px; cursor: pointer; }
  .grille { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 16px; max-width: 900px; margin: 0 auto; }
  .fiche { background: #fff; border: 2px dashed #94a3b8; border-radius: 16px; padding: 18px; text-align: center; page-break-inside: avoid; break-inside: avoid; }
  .sur { margin: 0; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #059669; }
  h1 { margin: 4px 0 0; font-size: 20px; }
  h2 { margin: 6px 0 10px; font-size: 26px; color: #0f172a; }
  img { width: 230px; height: 230px; }
  .aide { font-size: 12px; color: #475569; margin: 8px 0; }
  .code { font-size: 18px; margin: 6px 0; } .code strong { font-family: monospace; letter-spacing: .15em; font-size: 24px; }
  .lien { font-size: 8px; color: #94a3b8; word-break: break-all; margin: 6px 0 0; }
  @media print { body { background: #fff; } .barre { display: none; } .grille { padding: 0; gap: 10mm; } }
</style></head><body>
<div class="barre"><strong>${fiches.length} fiche${fiches.length > 1 ? "s" : ""} à imprimer</strong><button onclick="window.print()">🖨 Imprimer</button><span style="font-size:12px;opacity:.8">2 fiches par ligne · découpez selon les pointillés</span></div>
<div class="grille">${fiches.join("")}</div>
</body></html>`);
  w.document.close();
}
