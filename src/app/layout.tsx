import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // 🎯 SEO : titre optimisé GEO Le Havre + Sainte-Adresse
  title: "Badminton Le Havre / Sainte-Adresse — SACCB | Club convivial",
  description:
    "Club de badminton au Havre / Sainte-Adresse. Tous niveaux, doubles conviviaux, tournois Seine-Maritime, créneaux adultes et étudiants. Inscription en ligne ouverte !",
  // 🎯 Mots-clés ciblés GEO Le Havre + Normandie
  keywords: [
    "badminton Le Havre",
    "club badminton Le Havre",
    "SACCB",
    "badminton Sainte-Adresse",
    "Sainte-Adresse Club Compétition Badminton",
    "club badminton 76",
    "badminton Seine-Maritime",
    "badminton Normandie",
    "tournoi badminton Le Havre",
    "inscription badminton Le Havre",
    "salle Paul Vatine",
    "association badminton 76",
    "loisir et compétition badminton Le Havre",
  ],
  authors: [{ name: "SACCB - Sainte-Adresse Club de Compétition de Badminton" }],
  creator: "SACCB",
  publisher: "SACCB - Association loi 1901",
  metadataBase: new URL("https://saccb.fr"),
  alternates: {
    canonical: "https://saccb.fr",
    languages: { "fr-FR": "https://saccb.fr" },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://saccb.fr",
    siteName: "SACCB - Badminton Le Havre / Sainte-Adresse",
    title: "Badminton Le Havre / Sainte-Adresse — SACCB",
    description:
      "Le club de badminton du Havre / Sainte-Adresse. Tous niveaux, doubles conviviaux, tournois Seine-Maritime. Salle Paul Vatine.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SACCB - Club de badminton du Havre / Sainte-Adresse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Badminton Le Havre / Sainte-Adresse — SACCB",
    description: "Le club de badminton du Havre. Loisir, compétition, convivialité.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  // 🌍 Meta GEO pour le référencement local Le Havre
  other: {
    // Coordonnées approximatives Salle Paul Vatine, Sainte-Adresse (proche du Havre)
    "geo.region": "FR-NOR",
    "geo.placename": "Le Havre / Sainte-Adresse",
    "geo.position": "49.5083;0.0833",
    "ICBM": "49.5083, 0.0833",
    "DC.title": "SACCB — Badminton Le Havre / Sainte-Adresse",
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

// 🏆 JSON-LD enrichi : SportsClub + LocalBusiness pour maximiser le SEO local
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": ["SportsClub", "LocalBusiness", "SportsActivityLocation"],
    name: "SACCB — Sainte-Adresse Club de Compétition de Badminton",
    alternateName: ["SACCB", "Badminton Le Havre Sainte-Adresse", "Club de Badminton Le Havre"],
    url: "https://saccb.fr",
    logo: "https://saccb.fr/logo.png",
    image: "https://saccb.fr/og-image.png",
    description:
      "Club de badminton au Havre / Sainte-Adresse. Tous niveaux, doubles conviviaux, tournois en Seine-Maritime, créneaux adultes et étudiants. Salle Paul Vatine.",
    sport: "Badminton",
    slogan: "Smash · Passion · Convivialité",
    email: "contact@saccb.fr",
    foundingDate: "1990",
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
      { "@type": "City", name: "Le Havre" },
      { "@type": "City", name: "Sainte-Adresse" },
      { "@type": "City", name: "Octeville-sur-Mer" },
      { "@type": "City", name: "Montivilliers" },
      { "@type": "City", name: "Harfleur" },
      { "@type": "AdministrativeArea", name: "Seine-Maritime" },
      { "@type": "AdministrativeArea", name: "Normandie" },
    ],
    memberOf: [
      { "@type": "Organization", name: "Fédération Française de Badminton", url: "https://www.ffbad.org" },
      { "@type": "Organization", name: "Ligue Normandie de Badminton" },
      { "@type": "Organization", name: "Comité Départemental 76 de Badminton" },
    ],
    knowsAbout: ["Badminton", "Tournois doubles", "Compétition badminton", "Loisir badminton"],
    audience: {
      "@type": "Audience",
      audienceType: "Adultes et étudiants tous niveaux",
    },
    sameAs: ["https://saccb.fr"],
  },
];

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
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co https://www.helloasso.com; connect-src 'self' https://*.supabase.co; frame-ancestors 'self'; form-action 'self' https://www.helloasso.com; base-uri 'self'; object-src 'none';"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
