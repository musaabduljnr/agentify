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
import { headers } from "next/headers";
import { getConfig } from "@/lib/config/platform-config";
import { AlertTriangle, Info } from "lucide-react";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";

  // Check if maintenance mode is enabled
  const maintenanceMode = await getConfig("feature_flags", "enable_maintenance_mode");
  const isMaintenanceActive = maintenanceMode === "true";

  // Check if route should bypass maintenance check
  const isBypassRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks");

  const showMaintenance = isMaintenanceActive && !isBypassRoute;

  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased text-slate-900`}>
        {showMaintenance ? (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-100 font-sans px-6 relative overflow-hidden">
            {/* Glowing Gradients */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="z-10 max-w-md w-full text-center space-y-8 bg-slate-950/40 backdrop-blur-xl border border-slate-800 p-10 rounded-3xl shadow-2xl relative">
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              
              <div className="space-y-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-white font-outfit">
                  System Offline
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Agentify is currently undergoing scheduled maintenance to improve our platform services.
                </p>
              </div>
              
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-850/50 flex items-start gap-3 text-left">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Our operations team is active. Normal services will resume shortly. We apologize for any inconvenience caused.
                </p>
              </div>
              
              <div className="text-[10px] text-slate-600 font-medium tracking-widest uppercase">
                Agentify Platform Services
              </div>
            </div>
          </div>
        ) : (
          children
        )}
        <Toaster position="top-center" richColors />
        <Suspense fallback={null}>
          <NavigationLoader />
        </Suspense>
      </body>
    </html>
  );
}
