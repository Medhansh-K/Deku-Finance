import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { KeyboardNavProvider } from "@/context/KeyboardNavContext";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#05B8A5",
};

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
        {/* Ensure the original light canvas + dark chrome Deku palette is active on initial paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.classList.remove('dark');localStorage.removeItem('deku_theme')}catch(e){}})()`,
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
