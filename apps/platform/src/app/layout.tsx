import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { KeyboardNavProvider } from "@/context/KeyboardNavContext";
import { getSiteUrl } from "@/lib/site-url";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#05B8A5",
};

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Deku Finance | GST & Invoicing Operating System",
    template: "%s | Deku Finance",
  },
  description:
    "India's dual-mode financial operating system. Clean billing & UPI collections for growing businesses, with GST returns, ITC, and double-entry books when you are ready.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Deku Finance",
    title: "Deku Finance | GST & Invoicing Operating System",
    description:
      "Clean double-entry accounting, UPI collections, and GST preparation in one workspace.",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Deku Finance" }],
  },
  twitter: {
    card: "summary",
    title: "Deku Finance | GST & Invoicing Operating System",
    description:
      "Clean double-entry accounting, UPI collections, and GST preparation in one workspace.",
    images: ["/icon-512.png"],
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
        className="min-h-full flex flex-col bg-canvas text-ink"
      >
        <ThemeProvider>
          <AuthProvider>
            <KeyboardNavProvider>
              {children}
            </KeyboardNavProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
