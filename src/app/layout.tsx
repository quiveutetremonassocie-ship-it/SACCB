import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SACCB — Club de Badminton de Sainte-Adresse",
  description:
    "Le club de badminton de Sainte-Adresse. Adhésions, tournois, et esprit convivial pour tous les niveaux.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  );
}
