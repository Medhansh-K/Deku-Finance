import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import LicenseEmailToast from "@/components/auth/LicenseEmailToast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deku Finance | GST & Invoicing Operating System",
  description:
    "India's first dual-mode financial operating system. Pure accounting (Section 22 CGST Exempt) & enterprise GST compliance with ALERX double-entry ledger.",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-white text-zinc-900 selection:bg-amber-400/30 selection:text-amber-900"
      >
        <AuthProvider>
          {children}
          <LicenseEmailToast />
        </AuthProvider>
      </body>
    </html>
  );
}
