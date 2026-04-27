"use client";

import { useMemo, useRef, useState } from "react";
import { X, FileSpreadsheet, FileText, QrCode, Download, ExternalLink, Eye } from "lucide-react";
import { DB, Membre, PRIX } from "@/lib/types";
import Accounting from "./Accounting";
import SeasonSettings from "./SeasonSettings";
import StatsAdhesions from "./StatsAdhesions";
import TournoisAdmin from "./TournoisAdmin";
import InscriptionsAdmin from "./InscriptionsAdmin";
import MembresAdmin from "./MembresAdmin";
import ActualitesAdmin from "./ActualitesAdmin";
import RecuModal from "./RecuModal";
import EmargementModal from "./EmargementModal";
import EditMembreModal from "./EditMembreModal";
import EditBinomeModal from "./EditBinomeModal";

export default function AdminPanel({
  db,
  onClose,
  onPersist,
  onRefresh,
  adminEmail,
  adminCode,
  readOnly,
  permissions,
}: {
  db: DB;
  onClose: () => void;
  onPersist: (db: DB) => Promise<void>;
  onRefresh: () => Promise<void>;
  adminEmail?: string;
  adminCode?: string;
  readOnly?: boolean;
  permissions?: string[];
}) {
  const [recuMembre, setRecuMembre] = useState<Membre | null>(null);
  const [emargementOpen, setEmargementOpen] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);
  const [editBin, setEditBin] = useState<{ id: string; joueurs: string } | null>(null);

  const safePersist = readOnly
    ? async (_db: DB) => { alert("Accès en lecture seule — vous ne pouvez pas modifier les données."); }
    : onPersist;

  function canEdit(section: string): boolean {
    if (readOnly) return false;
    if (!permissions || permissions.length === 0) return true;
    return permissions.includes(section);
  }

  const totals = useMemo(() => {
    let totalRecolte = 0,
      reste = 0,
      aPayes = 0,
      aTotal = 0,
      ePayes = 0,
      eTotal = 0;
    db.membres.forEach((m) => {
      const prix = m.type === "Etudiant" ? PRIX.Etudiant : PRIX.Adulte;
      if (m.type === "Adulte") aTotal++;
      else eTotal++;
      if (m.ok) {
        totalRecolte += prix;
        if (m.type === "Adulte") aPayes++;
        else ePayes++;
      } else {
        reste += prix;
      }
    });
    const totalDepenses = (db.factures || []).reduce((s, f) => s + f.montant, 0);
    return {
      totalRecolte,
      reste,
      aPayes,
      aTotal,
      ePayes,
      eTotal,
      totalDepenses,
      solde: totalRecolte + (db.reportPrecedent || 0) - totalDepenses,
    };
  }, [db]);

  function exportCSV() {
    const rows: string[][] = [["Nom", "Email", "Telephone", "Type", "Paiement"]];
    db.membres.forEach((m) =>
      rows.push([m.nom, m.email, m.tel || "", m.type, m.ok ? "Paye" : "En attente"])
    );
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `adherents_saccb_${db.y1}_${db.y2}.csv`;
    link.click();
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-[#f8fafc] overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-10">
        <div className="flex items-center justify-between mb-6 sticky top-0 z-10 -mx-4 md:-mx-6 lg:-mx-10 px-4 md:px-6 lg:px-10 py-3 bg-[#f8fafc]/95 backdrop-blur-xl border-b border-slate-200">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-600 font-semibold">Panel</p>
            <h2 className="font-display text-2xl md:text-4xl tracking-wider text-slate-800">Gestion SACCB</h2>
          </div>
          <button onClick={onClose} className="btn-danger !px-3 !py-2">
            <X className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Fermer</span>
          </button>
        </div>

        {readOnly && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">Mode lecture seule — les modifications ne sont pas autorisées.</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <Accounting db={db} totals={totals} onPersist={safePersist} readOnly={!canEdit("comptabilite")} />
          </div>

          <SeasonSettings db={db} onPersist={safePersist} onRefresh={onRefresh} adminEmail={adminEmail} readOnly={!canEdit("saison")} />
          <StatsAdhesions totals={totals} />

          <div className="lg:col-span-2 glass p-4 md:p-6">
            <h3 className="font-display text-lg md:text-xl tracking-wider text-slate-800 mb-3">💾 Sauvegarde PC</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={exportCSV} className="btn-primary !bg-gradient-to-r !from-purple-500 !to-fuchsia-500 !text-xs md:!text-sm">
                <FileSpreadsheet className="w-4 h-4" /> Exporter CSV
              </button>
              <button onClick={() => setEmargementOpen(true)} className="btn-primary !bg-gradient-to-r !from-amber-500 !to-orange-500 !text-xs md:!text-sm">
                <FileText className="w-4 h-4" /> Émargement
              </button>
            </div>
          </div>

          <HelloAssoQR />

          <div className="lg:col-span-2">
            <ActualitesAdmin db={db} onPersist={safePersist} adminEmail={adminEmail} adminCode={adminCode} readOnly={!canEdit("actualites")} />
          </div>
          <div className="lg:col-span-2">
            <TournoisAdmin db={db} onPersist={safePersist} readOnly={!canEdit("tournois")} />
          </div>
          <div className="lg:col-span-2">
            <InscriptionsAdmin db={db} onPersist={safePersist} onEditBin={setEditBin} readOnly={!canEdit("inscriptions")} />
          </div>
          <div className="lg:col-span-2">
            <MembresAdmin
              db={db}
              onPersist={safePersist}
              onEdit={setEditMembre}
              onRecu={setRecuMembre}
              readOnly={!canEdit("membres")}
            />
          </div>
        </div>
      </div>

      {recuMembre && <RecuModal membre={recuMembre} db={db} onClose={() => setRecuMembre(null)} />}
      {emargementOpen && <EmargementModal db={db} onClose={() => setEmargementOpen(false)} />}
      {editMembre && (
        <EditMembreModal
          membre={editMembre}
          onClose={() => setEditMembre(null)}
          onSave={async (m) => {
            const next = { ...db, membres: db.membres.map((x) => (x.id === m.id ? m : x)) };
            await safePersist(next);
            setEditMembre(null);
          }}
        />
      )}
      {editBin && (
        <EditBinomeModal
          bin={editBin}
          onClose={() => setEditBin(null)}
          onSave={async (b) => {
            const next = {
              ...db,
              inscrits_tournoi: db.inscrits_tournoi.map((i) =>
                i.id === b.id ? { ...i, joueurs: b.joueurs } : i
              ),
            };
            await safePersist(next);
            setEditBin(null);
          }}
        />
      )}
    </div>
  );
}

const HELLOASSO_URL =
  "https://www.helloasso.com/associations/sainte-adresse-club-de-competition-du-badminton-s-a-c-c-b/evenements/tarif-adulte";

function HelloAssoQR() {
  const linkRef = useRef<HTMLAnchorElement>(null);

  function downloadQR() {
    const a = document.createElement("a");
    a.href = "/qr-helloasso.png";
    a.download = "QR-HelloAsso-SACCB.png";
    a.click();
  }

  return (
    <div className="lg:col-span-2 glass p-4 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shrink-0">
          <QrCode className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-lg md:text-2xl tracking-wider text-slate-800">HelloAsso — Paiement</h3>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
        <div className="bg-white rounded-2xl p-3 shadow-lg shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qr-helloasso.png" alt="QR Code HelloAsso" className="w-36 h-36 md:w-48 md:h-48 object-contain" />
        </div>
        <div className="flex-1 space-y-3 w-full">
          <p className="text-slate-500 text-sm">
            Partagez ce QR code aux adhérents pour payer via HelloAsso.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={downloadQR} className="btn-primary !text-xs md:!text-sm">
              <Download className="w-4 h-4" /> Télécharger QR
            </button>
            <a href={HELLOASSO_URL} target="_blank" rel="noopener noreferrer" className="btn-accent inline-flex items-center gap-2 !text-xs md:!text-sm">
              <ExternalLink className="w-4 h-4" /> Ouvrir HelloAsso
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
