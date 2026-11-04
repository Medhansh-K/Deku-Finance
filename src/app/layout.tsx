import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { KeyboardNavProvider } from "@/context/KeyboardNavContext";

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
      className="h-full antialiased font-sans"
    >
      <head>
        {/* Applies the stored or system theme before first paint, so dark mode never flashes light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('deku_theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-surface text-ink selection:bg-amber-400/30 selection:text-amber-900"
      >
        <ThemeProvider>
          <AuthProvider>
            <KeyboardNavProvider>
              {children}
            </KeyboardNavProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
