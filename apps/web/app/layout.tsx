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
  // Oba wpisy jawnie: zadeklarowanie `icons` wyłącza konwencję plikową Next.js,
  // więc samo `app/icon.svg` nie wystarczy — sprawdzone, link do faviconu
  // wtedy w ogóle nie trafia do <head>.
  //
  // SVG dla przeglądarki (jeden plik, każdy rozmiar), PNG dla Safari:
  // `apple-touch-icon` **nie przyjmuje SVG**, a iOS to platforma, na której
  // appka jest faktycznie zainstalowana.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
  // Wymagane, żeby iOS traktował stronę dodaną do ekranu głównego jak appkę
  // — bez tego Web Push na Safari nie zadziała (ADR-0001).
  appleWebApp: {
    capable: true,
    title: "DevPuls",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  // Pasek przeglądarki podąża za preferencją systemu. To nie to samo co
  // `theme_color` w manifeście, który maluje splash **przed** wczytaniem strony
  // i jako statyczny JSON nie umie reagować na motyw — patrz komentarz tam.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  // Appka na ekranie głównym ma sięgać pod notch.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {/* Przed hydratacją — inaczej przegapimy beforeinstallprompt. */}
        <Script id="devpuls-install-prompt" strategy="beforeInteractive">
          {INSTALL_PROMPT_BOOTSTRAP}
        </Script>
        <ThemeProvider>
          {children}
          {/* Toasty niosą akcję "Cofnij" po usunięciu wpisu (ADR-0003),
              więc muszą siedzieć wewnątrz providera — sonner czyta z niego motyw. */}
          <Toaster position="bottom-center" />
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
