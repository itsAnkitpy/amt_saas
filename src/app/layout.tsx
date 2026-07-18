import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "@/lib/env"; // Validate environment variables at boot
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "Track, assign, and maintain every asset with QR-code labels, scheduled maintenance, and a live dashboard. Built for teams that have outgrown spreadsheets.";

export const metadata: Metadata = {
  metadataBase: new URL("https://assetlanehq.com"),
  title: "AssetLane — QR-Code Asset Management",
  description: siteDescription,
  // Icons live in public/ and are declared here instead of using the
  // app/icon.svg file convention, which crashes Turbopack in Next 16.1.0.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "AssetLane — QR-Code Asset Management",
    description: siteDescription,
    url: "https://assetlanehq.com",
    siteName: "AssetLane",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "AssetLane dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AssetLane — QR-Code Asset Management",
    description: siteDescription,
    images: ["/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
