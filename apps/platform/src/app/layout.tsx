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
  applicationName: "Deku Finance",
  category: "Finance & Accounting Software",
  title: {
    default: "Deku Finance | GST, Invoicing & Double-Entry Accounting for Indian Businesses",
    template: "%s | Deku Finance",
  },
  description:
    "India's dual-mode GST and financial operating system. Start with clean bills of supply and UPI QR collections, then enable GST invoices, GSTR-1/GSTR-3B offline JSON, maker-checker approvals, and double-entry books on the same ledger.",
  keywords: [
    "Deku Finance",
    "GST accounting software India",
    "double entry accounting India",
    "GSTR-1 GSTR-3B software",
    "UPI QR invoicing India",
    "Tally alternative web",
    "maker checker accounting",
    "ALERX chart of accounts",
    "small business billing software India",
  ],
  alternates: {
    canonical: "./",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "Deku Finance",
    title: "Deku Finance | GST, Invoicing & Double-Entry Books for India",
    description:
      "Clean double-entry accounting, dynamic UPI QR billing, maker-checker approvals, and GSTR-1/3B preparation in one keyboard-first workspace.",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Deku Finance" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deku Finance | GST, Invoicing & Double-Entry Books",
    description:
      "Clean double-entry accounting, UPI collections, and GST return preparation in one workspace for Indian businesses.",
    images: ["/icon-512.png"],
  },
};

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Deku Finance",
      url: siteUrl,
      logo: `${siteUrl}/icon-512.png`,
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+91-75064-61004",
        contactType: "sales",
        areaServed: "IN",
        availableLanguage: ["English", "Hindi"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Deku Finance",
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-IN",
    },
  ],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
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
