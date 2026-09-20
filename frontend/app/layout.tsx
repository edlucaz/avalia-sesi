import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avalia SESI — Simulados",
  description: "Plataforma de simulados do Avalia SESI (CE 303).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
