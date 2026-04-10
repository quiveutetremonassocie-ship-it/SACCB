# SACCB — Site Officiel (Next.js)

Refonte complète du site du club de badminton de Sainte-Adresse en **Next.js 14 / Tailwind CSS / Supabase**, avec un design moderne (glassmorphism, animations Framer Motion, image de fond badminton). Toutes les fonctionnalités d'origine sont conservées et l'on y ajoute :

- 📎 **Upload de pièces jointes (PDF / images)** sur les factures dans la comptabilité
- 👁️ Visualisation et téléchargement des justificatifs depuis le panel admin
- 💸 Tarif étudiant mis à jour : **30 €**
- 🎨 Refonte UI/UX complète

---

## 1. Installation locale

```bash
cd saccb-next
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## 2. Configuration Supabase (à faire UNE seule fois)

L'URL et la clé anon Supabase sont déjà câblées dans `src/lib/supabase.ts` (mêmes que l'ancien site).

### 2.1. Créer le bucket Storage pour les factures

Dans le dashboard Supabase de ton projet :

1. Va dans **Storage** → **New bucket**
2. Nom du bucket : **`factures`**
3. **Décoche** "Public bucket" (on utilise des URLs signées sécurisées)
4. Clique sur **Create**

### 2.2. Politiques RLS pour le bucket

Dans **Storage → Policies**, sur le bucket `factures`, ajoute :

```sql
-- Lecture (admins authentifiés)
CREATE POLICY "Admins can read factures"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'factures');

-- Upload (admins authentifiés)
CREATE POLICY "Admins can upload factures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'factures');

-- Suppression (admins authentifiés)
CREATE POLICY "Admins can delete factures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'factures');
```

Tu peux les créer depuis l'interface "New policy → For full customization".

> ⚠️ Si tu sautes cette étape, l'upload des fichiers échouera côté admin. Le reste du site continuera de fonctionner.

## 3. Déploiement GitHub Pages + saccb.fr

Le projet est configuré en **export statique** (`output: 'export'` dans `next.config.js`), compatible 100 % avec GitHub Pages.

### Étapes

1. Crée un nouveau dépôt GitHub (par ex. `saccb-site`).
2. Pousse le dossier `saccb-next/` à la racine du dépôt.
3. Sur GitHub : **Settings → Pages → Source → GitHub Actions**.
4. Le workflow `.github/workflows/deploy.yml` se déclenche automatiquement à chaque `git push` sur `main`.
5. Pour le domaine : **Settings → Pages → Custom domain → `saccb.fr`** (le fichier `public/CNAME` est déjà en place).
6. Chez ton registrar de domaine, ajoute les enregistrements DNS GitHub Pages :

```
A     @   185.199.108.153
A     @   185.199.109.153
A     @   185.199.110.153
A     @   185.199.111.153
CNAME www <ton-utilisateur>.github.io
```

7. Coche "Enforce HTTPS" dans Settings → Pages.

## 4. Structure

```
saccb-next/
├── .github/workflows/deploy.yml   # CI/CD GitHub Pages
├── public/
│   ├── CNAME                       # saccb.fr
│   └── .nojekyll
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css             # fond badminton + thème
│   ├── components/
│   │   ├── Site.tsx                # racine côté client
│   │   ├── Navbar.tsx
│   │   ├── Hero.tsx
│   │   ├── Presentation.tsx
│   │   ├── Tournois.tsx
│   │   ├── Inscription.tsx
│   │   ├── Footer.tsx
│   │   ├── modals/                 # login + reset password
│   │   └── admin/                  # AdminPanel + sous-modules
│   └── lib/
│       ├── supabase.ts
│       ├── db.ts
│       └── types.ts
└── README.md
```

## 5. Fonctionnalités

- 🏠 **Hero** plein écran avec image badminton, titre animé, call-to-actions
- 👥 **Présentation** (horaires, tarifs, lieu)
- 🏆 **Tournois publics** avec inscription de binômes
- ✅ **Inscription saison** avec quota live et badge animé + confettis
- 🔐 **Espace Admin** Supabase Auth :
  - 💰 Comptabilité : recettes, dépenses, solde, **upload PDF/JPG/PNG sur les factures**, visualisation et téléchargement des fichiers
  - 📅 Paramètres saison (ouverture/fermeture inscriptions, dates)
  - 📊 Stats adhésions
  - 🏆 Gestion tournois et binômes
  - 👥 Gestion adhérents (recherche, paiement, reçu PDF imprimable, émargement)
  - 💾 Export CSV, copie d'emails, liste d'émargement imprimable

## 6. Modifications apportées vs. ancien site

| Avant | Après |
|---|---|
| Tarif étudiant 25 € | **30 €** ✅ |
| Pas de pièces jointes sur factures | **Upload PDF/JPG/PNG → Storage Supabase** ✅ |
| HTML monolithique 800 lignes | Next.js + composants modulaires |
| Style sombre basique | Glassmorphism + animations + fond badminton |
| Hébergement statique | GitHub Pages auto-déployé sur saccb.fr |

---

Bon jeu sur le terrain 🏸
