import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/logo";
import { PushSettings } from "@/components/pwa/push-settings";
import { PushToggle } from "@/components/pwa/push-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Ustawienia" };

/**
 * The relevance threshold and the notification settings, behind the gear in the
 * header (Phase 11).
 *
 * They used to sit above the inbox, where the threshold and the categories were
 * one stray tap away at all times — and each tap wrote to the
 * server immediately. A page of their own for the same reason `/sources` and
 * `/about` exist: a screen visited a few times a year should not take the space
 * that the news needs every day.
 *
 * Everything here reads its state from the browser (service worker,
 * `PushManager`), so the page itself is static — no `force-dynamic`, nothing to
 * fetch on the server.
 */
export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <Link href="/" className="rounded-md focus-visible:ring-1 focus-visible:outline-none">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Wróć do skrzynki
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Ustawienia</h1>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          Ustawienia są przypisane do tego urządzenia, więc telefon i laptop mogą
          mieć różne progi i kategorie. Próg trafności filtruje skrzynkę i
          powiadomienia naraz — przy 4+ zostają wpisy 4 i 5, przy 3+ także
          trójki. Kategorie zawężają same powiadomienia; w skrzynce masz do tego
          filtr nad listą. Wyciszanie całych źródeł działa globalnie i mieszka na
          osobnej stronie{" "}
          <Link href="/sources" className="text-foreground underline underline-offset-2">
            Źródła
          </Link>
          .
        </p>
      </div>

      <PushToggle />
      <PushSettings />
    </main>
  );
}
