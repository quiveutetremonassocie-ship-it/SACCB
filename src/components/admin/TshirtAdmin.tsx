"use client";

import { useMemo, useState } from "react";
import { Shirt, Trash2, Download } from "lucide-react";
import { type DB, type TshirtPhoto, TSHIRT_SIZES_ALL, getTshirtSizesFor } from "@/lib/types";
import { adminDeleteTshirtOrder, adminSetTshirt, adminTshirtPaid, adminTshirtRelance, adminUploadFile } from "@/lib/db";
import { REPORTS_BUCKET, supabaseClient } from "@/lib/supabase";

const TAILLES = TSHIRT_SIZES_ALL;

export default function TshirtAdmin({
  db,
  adminEmail,
  adminCode,
  onPersist,
  onRefresh,
  readOnly,
}: {
  db: DB;
  adminEmail?: string;
  adminCode?: string;
  onPersist: (db: DB) => Promise<void>;
  onRefresh?: () => Promise<void>;
  readOnly?: boolean;
}) {
  const orders = (db.tshirtOrders || []).slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const open = db.tshirtOpen === true;
  const price = typeof db.tshirtPrice === "number" ? db.tshirtPrice : null;
  const [saving, setSaving] = useState(false);
  const [priceInput, setPriceInput] = useState<string>(price !== null ? String(price) : "");
  const [savingPrice, setSavingPrice] = useState(false);

  // Totaux par taille
  const totals = useMemo(() => {
    const t: Record<string, number> = Object.fromEntries(TAILLES.map((s) => [s, 0]));
    orders.forEach((o) => { if (t[o.taille] !== undefined) t[o.taille]++; });
    return t;
  }, [orders]);

  // 📏 Tailles proposées aux adhérents, séparées par sexe (H / F).
  // On garde aussi l'union (sizesAll) pour afficher les tailles déjà commandées.
  const availableSizesH = getTshirtSizesFor(db, "H");
  const availableSizesF = getTshirtSizesFor(db, "F");
  const availableSizesAll = getTshirtSizesFor(db);
  const shownSizes = TAILLES.filter((t) => availableSizesAll.includes(t) || totals[t] > 0);
  const [savingSizesH, setSavingSizesH] = useState(false);
  const [savingSizesF, setSavingSizesF] = useState(false);

  async function toggleSize(sexe: "H" | "F", size: string) {
    if (readOnly) return;
    const current = sexe === "H" ? availableSizesH : availableSizesF;
    const next = current.includes(size) ? current.filter((s) => s !== size) : [...current, size];
    if (next.length === 0) { alert("Il faut proposer au moins une taille."); return; }
    const ordered = TAILLES.filter((t) => next.includes(t));
    const setBusy = sexe === "H" ? setSavingSizesH : setSavingSizesF;
    setBusy(true);
    if (adminEmail && adminCode) {
      const payload = sexe === "H" ? { sizesH: [...ordered] } : { sizesF: [...ordered] };
      const r = await adminSetTshirt(adminEmail, adminCode, payload);
      if (!r.ok) alert("Erreur : les tailles n'ont pas été enregistrées. " + (r.reason || ""));
      if (onRefresh) await onRefresh();
    } else {
      const patch = sexe === "H" ? { tshirtSizesH: [...ordered] } : { tshirtSizesF: [...ordered] };
      await onPersist({ ...db, ...patch });
    }
    setBusy(false);
  }

  // 🎨 Couleurs proposées aux adhérents
  const couleurs = db.tshirtColors || [];
  const [nouvelleCouleur, setNouvelleCouleur] = useState("");
  async function majCouleurs(next: string[]) {
    if (readOnly) return;
    await onPersist({ ...db, tshirtColors: next });
  }
  function ajouterCouleur() {
    const c = nouvelleCouleur.trim();
    if (!c) return;
    if (couleurs.some((x) => x.toLowerCase() === c.toLowerCase())) { alert("Cette couleur est déjà dans la liste."); return; }
    setNouvelleCouleur("");
    majCouleurs([...couleurs, c.slice(0, 40)]);
  }
  const avecCouleur = couleurs.length > 0 || orders.some((o) => o.couleur);

  // 📄 Catalogue PDF (couleurs / modèles) montré aux adhérents dans le formulaire de commande
  const catalogue = db.tshirtCatalogue;
  const [envoiCatalogue, setEnvoiCatalogue] = useState(false);
  async function envoyerCatalogue(file: File | undefined) {
    if (!file || readOnly) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) { alert("Choisis un fichier PDF."); return; }
    if (file.size > 15_000_000) { alert("PDF trop lourd (15 Mo maximum)."); return; }
    setEnvoiCatalogue(true);
    try {
      let url = "", path = "";
      if (adminEmail && adminCode) {
        const r = await adminUploadFile({ adminEmail, adminCode, file: new File([file], file.name, { type: "application/pdf" }), bucket: REPORTS_BUCKET, pathPrefix: "tshirt" });
        if (!r.ok || !r.url || !r.path) { alert("Erreur envoi du PDF : " + (r.reason || "inconnue")); return; }
        url = r.url; path = r.path;
      } else {
        path = `tshirt/catalogue-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabaseClient.storage.from(REPORTS_BUCKET).upload(path, file, { upsert: false, contentType: "application/pdf" });
        if (error) { alert("Erreur envoi du PDF : " + error.message); return; }
        url = supabaseClient.storage.from(REPORTS_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      // L'ancien PDF n'est pas supprimé : « Libérer de l'espace » (Journal) le proposera s'il ne sert plus
      await onPersist({ ...db, tshirtCatalogue: { url, path, name: file.name } });
    } finally {
      setEnvoiCatalogue(false);
    }
  }

  // 🖼️ Photos du catalogue (en plus ou à la place du PDF) — upload image/*
  const photos: TshirtPhoto[] = Array.isArray(db.tshirtPhotos) ? db.tshirtPhotos : [];
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  async function envoyerPhotos(files: FileList | null) {
    if (!files || files.length === 0 || readOnly) return;
    const newPhotos: TshirtPhoto[] = [];
    setEnvoiPhoto(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) { alert(`« ${file.name } » n'est pas une image.`); continue; }
        if (file.size > 10_000_000) { alert(`« ${file.name } » trop lourde (10 Mo max).`); continue; }
        let url = "", path = "";
        if (adminEmail && adminCode) {
          const r = await adminUploadFile({ adminEmail, adminCode, file, bucket: REPORTS_BUCKET, pathPrefix: "tshirt-photo" });
          if (!r.ok || !r.url || !r.path) { alert(`Erreur envoi de « ${file.name} » : ${r.reason || "inconnue"}`); continue; }
          url = r.url; path = r.path;
        } else {
          path = `tshirt-photo/photo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { error } = await supabaseClient.storage.from(REPORTS_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
          if (error) { alert(`Erreur envoi de « ${file.name} » : ${error.message}`); continue; }
          url = supabaseClient.storage.from(REPORTS_BUCKET).getPublicUrl(path).data.publicUrl;
        }
        newPhotos.push({ url, path, name: file.name });
      }
      if (newPhotos.length > 0) {
        await onPersist({ ...db, tshirtPhotos: [...photos, ...newPhotos] });
      }
    } finally {
      setEnvoiPhoto(false);
    }
  }

  async function retirerPhoto(path: string) {
    if (readOnly) return;
    if (!confirm("Retirer cette photo du catalogue ?")) return;
    // On ne supprime pas le fichier dans Supabase ici (« Libérer de l'espace » du Journal s'en occupera)
    await onPersist({ ...db, tshirtPhotos: photos.filter((p) => p.path !== path) });
  }

  const totalRecette = price !== null ? orders.length * price : null;

  async function toggleOpen() {
    if (readOnly) return;
    setSaving(true);
    if (adminEmail && adminCode) {
      // Action dédiée côté serveur : ne touche que ce champ, une copie admin périmée ne peut pas l'écraser
      // 📧 À l'ouverture, on demande explicitement si on prévient les adhérents (évite les envois sur fausse manip)
      const notify = !open && confirm("Les commandes vont être ouvertes.\n\nEnvoyer aussi un email à tous les adhérents (payés + news activées) pour les prévenir ?\n\nOK = ouvrir ET envoyer l'email · Annuler = ouvrir SANS email");
      const r = await adminSetTshirt(adminEmail, adminCode, { open: !open, notify });
      if (!r.ok) alert("Erreur : la section t-shirt n'a pas été modifiée. " + (r.reason || ""));
      if (onRefresh) await onRefresh();
    } else {
      await onPersist({ ...db, tshirtOpen: !open });
    }
    setSaving(false);
  }

  async function savePrice() {
    if (readOnly) return;
    const v = priceInput.trim();
    const newPrice = v === "" ? undefined : Number(v.replace(",", "."));
    if (v !== "" && (isNaN(newPrice as number) || (newPrice as number) < 0)) {
      alert("Prix invalide.");
      return;
    }
    setSavingPrice(true);
    if (adminEmail && adminCode) {
      const r = await adminSetTshirt(adminEmail, adminCode, { price: newPrice ?? null });
      if (!r.ok) alert("Erreur : le prix n'a pas été enregistré. " + (r.reason || ""));
      if (onRefresh) await onRefresh();
    } else {
      await onPersist({ ...db, tshirtPrice: newPrice });
    }
    setSavingPrice(false);
  }

  // 💳 Paiement en ligne (lien HelloAsso) + suivi payé / non payé + relances
  const paymentUrl = typeof db.tshirtPaymentUrl === "string" ? db.tshirtPaymentUrl : "";
  const [payUrlInput, setPayUrlInput] = useState(paymentUrl);
  const [savingPayUrl, setSavingPayUrl] = useState(false);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [relancing, setRelancing] = useState(false);
  const [payFilter, setPayFilter] = useState<"all" | "paid" | "unpaid">("all");
  const paidCount = orders.filter((o) => o.paid).length;
  const unpaidOrders = orders.filter((o) => !o.paid);
  const encaisse = price !== null ? paidCount * price : null;
  const shownOrders = orders.filter((o) => payFilter === "all" || (payFilter === "paid" ? o.paid : !o.paid));

  async function savePaymentUrl() {
    if (readOnly || !adminEmail || !adminCode) return;
    const v = payUrlInput.trim();
    if (v && !/^https:\/\//.test(v)) { alert("Le lien doit commencer par https://"); return; }
    setSavingPayUrl(true);
    const r = await adminSetTshirt(adminEmail, adminCode, { paymentUrl: v || null });
    if (!r.ok) alert("Erreur : le lien n'a pas été enregistré. " + (r.reason || ""));
    if (onRefresh) await onRefresh();
    setSavingPayUrl(false);
  }

  async function togglePaid(orderId: string, paid: boolean) {
    if (readOnly || !adminEmail || !adminCode) return;
    const o = orders.find((x) => x.id === orderId);
    // ✅ En validant le paiement, on propose d'envoyer le mail de confirmation
    const notify = paid && confirm(`Paiement validé pour ${o ? `${o.prenom} ${o.nom}`.trim() : "cette commande"}.\n\nEnvoyer le mail « paiement de ton t-shirt confirmé » ?\n\nOK = envoyer · Annuler = ne pas envoyer`);
    setBusyOrder(orderId);
    const r = await adminTshirtPaid(adminEmail, adminCode, orderId, paid, notify);
    if (!r.ok) alert("Erreur : " + (r.reason || "inconnue"));
    else if (notify && !r.mailEnvoye) alert("Paiement enregistré, mais le mail n'a pas pu être envoyé (adresse introuvable).");
    if (onRefresh) await onRefresh();
    setBusyOrder(null);
  }

  async function relancer(orderIds?: string[]) {
    if (readOnly || !adminEmail || !adminCode) return;
    const n = orderIds ? orderIds.length : unpaidOrders.length;
    if (n === 0) return;
    if (!confirm(`Envoyer un email de rappel de paiement à ${n === 1 && orderIds ? "cette personne" : `${n} personne${n > 1 ? "s" : ""} qui n'ont pas encore payé`} ?`)) return;
    setRelancing(true);
    const r = await adminTshirtRelance(adminEmail, adminCode, orderIds);
    setRelancing(false);
    if (r.ok) alert(`✅ ${r.sent ?? 0} rappel${(r.sent ?? 0) > 1 ? "s" : ""} envoyé${(r.sent ?? 0) > 1 ? "s" : ""}.`);
    else alert("Erreur : " + (r.reason || "inconnue"));
    if (onRefresh) await onRefresh();
  }

  async function handleDelete(orderId: string) {
    if (!adminEmail || !adminCode) return;
    if (!confirm("Supprimer cette commande t-shirt ?")) return;
    const r = await adminDeleteTshirtOrder(adminEmail, adminCode, orderId);
    if (r.ok && onRefresh) await onRefresh();
    else if (!r.ok) alert("Erreur : " + (r.reason || "Inconnue"));
  }

  // 🏷️ Libellé court du sexe pour l'affichage/les exports (pas d'emoji dans les PDF cf. jsPDF)
  function sexeLabel(s: string | undefined): string {
    if (s === "H") return "Homme";
    if (s === "F") return "Femme";
    return "";
  }

  function exportCSV() {
    const rows: string[][] = [["Prenom", "Nom", "Sexe", "Taille", "Couleur", "Floque", "Date"]];
    orders.forEach((o) => {
      rows.push([o.prenom, o.nom, sexeLabel(o.sexe), o.taille, o.couleur || "", o.nomFloque || "", new Date(o.createdAt).toLocaleString("fr-FR")]);
    });
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tshirts_saccb_${db.y1}_${db.y2}.csv`;
    link.click();
  }

  // 🏭 Bon de commande fabricant : récap par taille + détail trié par sexe, taille (floquage compris)
  // Tri : sexe (H puis F puis ?), couleur, taille, nom
  function sexeTri(s: string | undefined): number {
    if (s === "H") return 0;
    if (s === "F") return 1;
    return 2;
  }
  const ordersBySize = [...orders].sort((a, b) =>
    sexeTri(a.sexe) - sexeTri(b.sexe) ||
    (a.couleur || "").localeCompare(b.couleur || "", "fr") ||
    TAILLES.indexOf(a.taille as (typeof TAILLES)[number]) - TAILLES.indexOf(b.taille as (typeof TAILLES)[number]) ||
    `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr")
  );

  // 📄 PDF pour le fabricant : Sexe, Taille, Couleur, Floquage, Nom, trié par sexe puis taille
  async function exportFabricantPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    const totalH = orders.filter((o) => o.sexe === "H").length;
    const totalF = orders.filter((o) => o.sexe === "F").length;
    const totalNC = orders.length - totalH - totalF;
    doc.setFontSize(16);
    doc.text(`Commande T-shirts SACCB - saison ${db.y1}-${db.y2}`, 14, 18);
    doc.setFontSize(10);
    const recapSexe = [
      totalH > 0 ? `${totalH} Homme${totalH > 1 ? "s" : ""}` : null,
      totalF > 0 ? `${totalF} Femme${totalF > 1 ? "s" : ""}` : null,
      totalNC > 0 ? `${totalNC} non renseigne${totalNC > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" - ");
    doc.text(
      `${orders.length} t-shirt${orders.length > 1 ? "s" : ""}${recapSexe ? ` - ${recapSexe}` : ""}`,
      14, 25,
    );
    doc.text(shownSizes.map((t) => `${t}: ${totals[t]}`).join("  -  "), 14, 31);
    let y = 37;
    // 👤 Récapitulatif par sexe × taille (hommes et femmes séparés) pour le fabricant
    const recapRows: (string | number)[][] = [];
    if (totalH > 0) {
      const de = orders.filter((o) => o.sexe === "H");
      recapRows.push(["Hommes", ...shownSizes.map((t) => de.filter((o) => o.taille === t).length || ""), de.length]);
    }
    if (totalF > 0) {
      const de = orders.filter((o) => o.sexe === "F");
      recapRows.push(["Femmes", ...shownSizes.map((t) => de.filter((o) => o.taille === t).length || ""), de.length]);
    }
    if (totalNC > 0) {
      const de = orders.filter((o) => o.sexe !== "H" && o.sexe !== "F");
      recapRows.push(["Non renseigne", ...shownSizes.map((t) => de.filter((o) => o.taille === t).length || ""), de.length]);
    }
    if (recapRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Sexe", ...shownSizes, "Total"]],
        body: recapRows,
        styles: { fontSize: 10, halign: "center" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        headStyles: { fillColor: [30, 58, 95] },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
    if (avecCouleur) {
      // Récapitulatif couleur × taille pour le fabricant
      const cols = [...new Set(orders.map((o) => o.couleur || "Sans couleur"))];
      autoTable(doc, {
        startY: y,
        head: [["Couleur", ...shownSizes, "Total"]],
        body: cols.map((c) => {
          const de = orders.filter((o) => (o.couleur || "Sans couleur") === c);
          return [c, ...shownSizes.map((t) => String(de.filter((o) => o.taille === t).length || "")), String(de.length)];
        }),
        styles: { fontSize: 10, halign: "center" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        headStyles: { fillColor: [16, 185, 129] },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }
    autoTable(doc, {
      startY: y,
      head: [avecCouleur ? ["Sexe", "Taille", "Couleur", "Floquage", "Nom"] : ["Sexe", "Taille", "Floquage", "Nom"]],
      body: ordersBySize.map((o) => avecCouleur
        ? [sexeLabel(o.sexe) || "-", o.taille, o.couleur || "", o.nomFloque || "", `${o.prenom} ${o.nom}`.trim()]
        : [sexeLabel(o.sexe) || "-", o.taille, o.nomFloque || "", `${o.prenom} ${o.nom}`.trim()]),
      styles: { fontSize: 11 },
      headStyles: { fillColor: [30, 58, 95] },
    });
    doc.save(`commande_tshirts_saccb_${db.y1}_${db.y2}.pdf`);
  }

  return (
    <div className="glass p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Shirt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-display text-xl tracking-wider text-slate-800">Commande T-shirts</h3>
            <p className="text-xs text-slate-500">{orders.length} commande{orders.length > 1 ? "s" : ""} reçue{orders.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <button onClick={exportCSV} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
          {!readOnly && (
            <button
              onClick={toggleOpen}
              disabled={saving}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                open
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
              }`}
            >
              {open ? "✓ Commandes ouvertes" : "✗ Commandes fermées"}
            </button>
          )}
        </div>
      </div>

      {!open && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-slate-600">
            ℹ️ La section commande t-shirt est <strong>masquée</strong> pour les adhérents. Cliquez sur le bouton ci-dessus pour l&apos;ouvrir.
          </p>
        </div>
      )}

      {/* 💰 Prix unitaire du t-shirt (optionnel) */}
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
        <label className="text-xs uppercase tracking-widest text-amber-700 font-semibold mb-2 block">
          💰 Prix unitaire (€) — facultatif
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            step="0.5"
            min="0"
            placeholder="ex: 15"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            disabled={readOnly}
            className="flex-1 text-sm border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 bg-white"
          />
          {!readOnly && (
            <button
              onClick={savePrice}
              disabled={savingPrice}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {savingPrice ? "..." : "Enregistrer"}
            </button>
          )}
          {price !== null && (
            <button
              onClick={() => { setPriceInput(""); savePrice(); }}
              disabled={savingPrice || readOnly}
              className="text-xs text-slate-500 hover:text-slate-700 px-2"
              title="Retirer le prix"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          Le prix s&apos;affiche dans la commande côté membre. Laisser vide pour ne pas afficher de prix.
          {totalRecette !== null && orders.length > 0 && (
            <> <strong className="text-amber-800">Recette estimée : {totalRecette.toFixed(2)}€</strong> ({orders.length} × {price}€)</>
          )}
        </p>
      </div>

      {/* 📏 Tailles disponibles — séparées homme / femme (coupes et dispo différentes) */}
      <div className="mb-4 bg-white border border-slate-200 rounded-xl p-3">
        <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-2">📏 Tailles disponibles</p>

        {/* Hommes */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-blue-700 mb-1.5">👕 Hommes</p>
          <div className="flex flex-wrap gap-2">
            {TAILLES.map((t) => {
              const on = availableSizesH.includes(t);
              return (
                <button
                  key={`H-${t}`}
                  onClick={() => toggleSize("H", t)}
                  disabled={readOnly || savingSizesH}
                  className={`min-w-[3rem] text-sm font-bold px-3 py-1.5 rounded-lg border transition disabled:opacity-60 ${
                    on ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-slate-300 text-slate-400 line-through"
                  }`}
                  title={on ? "Proposée aux hommes — cliquer pour la retirer" : "Non proposée aux hommes — cliquer pour l'ajouter"}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Femmes */}
        <div>
          <p className="text-xs font-semibold text-pink-700 mb-1.5">👚 Femmes</p>
          <div className="flex flex-wrap gap-2">
            {TAILLES.map((t) => {
              const on = availableSizesF.includes(t);
              return (
                <button
                  key={`F-${t}`}
                  onClick={() => toggleSize("F", t)}
                  disabled={readOnly || savingSizesF}
                  className={`min-w-[3rem] text-sm font-bold px-3 py-1.5 rounded-lg border transition disabled:opacity-60 ${
                    on ? "bg-pink-500 border-pink-500 text-white" : "bg-white border-slate-300 text-slate-400 line-through"
                  }`}
                  title={on ? "Proposée aux femmes — cliquer pour la retirer" : "Non proposée aux femmes — cliquer pour l'ajouter"}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 mt-2">Chaque adhérent ne verra que les tailles correspondant à son sexe. S&apos;il n&apos;est pas renseigné, la commande lui demandera H ou F avant de choisir la taille.</p>
      </div>

      {/* 🎨 Couleurs proposées aux adhérents */}
      <div className="mb-4 bg-white border border-slate-200 rounded-xl p-3">
        <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-2">🎨 Couleurs disponibles</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {couleurs.length === 0 && <span className="text-xs text-slate-400">Aucune : les adhérents ne choisissent pas de couleur.</span>}
          {couleurs.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-lg bg-emerald-500 text-white">
              {c}
              {!readOnly && (
                <button onClick={() => { if (confirm(`Retirer la couleur « ${c} » ? (les commandes déjà passées la gardent)`)) majCouleurs(couleurs.filter((x) => x !== c)); }} className="text-white/80 hover:text-white" title="Retirer">×</button>
              )}
            </span>
          ))}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <input
              value={nouvelleCouleur}
              onChange={(e) => setNouvelleCouleur(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouterCouleur(); } }}
              placeholder="Ex. Bleu marine, Blanc, Noir…"
              className="flex-1 min-w-0 text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
              maxLength={40}
            />
            <button onClick={ajouterCouleur} disabled={!nouvelleCouleur.trim()} className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">Ajouter</button>
          </div>
        )}
        <p className="text-[11px] text-slate-500 mt-1.5">Si au moins une couleur est proposée, l&apos;adhérent doit en choisir une dans un menu déroulant au moment de commander.</p>

        {/* 📄 Catalogue PDF */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-600 mb-1.5">📄 Catalogue (PDF)</p>
          {catalogue ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <a href={catalogue.url} target="_blank" rel="noopener" className="text-blue-700 hover:underline truncate max-w-[16rem]">{catalogue.name}</a>
              {!readOnly && (
                <>
                  <label className="text-xs bg-white border border-slate-300 hover:bg-slate-50 font-semibold px-3 py-1 rounded-lg cursor-pointer">
                    {envoiCatalogue ? "Envoi…" : "Remplacer"}
                    <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={envoiCatalogue} onChange={(e) => { envoyerCatalogue(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  <button onClick={() => { if (confirm("Retirer le catalogue ? Les adhérents ne le verront plus.")) onPersist({ ...db, tshirtCatalogue: undefined }); }} className="text-xs text-red-600 hover:text-red-700 font-semibold">Retirer</button>
                </>
              )}
            </div>
          ) : !readOnly ? (
            <label className="inline-flex text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg cursor-pointer">
              {envoiCatalogue ? "Envoi…" : "Ajouter un catalogue PDF"}
              <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={envoiCatalogue} onChange={(e) => { envoyerCatalogue(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          ) : (
            <p className="text-xs text-slate-400">Aucun catalogue.</p>
          )}
          <p className="text-[11px] text-slate-500 mt-1.5">Les adhérents voient un bouton « Voir le catalogue » dans leur formulaire de commande.</p>
        </div>

        {/* 🖼️ Photos du catalogue (en plus du PDF) */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-600 mb-1.5">🖼️ Photos du catalogue ({photos.length})</p>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-2">
              {photos.map((p) => (
                <div key={p.path} className="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-50 aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  {!readOnly && (
                    <button
                      onClick={() => retirerPhoto(p.path)}
                      className="absolute top-1 right-1 bg-white/90 hover:bg-white text-red-600 border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm"
                      title="Retirer cette photo"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly ? (
            <label className="inline-flex text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg cursor-pointer">
              {envoiPhoto ? "Envoi…" : photos.length === 0 ? "Ajouter une ou plusieurs photos" : "Ajouter d'autres photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={envoiPhoto}
                onChange={(e) => { envoyerPhotos(e.target.files); e.target.value = ""; }}
              />
            </label>
          ) : (photos.length === 0 && <p className="text-xs text-slate-400">Aucune photo.</p>)}
          <p className="text-[11px] text-slate-500 mt-1.5">Les adhérents voient les photos directement dans leur formulaire de commande, en plus du catalogue PDF s&apos;il y en a un. Images jusqu&apos;à 10 Mo.</p>
        </div>
      </div>

      {/* Totaux par taille */}
      {orders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {shownSizes.map((t) => (
            <div key={t} className="flex-1 min-w-[3.5rem] bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
              <p className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold">{t}</p>
              <p className="text-xl font-bold text-amber-900">{totals[t]}</p>
            </div>
          ))}
        </div>
      )}

      {/* 🏭 Bon de commande pour le fabricant */}
      {orders.length > 0 && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs uppercase tracking-widest text-blue-700 font-semibold mb-1">🏭 Bon de commande fabricant</p>
          <p className="text-[11px] text-slate-600 mb-2">PDF avec le récapitulatif par couleur et par taille, puis la taille, la couleur, le floquage et le nom de chaque t-shirt, à envoyer au fabricant.</p>
          <button onClick={exportFabricantPdf} className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Télécharger le PDF
          </button>
        </div>
      )}

      {/* 💳 Paiement en ligne + suivi des paiements */}
      <div className="mb-4 bg-white border border-slate-200 rounded-xl p-3">
        <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold mb-2">💳 Paiement en ligne (facultatif)</p>
        <div className="flex gap-2 items-center">
          <input
            type="url"
            value={payUrlInput}
            onChange={(e) => setPayUrlInput(e.target.value)}
            disabled={readOnly}
            placeholder="Lien HelloAsso de la campagne t-shirts (https://www.helloasso.com/…)"
            className="flex-1 min-w-0 text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
          />
          {!readOnly && (
            <button onClick={savePaymentUrl} disabled={savingPayUrl || payUrlInput.trim() === paymentUrl} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
              {savingPayUrl ? "..." : "Enregistrer"}
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5">
          {paymentUrl
            ? "✓ Les adhérents voient un bouton « Payer mon t-shirt en ligne » dans leur commande. Vide le champ et enregistre pour revenir au paiement au magasin."
            : "Sans lien : paiement au magasin. Avec un lien : les adhérents paient en ligne et n'ont plus qu'à venir chercher leur t-shirt."}
        </p>

        {orders.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button onClick={() => setPayFilter("all")} className={`px-2.5 py-1 rounded-lg border ${payFilter === "all" ? "bg-slate-700 text-white border-slate-700" : "border-slate-300 text-slate-600"}`}>Tous ({orders.length})</button>
              <button onClick={() => setPayFilter("paid")} className={`px-2.5 py-1 rounded-lg border ${payFilter === "paid" ? "bg-emerald-500 text-white border-emerald-500" : "border-emerald-300 text-emerald-700"}`}>✓ Payés ({paidCount})</button>
              <button onClick={() => setPayFilter("unpaid")} className={`px-2.5 py-1 rounded-lg border ${payFilter === "unpaid" ? "bg-red-500 text-white border-red-500" : "border-red-300 text-red-700"}`}>✗ Non payés ({unpaidOrders.length})</button>
              {encaisse !== null && <span className="text-slate-600">· Encaissé : <strong>{encaisse.toFixed(2)}€</strong>{totalRecette !== null ? ` / ${totalRecette.toFixed(2)}€` : ""}</span>}
            </div>
            {!readOnly && unpaidOrders.length > 0 && (
              <button
                onClick={() => relancer()}
                disabled={relancing}
                className="mt-2 w-full text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg py-1.5 disabled:opacity-50"
              >
                {relancing ? "Envoi des rappels…" : `📨 Relancer les ${unpaidOrders.length} personne${unpaidOrders.length > 1 ? "s" : ""} qui n'ont pas payé`}
              </button>
            )}
            <p className="text-[11px] text-slate-500 mt-1.5">Coche « ✓ Payé » sur chaque commande quand tu vois le paiement dans HelloAsso (ou quand la personne paie au magasin).</p>
          </div>
        )}
      </div>

      {/* Liste des commandes */}
      {orders.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">Aucune commande pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {shownOrders.map((o) => (
            <li key={o.id} className={`bg-white border rounded-xl p-3 flex items-center gap-3 flex-wrap ${o.paid ? "border-emerald-200" : "border-slate-200"}`}>
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 font-mono text-sm font-bold text-amber-800">
                {o.taille}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {o.prenom} {o.nom}
                  {o.sexe === "H" && <span className="ml-2 text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">👕 Homme</span>}
                  {o.sexe === "F" && <span className="ml-2 text-[11px] font-semibold text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded">👚 Femme</span>}
                  {!o.sexe && <span className="ml-2 text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded" title="Sexe non renseigné">H/F ?</span>}
                  {o.couleur && <span className="ml-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">🎨 {o.couleur}</span>}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {o.nomFloque ? <>Floqué : <strong>&quot;{o.nomFloque}&quot;</strong> · </> : null}
                  {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                  {o.relances && o.relances.length > 0 && (
                    <> · relancé {o.relances.length}× (dernier le {new Date(o.relances[o.relances.length - 1]).toLocaleDateString("fr-FR")})</>
                  )}
                </p>
              </div>
              {/* 💳 Payé / non payé (clic pour changer) */}
              <button
                onClick={() => togglePaid(o.id, !o.paid)}
                disabled={readOnly || busyOrder === o.id}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 disabled:opacity-60 ${o.paid ? "bg-emerald-500 border-emerald-500 text-white" : "bg-red-50 border-red-300 text-red-700"}`}
                title={o.paid ? `Payé${o.paidVia === "helloasso" ? " sur HelloAsso (automatique)" : ""}${o.paidAt ? " le " + new Date(o.paidAt).toLocaleDateString("fr-FR") : ""} — cliquer pour annuler` : "Non payé — cliquer quand le paiement est reçu"}
              >
                {busyOrder === o.id ? "…" : o.paid ? "✓ Payé" : "✗ Non payé"}
              </button>
              {!readOnly && !o.paid && (
                <button
                  onClick={() => relancer([o.id])}
                  disabled={relancing}
                  className="text-xs text-blue-700 border border-blue-200 hover:bg-blue-50 px-2 py-1 rounded-lg shrink-0 disabled:opacity-50"
                  title="Envoyer un rappel de paiement à cette personne"
                >
                  📨 Relancer
                </button>
              )}
              {!readOnly && (
                <button
                  onClick={() => handleDelete(o.id)}
                  className="text-red-400 hover:text-red-600 p-1.5 rounded shrink-0"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
