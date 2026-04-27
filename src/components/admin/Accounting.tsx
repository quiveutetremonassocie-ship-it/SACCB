"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, FileText, Download, Eye, Wallet, FileDown } from "lucide-react";
import { DB, Facture, FactureFile, PRIX } from "@/lib/types";
import { supabaseClient, FACTURE_BUCKET } from "@/lib/supabase";

export default function Accounting({
  db,
  totals,
  onPersist,
  readOnly,
}: {
  db: DB;
  totals: { totalRecolte: number; totalDepenses: number; solde: number };
  onPersist: (db: DB) => Promise<void>;
  readOnly?: boolean;
}) {
  const [desc, setDesc] = useState("");
  const [montant, setMontant] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Report de trésorerie saisons précédentes
  const [reportInput, setReportInput] = useState(String(db.reportPrecedent ?? ""));
  const [reportBusy, setReportBusy] = useState(false);

  // Synchroniser le champ si db change depuis l'extérieur
  useEffect(() => {
    setReportInput(String(db.reportPrecedent ?? ""));
  }, [db.reportPrecedent]);

  async function saveReport() {
    setReportBusy(true);
    const val = parseFloat(reportInput) || 0;
    await onPersist({ ...db, reportPrecedent: val });
    setReportBusy(false);
  }

  async function resetReport() {
    setReportInput("0");
    setReportBusy(true);
    await onPersist({ ...db, reportPrecedent: 0 });
    setReportBusy(false);
  }

  async function uploadFiles(factureId: string, files: File[]): Promise<FactureFile[]> {
    const out: FactureFile[] = [];
    for (const f of files) {
      const path = `${factureId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabaseClient.storage
        .from(FACTURE_BUCKET)
        .upload(path, f, { upsert: false, contentType: f.type });
      if (error) {
        alert("Erreur upload : " + error.message);
        continue;
      }
      out.push({ path, name: f.name, type: f.type, size: f.size });
    }
    return out;
  }

  async function addFacture() {
    if (!desc || !montant) return;
    setBusy(true);
    const id = Date.now().toString();
    const files = pendingFiles.length ? await uploadFiles(id, pendingFiles) : [];
    const f: Facture = {
      id,
      date: new Date().toLocaleDateString("fr-FR"),
      desc,
      montant: parseFloat(montant),
      files,
    };
    const next = { ...db, factures: [...(db.factures || []), f] };
    await onPersist(next);
    setDesc("");
    setMontant("");
    setPendingFiles([]);
    if (fileInput.current) fileInput.current.value = "";
    setBusy(false);
  }

  async function delFacture(id: string) {
    const f = db.factures.find((x) => x.id === id);
    if (f?.files?.length) {
      await supabaseClient.storage.from(FACTURE_BUCKET).remove(f.files.map((x) => x.path));
    }
    const next = { ...db, factures: db.factures.filter((x) => x.id !== id) };
    await onPersist(next);
  }

  async function getSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabaseClient.storage
      .from(FACTURE_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (error) {
      alert("Impossible d'ouvrir le fichier : " + error.message);
      return null;
    }
    return data.signedUrl;
  }

  async function viewFile(path: string) {
    const url = await getSignedUrl(path);
    if (url) window.open(url, "_blank");
  }

  async function downloadFile(file: FactureFile) {
    const url = await getSignedUrl(file.path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  }

  async function addFilesToExisting(factureId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const uploaded = await uploadFiles(factureId, Array.from(files));
    const next = {
      ...db,
      factures: db.factures.map((f) =>
        f.id === factureId ? { ...f, files: [...(f.files || []), ...uploaded] } : f
      ),
    };
    await onPersist(next);
    setBusy(false);
  }

  async function removeFile(factureId: string, file: FactureFile) {
    if (!confirm("Supprimer ce fichier ?")) return;
    await supabaseClient.storage.from(FACTURE_BUCKET).remove([file.path]);
    const next = {
      ...db,
      factures: db.factures.map((f) =>
        f.id === factureId ? { ...f, files: (f.files || []).filter((x) => x.path !== file.path) } : f
      ),
    };
    await onPersist(next);
  }

  function exportBilan() {
    // Calcul des stats membres
    let aPayes = 0, ePayes = 0, aTotal = 0, eTotal = 0;
    db.membres.forEach((m) => {
      if (m.type === "Adulte") { aTotal++; if (m.ok) aPayes++; }
      else { eTotal++; if (m.ok) ePayes++; }
    });
    const recetteAdultes = aPayes * PRIX.Adulte;
    const recetteEtudiants = ePayes * PRIX.Etudiant;
    const report = db.reportPrecedent ?? 0;
    const totalRecettes = recetteAdultes + recetteEtudiants + report;
    const totalDepenses = (db.factures || []).reduce((s, f) => s + f.montant, 0);
    const solde = totalRecettes - totalDepenses;
    const today = new Date().toLocaleDateString("fr-FR");

    const facturesRows = [...(db.factures || [])].sort((a, b) => a.date.localeCompare(b.date)).map((f) => `
      <tr>
        <td>${f.date}</td>
        <td>${f.desc}</td>
        <td class="montant red">${f.montant.toFixed(2)} €</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Bilan financier ${db.y1}–${db.y2}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 32px; }
    h1 { font-size: 22px; font-weight: bold; color: #1e3a5f; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    h2 { font-size: 14px; font-weight: bold; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #f1f5f9; text-align: left; padding: 6px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
    td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
    .montant { text-align: right; font-weight: 600; }
    .green { color: #16a34a; }
    .red { color: #dc2626; }
    .blue { color: #2563eb; }
    .total-row td { font-weight: bold; background: #f8fafc; border-top: 2px solid #cbd5e1; }
    .solde-box { margin-top: 20px; padding: 16px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .solde-box.pos { background: #f0fdf4; border: 2px solid #86efac; }
    .solde-box.neg { background: #fef2f2; border: 2px solid #fca5a5; }
    .solde-label { font-size: 14px; font-weight: bold; color: #1e293b; }
    .solde-value { font-size: 24px; font-weight: bold; }
    .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <h1>Bilan financier — Saison ${db.y1}–${db.y2}</h1>
  <p class="subtitle">Club SACCB &nbsp;|&nbsp; Généré le ${today}</p>

  <h2>Recettes</h2>
  <table>
    <thead><tr><th>Catégorie</th><th>Détail</th><th class="montant">Montant</th></tr></thead>
    <tbody>
      <tr><td>Adhésions adultes</td><td>${aPayes} payé(s) sur ${aTotal} (${PRIX.Adulte} € × ${aPayes})</td><td class="montant green">${recetteAdultes.toFixed(2)} €</td></tr>
      <tr><td>Adhésions étudiants</td><td>${ePayes} payé(s) sur ${eTotal} (${PRIX.Etudiant} € × ${ePayes})</td><td class="montant green">${recetteEtudiants.toFixed(2)} €</td></tr>
      ${report > 0 ? `<tr><td>Report saison précédente</td><td>Trésorerie reportée</td><td class="montant blue">${report.toFixed(2)} €</td></tr>` : ""}
      <tr class="total-row"><td colspan="2">TOTAL RECETTES</td><td class="montant green">${totalRecettes.toFixed(2)} €</td></tr>
    </tbody>
  </table>

  <h2>Dépenses</h2>
  <table>
    <thead><tr><th>Date</th><th>Désignation</th><th class="montant">Montant</th></tr></thead>
    <tbody>
      ${facturesRows || `<tr><td colspan="3" style="color:#94a3b8;text-align:center">Aucune dépense enregistrée</td></tr>`}
      <tr class="total-row"><td colspan="2">TOTAL DÉPENSES</td><td class="montant red">${totalDepenses.toFixed(2)} €</td></tr>
    </tbody>
  </table>

  <div class="solde-box ${solde >= 0 ? "pos" : "neg"}">
    <span class="solde-label">SOLDE FINAL (Recettes − Dépenses)</span>
    <span class="solde-value ${solde >= 0 ? "green" : "red"}">${solde >= 0 ? "+" : ""}${solde.toFixed(2)} €</span>
  </div>

  <p class="footer">Document généré automatiquement par le panneau d'administration SACCB</p>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }

  return (
    <div className="glass p-4 md:p-6 border border-blue-200">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-display text-xl md:text-2xl tracking-wider text-slate-800">Comptabilité & Trésorerie</h3>
        </div>
        <button
          onClick={exportBilan}
          className="btn-ghost !px-3 !py-2 !text-xs shrink-0 flex items-center gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50"
          title="Télécharger le bilan PDF"
        >
          <FileDown className="w-4 h-4" />
          <span className="hidden sm:inline">Bilan PDF</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <Stat label="Adhésions" value={`${totals.totalRecolte}€`} accent="text-emerald-600" />
        <Stat label="Report N-1" value={`${db.reportPrecedent ?? 0}€`} accent="text-violet-600" />
        <Stat label="Dépenses" value={`${totals.totalDepenses}€`} accent="text-red-500" />
        <Stat label="Solde" value={`${totals.solde}€`} accent={totals.solde >= 0 ? "text-blue-600" : "text-red-600"} />
      </div>

      {/* Report saison précédente */}
      {!readOnly && (
        <div className="bg-violet-50 rounded-2xl p-4 mb-5 border border-violet-200">
          <h4 className="text-sm font-semibold text-violet-800 mb-2 uppercase tracking-widest">
            Report de trésorerie (saisons précédentes)
          </h4>
          <div className="flex gap-2 items-center">
            <input
              className="input flex-1"
              type="number"
              min="0"
              placeholder="Montant en €"
              value={reportInput}
              onChange={(e) => setReportInput(e.target.value)}
            />
            <button onClick={saveReport} disabled={reportBusy} className="btn-primary !bg-gradient-to-r !from-violet-500 !to-purple-500 whitespace-nowrap">
              {reportBusy ? "Sauvegarde..." : "Enregistrer"}
            </button>
            {(db.reportPrecedent ?? 0) > 0 && (
              <button
                onClick={resetReport}
                disabled={reportBusy}
                className="btn-danger !px-3 !py-2 whitespace-nowrap"
                title="Remettre à 0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-violet-500 mt-2">
            Modifiez le montant et cliquez sur <strong>Enregistrer</strong> pour le corriger, ou 🗑️ pour le supprimer.
          </p>
        </div>
      )}

      {!readOnly && (
        <div className="bg-slate-50 rounded-2xl p-4 md:p-5 mb-5 border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-800 mb-3 uppercase tracking-widest">
            Ajouter une dépense / facture
          </h4>
          <div className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_auto] gap-2 mb-3">
            <input
              className="input"
              placeholder="Désignation (ex: Volants)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <input
              className="input"
              type="number"
              placeholder="Montant €"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
            <button onClick={addFacture} disabled={busy} className="btn-primary">
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>
          <label className="flex items-center gap-3 text-sm text-slate-500 cursor-pointer hover:text-slate-700 transition">
            <Upload className="w-4 h-4" />
            <span>
              Joindre PDF / images (factures, justificatifs)
              {pendingFiles.length > 0 && (
                <span className="ml-2 text-blue-600 font-semibold">{pendingFiles.length} fichier(s)</span>
              )}
            </span>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
            />
          </label>
        </div>
      )}

      {/* Factures : cartes */}
      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
        {[...(db.factures || [])].reverse().map((f) => (
          <div key={f.id} className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-slate-800 font-medium text-sm truncate">{f.desc}</p>
                <p className="text-xs text-slate-400">{f.date}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-red-500 text-sm">{f.montant}€</span>
                {!readOnly && (
                  <button onClick={() => delFacture(f.id)} className="btn-danger !px-2 !py-1 !text-xs">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {(f.files || []).length > 0 && (
              <div className="space-y-1 mt-2">
                {(f.files || []).map((file) => (
                  <div key={file.path} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 text-xs border border-slate-100">
                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate flex-1 text-slate-600">{file.name}</span>
                    <button onClick={() => viewFile(file.path)} className="text-slate-400 hover:text-slate-700" title="Voir">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => downloadFile(file)} className="text-slate-400 hover:text-slate-700" title="Télécharger">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {!readOnly && (
                      <button onClick={() => removeFile(f.id, file)} className="text-red-400 hover:text-red-500" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!readOnly && (
              <label className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 cursor-pointer mt-1">
                <Upload className="w-3 h-3" /> Ajouter fichier
                <input type="file" multiple accept=".pdf,image/*" className="hidden"
                  onChange={(e) => addFilesToExisting(f.id, e.target.files)} />
              </label>
            )}
          </div>
        ))}
        {(!db.factures || db.factures.length === 0) && (
          <p className="text-center text-slate-400 py-6 text-sm">Aucune facture enregistrée</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{label}</p>
      <p className={`text-3xl font-display tracking-wider mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
