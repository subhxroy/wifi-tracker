import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Sentira — Caregiver Dashboard",
  description: "Camera-free elder monitoring. Supplemental alert layer, not a medical device.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-canvas text-text antialiased scrollbar-thin">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
