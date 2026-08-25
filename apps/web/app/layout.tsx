import type { Metadata, Viewport } from "next";

import Script from "next/script";

import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { INSTALL_PROMPT_BOOTSTRAP } from "@/components/pwa/install-prompt-store";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "DevPuls",
    template: "%s — DevPuls",
  },
  description:
    "Nowinki z TypeScript, Reacta, JS, fullstacku i AI — przefiltrowane pod kątem trafności i streszczone po polsku.",
  applicationName: "DevPuls",
  manifest: "/manifest.json",
  // Both entries explicitly: declaring `icons` disables the Next.js file
  // convention, so `app/icon.svg` alone is not enough — verified, the favicon
  // link then never reaches <head> at all.
  //
  // SVG for the browser (one file, every size), PNG for Safari:
  // `apple-touch-icon` **does not accept SVG**, and iOS is the platform where
  // the app is actually installed.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  // Required for iOS to treat a page added to the home screen as an app —
  // without it Web Push does not work on Safari (ADR-0001).
  appleWebApp: {
    capable: true,
    title: "DevPuls",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // The browser chrome follows the system preference. This is not the same as
  // `theme_color` in the manifest, which paints the splash screen **before** the
  // page loads and, being static JSON, cannot react to the theme — see the
  // comment there.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  // An app on the home screen should reach under the notch.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {/* Before hydration — otherwise we miss beforeinstallprompt. */}
        <Script id="devpuls-install-prompt" strategy="beforeInteractive">
          {INSTALL_PROMPT_BOOTSTRAP}
        </Script>
        <ThemeProvider>
          {children}
          {/* Toasts carry the undo action after deleting an item (ADR-0003), so
              they have to sit inside the provider — sonner reads the theme from it. */}
          <Toaster position="bottom-center" />
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
