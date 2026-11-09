import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deku Distributor Portal — Territory Operations & Client Onboarding",
  description: "Deku Finance regional franchise partner workspace, seat allocations, and commercial license requests.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-brand/30 selection:text-ink">{children}</body>
    </html>
  );
}

