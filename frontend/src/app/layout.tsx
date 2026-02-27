import type { Metadata } from "next";
import { redHatDisplay, redHatText } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chariot -- Crosschain Collateral Lending",
  description: "Institutional-grade crosschain lending protocol on Arc. Earn dual yield on USDC or borrow against your crypto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${redHatDisplay.variable} ${redHatText.variable}`}>
      <body>{children}</body>
    </html>
  );
}
