import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Badminton Sainte-Adresse — SACCB | Association tous niveaux",
  description:
    "Badminton à Sainte-Adresse : rejoignez le SACCB, l'association officielle de badminton de la commune. Tournois doubles, créneaux adultes & étudiants, salle Paul Vatine. Inscription en ligne.",
  keywords: [
    "badminton Sainte-Adresse",
    "SACCB",
    "Sainte-Adresse badminton",
    "association badminton Sainte-Adresse",
    "Sainte-Adresse Club Compétition Badminton",
    "tournoi badminton Sainte-Adresse",
    "inscription badminton Sainte-Adresse",
    "salle Paul Vatine Sainte-Adresse",
    "badminton 76310",
    "badminton 76",
    "badminton Seine-Maritime",
  ],
  authors: [{ name: "SACCB" }],
  creator: "SACCB",
  metadataBase: new URL("https://saccb.fr"),
  alternates: { canonical: "https://saccb.fr" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://saccb.fr",
    siteName: "SACCB",
    title: "Badminton Sainte-Adresse — SACCB",
    description:
      "SACCB : l'association de badminton de Sainte-Adresse. Inscriptions, tournois, créneaux adultes et étudiants.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SACCB Badminton" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Badminton Sainte-Adresse — SACCB",
    description: "L'association de badminton de Sainte-Adresse. Inscriptions, tournois, esprit convivial.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  // 🌍 Meta GEO techniques (aide Google à classer le site géographiquement
  // sans pousser un autre lieu que Sainte-Adresse côté contenu).
  other: {
    "geo.region": "FR-NOR",
    "geo.placename": "Sainte-Adresse",
    "geo.position": "49.5083;0.0833",
    "ICBM": "49.5083, 0.0833",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "SACCB",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#1e3a5f",
};

// JSON-LD enrichi : multi-types + coordonnées GPS + appartenance fédérale.
// On reste centré sur Sainte-Adresse pour le contenu.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": ["SportsClub", "LocalBusiness", "SportsActivityLocation"],
  name: "SACCB — Sainte-Adresse Club de Compétition de Badminton",
  alternateName: "SACCB",
  url: "https://saccb.fr",
  logo: "https://saccb.fr/logo.png",
  image: "https://saccb.fr/og-image.png",
  description:
    "Association de badminton de Sainte-Adresse. Inscriptions, tournois, créneaux adultes et étudiants. Salle Paul Vatine.",
  sport: "Badminton",
  slogan: "Smash · Passion · Convivialité",
  email: "contact@saccb.fr",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Salle Paul Vatine",
    addressLocality: "Sainte-Adresse",
    addressRegion: "Normandie",
    postalCode: "76310",
    addressCountry: "FR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 49.5083,
    longitude: 0.0833,
  },
  areaServed: [
    { "@type": "City", name: "Sainte-Adresse" },
    { "@type": "AdministrativeArea", name: "Seine-Maritime" },
    { "@type": "AdministrativeArea", name: "Normandie" },
  ],
  memberOf: [
    { "@type": "Organization", name: "Fédération Française de Badminton", url: "https://www.ffbad.org" },
    { "@type": "Organization", name: "Ligue Normandie de Badminton" },
    { "@type": "Organization", name: "Comité Départemental 76 de Badminton" },
  ],
  knowsAbout: ["Badminton", "Tournois doubles", "Loisir badminton"],
  audience: { "@type": "Audience", audienceType: "Adultes et étudiants tous niveaux" },
  sameAs: ["https://saccb.fr"],
};

// FAQ JSON-LD : boost SEO (rich results Google + meilleure visibilité sur requêtes longue traîne)
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Où se trouve le club de badminton de Sainte-Adresse ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Le SACCB s'entraîne à la Salle Paul Vatine, à Sainte-Adresse (76310), en Normandie. Les créneaux sont accessibles aux adultes et étudiants.",
      },
    },
    {
      "@type": "Question",
      name: "Comment s'inscrire au SACCB ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "L'inscription se fait directement en ligne sur saccb.fr via le formulaire d'inscription. Le paiement peut être effectué en ligne (HelloAsso) ou par virement. Une fois validée, vous recevez votre code d'accès à l'espace membre.",
      },
    },
    {
      "@type": "Question",
      name: "Quel est le tarif de l'adhésion ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "L'adhésion annuelle est de 50 € pour les adultes et 30 € pour les étudiants. Elle couvre toute la saison sportive et l'accès à tous les créneaux.",
      },
    },
    {
      "@type": "Question",
      name: "Faut-il un niveau particulier pour s'inscrire ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Non, l'association accueille tous les niveaux, du débutant au compétiteur. L'ambiance est conviviale et l'objectif est avant tout de prendre du plaisir sur le terrain.",
      },
    },
    {
      "@type": "Question",
      name: "Le club organise-t-il des tournois ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui, le SACCB organise et participe à plusieurs tournois de double (mixte, homme, dame) durant la saison. Les inscriptions se font via l'espace membre du site.",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Sécurité HTTP via meta tags (GitHub Pages ne supporte pas les headers serveur) */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="SAMEORIGIN" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="Permissions-Policy" content="camera=(), microphone=(), geolocation=()" />
        {/* Content-Security-Policy : limite les sources autorisées pour scripts/images/fetch */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co https://www.helloasso.com; connect-src 'self' https://*.supabase.co; frame-src https://www.google.com; frame-ancestors 'self'; form-action 'self' https://www.helloasso.com; base-uri 'self'; object-src 'none';"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
