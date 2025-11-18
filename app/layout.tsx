import type { Metadata } from "next";
import { Geist_Sans, Geist_Mono } from "geist/font";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infinity Crypto AI Trading",
  description: "AI Trading System by Infinity Crypto",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${Geist_Sans.variable} ${Geist_Mono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
