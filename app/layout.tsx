import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://agentify.app"),
  title: {
    default: "Agentify | AI Business Assistant for Sales and Support",
    template: "%s | Agentify",
  },
  description:
    "Agentify helps businesses launch an AI assistant trained on their website, capture leads, support customers, and share hosted chat links in minutes.",
  applicationName: "Agentify",
  keywords: [
    "Agentify",
    "AI business assistant",
    "AI sales assistant",
    "AI customer support",
    "website chatbot",
    "hosted chat",
    "lead capture",
  ],
  authors: [{ name: "Agentify" }],
  creator: "Agentify",
  publisher: "Agentify",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Agentify",
    title: "Agentify | AI Business Assistant for Sales and Support",
    description:
      "Launch a trained AI business assistant for customer support, lead capture, hosted chat, and website widgets.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Agentify AI business assistant dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentify | AI Business Assistant",
    description:
      "Train and launch an AI business assistant for support, sales, hosted chat, and lead capture.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  colorScheme: "light",
};

import { Suspense } from "react";
import { Toaster } from "sonner";
import { NavigationLoader } from "@/components/ui/navigation-loader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased text-slate-900`}>
        {children}
        <Toaster position="top-center" richColors />
        <Suspense fallback={null}>
          <NavigationLoader />
        </Suspense>
      </body>
    </html>
  );
}
