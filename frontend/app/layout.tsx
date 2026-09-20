import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Avalia SESI — Simulados",
  description: "Plataforma de simulados do Avalia SESI (CE 303) — Escola SESI Araras.",
};

export const viewport: Viewport = {
  themeColor: "#e30513",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={sourceSans.variable}>
      <body>
        <div className="barra-topo" />
        {children}
      </body>
    </html>
  );
}
