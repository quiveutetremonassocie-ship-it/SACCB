"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, FileText, Download, Eye, Wallet } from "lucide-react";
import { DB, Facture, FactureFile } from "@/lib/types";
import { supabaseClient, FACTURE_BUCKET } from "@/lib/supabase";

export default function Accounting({
  db,
  totals,
  onPersist,
}: {
  db: DB;
  totals: { totalRecolte: number; totalDepenses: number; solde: number };
  onPersist: (db: DB) => Promise<void>;
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

  return (
    <div className="glass p-4 md:p-6 border border-blue-200">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-xl md:text-2xl tracking-wider text-slate-800">Comptabilité & Trésorerie</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-5">
        <Stat label="Adhésions" value={`${totals.totalRecolte}€`} accent="text-emerald-600" />
        <Stat label="Report N-1" value={`${db.reportPrecedent ?? 0}€`} accent="text-violet-600" />
        <Stat label="Dépenses" value={`${totals.totalDepenses}€`} accent="text-red-500" />
        <Stat label="Solde" value={`${totals.solde}€`} accent={totals.solde >= 0 ? "text-blue-600" : "text-red-600"} />
      </div>

      {/* Report saison précédente */}
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
                <button onClick={() => delFacture(f.id)} className="btn-danger !px-2 !py-1 !text-xs">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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
                    <button onClick={() => removeFile(f.id, file)} className="text-red-400 hover:text-red-500" title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 cursor-pointer mt-1">
              <Upload className="w-3 h-3" /> Ajouter fichier
              <input type="file" multiple accept=".pdf,image/*" className="hidden"
                onChange={(e) => addFilesToExisting(f.id, e.target.files)} />
            </label>
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
