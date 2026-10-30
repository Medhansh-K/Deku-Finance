import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LicenseEmailToast } from "@/components/auth/LicenseEmailToast";

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
      <head>
        {/* Prevent flash of wrong theme on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('deku_theme');if(t==='dark'){document.documentElement.classList.add('dark');}else if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-white dark:bg-[#101820] text-zinc-900 dark:text-slate-100 selection:bg-[#4F7CAC]/30 selection:text-white transition-colors duration-200"
      >
        <ThemeProvider>
          <AuthProvider>
            {children}
            <LicenseEmailToast />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
