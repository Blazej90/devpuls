import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "DevPuls",
    template: "%s — DevPuls",
  },
  description:
    "Nowinki z TypeScript, Reacta, JS, fullstacku i AI — przefiltrowane pod kątem trafności i streszczone po polsku.",
  applicationName: "DevPuls",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
