import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistem Undangan Digital — Fakultas Teknik UNISMA",
  description:
    "Platform undangan digital multi-acara Fakultas Teknik UNISMA dengan QR scan dan rekap kehadiran.",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/pwa-icon-192",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yudisium FT",
  },
};

export const viewport = {
  themeColor: "#1B4332",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        {/* Legacy tag for iOS Safari < 17.4 standalone mode — Next.js's metadata API only emits the modern mobile-web-app-capable tag */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
