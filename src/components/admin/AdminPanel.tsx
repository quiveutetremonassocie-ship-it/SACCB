"use client";

import { useMemo, useRef, useState } from "react";
import { X, FileSpreadsheet, FileText, QrCode, Download, ExternalLink } from "lucide-react";
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
}: {
  db: DB;
  onClose: () => void;
  onPersist: (db: DB) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [recuMembre, setRecuMembre] = useState<Membre | null>(null);
  const [emargementOpen, setEmargementOpen] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);
  const [editBin, setEditBin] = useState<{ id: string; joueurs: string } | null>(null);

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
      solde: totalRecolte - totalDepenses,
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
    <div className="fixed inset-0 z-[2000] bg-bgdark overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 md:p-10">
        <div className="flex items-center justify-between mb-8 sticky top-0 z-10 -mx-6 px-6 py-4 bg-bgdark/95 backdrop-blur-xl border-b border-white/10">
          <div>
            <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold">Panel</p>
            <h2 className="font-display text-3xl md:text-4xl tracking-wider text-white">Gestion SACCB</h2>
          </div>
          <button onClick={onClose} className="btn-danger">
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2">
            <Accounting db={db} totals={totals} onPersist={onPersist} />
          </div>

          <SeasonSettings db={db} onPersist={onPersist} onRefresh={onRefresh} />
          <StatsAdhesions totals={totals} />

          <div className="lg:col-span-2 glass p-6">
            <h3 className="font-display text-xl tracking-wider text-white mb-4">💾 Sauvegarde PC</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={exportCSV} className="btn-primary !bg-gradient-to-r !from-purple-500 !to-fuchsia-500">
                <FileSpreadsheet className="w-4 h-4" /> Exporter CSV
              </button>
              <button onClick={() => setEmargementOpen(true)} className="btn-primary !bg-gradient-to-r !from-amber-500 !to-orange-500">
                <FileText className="w-4 h-4" /> Liste Émargement
              </button>
            </div>
          </div>

          <HelloAssoQR />

          <div className="lg:col-span-2">
            <ActualitesAdmin db={db} onPersist={onPersist} />
          </div>
          <div className="lg:col-span-2">
            <TournoisAdmin db={db} onPersist={onPersist} />
          </div>
          <div className="lg:col-span-2">
            <InscriptionsAdmin db={db} onPersist={onPersist} onEditBin={setEditBin} />
          </div>
          <div className="lg:col-span-2">
            <MembresAdmin
              db={db}
              onPersist={onPersist}
              onEdit={setEditMembre}
              onRecu={setRecuMembre}
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
            await onPersist(next);
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
            await onPersist(next);
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
    <div className="lg:col-span-2 glass p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
          <QrCode className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-white">HelloAsso — Paiement en ligne</h3>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="bg-white rounded-2xl p-3 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qr-helloasso.png"
            alt="QR Code HelloAsso"
            className="w-48 h-48 object-contain"
          />
        </div>
        <div className="flex-1 space-y-3">
          <p className="text-white/70 text-sm">
            Partagez ce QR code aux adhérents pour qu&apos;ils puissent payer leur adhésion
            directement en ligne via HelloAsso.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={downloadQR} className="btn-primary">
              <Download className="w-4 h-4" /> Télécharger le QR
            </button>
            <a
              ref={linkRef}
              href={HELLOASSO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent inline-flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Ouvrir HelloAsso
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
