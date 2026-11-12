import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SoftWEIGHT Online",
  description: "Consultation en ligne des pesées SoftWEIGHT — KENJITECH",
  icons: { icon: "/softweight.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
