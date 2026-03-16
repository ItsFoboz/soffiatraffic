import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TranslationProvider } from "@/components/TranslationContext";
import { AuthProvider } from "@/components/AuthContext";
import AnalyticsInit from "@/components/AnalyticsInit";

export const metadata: Metadata = {
  title: "Sofia Traffic | София Трафик",
  description: "Real-time public transport tracking for Sofia, Bulgaria",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sofia Traffic",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <TranslationProvider>
            <AnalyticsInit />
            {children}
          </TranslationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
