import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deku Admin Console — Internal Platform Administration",
  description: "Deku Finance internal superadmin authority console and partner license verification desk.",
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

