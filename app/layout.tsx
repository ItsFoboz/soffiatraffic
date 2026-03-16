import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TranslationProvider } from "@/components/TranslationContext";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { auth } from "@/auth";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="bg">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        <SessionProviderWrapper session={session}>
          <TranslationProvider>
            {children}
          </TranslationProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
