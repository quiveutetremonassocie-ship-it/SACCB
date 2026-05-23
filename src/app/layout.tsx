import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SACCB — Club de Badminton de Sainte-Adresse",
  description:
    "SACCB : le club de badminton de Sainte-Adresse (Le Havre). Inscriptions, tournois doubles, créneaux adultes et étudiants. Rejoignez le club !",
  keywords: [
    "SACCB",
    "badminton Sainte-Adresse",
    "club badminton Le Havre",
    "badminton 76",
    "Sainte-Adresse Club Compétition Badminton",
    "tournoi badminton Seine-Maritime",
    "inscription badminton",
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
    title: "SACCB — Club de Badminton de Sainte-Adresse",
    description:
      "SACCB : le club de badminton de Sainte-Adresse (Le Havre). Inscriptions, tournois, créneaux adultes et étudiants.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SACCB Badminton" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SACCB — Club de Badminton de Sainte-Adresse",
    description: "Le club de badminton de Sainte-Adresse. Inscriptions, tournois, esprit convivial.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
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

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsClub",
  name: "SACCB — Sainte-Adresse Club de Compétition de Badminton",
  alternateName: "SACCB",
  url: "https://saccb.fr",
  description: "Club de badminton de Sainte-Adresse (Le Havre) — inscriptions, tournois, créneaux adultes et étudiants.",
  sport: "Badminton",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Sainte-Adresse",
    addressRegion: "Normandie",
    postalCode: "76310",
    addressCountry: "FR",
  },
  sameAs: ["https://saccb.fr"],
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
