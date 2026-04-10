"use client";

import { useRef, useState } from "react";
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
    <div className="glass p-6 border border-blue-500/30">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-white">Comptabilité & Trésorerie</h3>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Adhésions reçues" value={`${totals.totalRecolte}€`} accent="text-emerald-400" />
        <Stat label="Dépenses" value={`${totals.totalDepenses}€`} accent="text-red-400" />
        <Stat label="Solde actuel" value={`${totals.solde}€`} accent="text-blue-400" />
      </div>

      <div className="bg-black/30 rounded-2xl p-5 mb-5 border border-white/5">
        <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-widest">
          Ajouter une dépense / facture
        </h4>
        <div className="grid md:grid-cols-[1fr_140px_auto] gap-2 mb-3">
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
        <label className="flex items-center gap-3 text-sm text-white/60 cursor-pointer hover:text-white transition">
          <Upload className="w-4 h-4" />
          <span>
            Joindre PDF / images (factures, justificatifs)
            {pendingFiles.length > 0 && (
              <span className="ml-2 text-blue-400 font-semibold">{pendingFiles.length} fichier(s)</span>
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

      <div className="max-h-[400px] overflow-y-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-white/5 sticky top-0">
            <tr className="text-left text-white/60 text-xs uppercase tracking-widest">
              <th className="p-3">Date</th>
              <th className="p-3">Description</th>
              <th className="p-3">Montant</th>
              <th className="p-3">Fichiers</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {[...(db.factures || [])].reverse().map((f) => (
              <tr key={f.id} className="border-t border-white/5 align-top">
                <td className="p-3 text-white/70 whitespace-nowrap">{f.date}</td>
                <td className="p-3 text-white">{f.desc}</td>
                <td className="p-3 font-semibold text-red-400 whitespace-nowrap">{f.montant}€</td>
                <td className="p-3">
                  <div className="space-y-1">
                    {(f.files || []).map((file) => (
                      <div
                        key={file.path}
                        className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1 text-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate max-w-[140px] text-white/80" title={file.name}>
                          {file.name}
                        </span>
                        <button
                          onClick={() => viewFile(file.path)}
                          className="text-white/50 hover:text-white"
                          title="Voir"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => downloadFile(file)}
                          className="text-white/50 hover:text-white"
                          title="Télécharger"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeFile(f.id, file)}
                          className="text-red-400/60 hover:text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <label className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                      <Upload className="w-3 h-3" /> Ajouter
                      <input
                        type="file"
                        multiple
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => addFilesToExisting(f.id, e.target.files)}
                      />
                    </label>
                  </div>
                </td>
                <td className="p-3">
                  <button onClick={() => delFacture(f.id)} className="btn-danger !px-3 !py-1.5 !text-xs">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {(!db.factures || db.factures.length === 0) && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-white/40">
                  Aucune facture enregistrée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-black/30 rounded-xl p-4 border border-white/5">
      <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">{label}</p>
      <p className={`text-3xl font-display tracking-wider mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
