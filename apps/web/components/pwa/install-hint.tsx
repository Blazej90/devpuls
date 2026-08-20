"use client";

import { useSyncExternalStore } from "react";
import { Share, SquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  consumeInstallPrompt,
  getInstallPrompt,
  getServerInstallPrompt,
  subscribeInstallPrompt,
} from "@/components/pwa/install-prompt-store";

type Platform = "standalone" | "ios" | "other";

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari na iOS nie wspiera display-mode i wystawia własną flagę.
    ("standalone" in navigator && navigator.standalone === true)
  );
}

/**
 * Platforma nie zmienia się w trakcie życia strony, ale zależy od API
 * przeglądarki, więc na serwerze jej nie znamy. `useSyncExternalStore`
 * obsługuje dokładnie ten przypadek — bez setState w efekcie i bez
 * niezgodności przy hydratacji.
 */
const noopSubscribe = () => () => {};

function getPlatform(): Platform {
  if (isStandalone()) return "standalone";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "other";
}

const getServerPlatform = (): Platform => "other";

/**
 * Na iOS powiadomienia Web Push działają **wyłącznie** po dodaniu appki do
 * ekranu głównego (Safari 16.4+) — patrz ADR-0001. Tam pokazujemy instrukcję,
 * bo Apple nie daje żadnego programowego promptu.
 *
 * Na Androidzie/desktopie korzystamy z przechwyconego `beforeinstallprompt`.
 */
export function InstallHint() {
  const platform = useSyncExternalStore(noopSubscribe, getPlatform, getServerPlatform);
  const deferred = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPrompt,
    getServerInstallPrompt,
  );

  if (platform === "standalone") return null;

  if (platform === "ios") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dodaj DevPuls do ekranu głównego</CardTitle>
          <CardDescription>
            Na iPhonie powiadomienia działają dopiero po zainstalowaniu appki —
            Safari nie wysyła ich ze zwykłej karty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="text-muted-foreground space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Share className="size-4 shrink-0" aria-hidden />
              Stuknij ikonę Udostępnij na dolnym pasku Safari
            </li>
            <li className="flex items-center gap-2">
              <SquarePlus className="size-4 shrink-0" aria-hidden />
              Wybierz „Do ekranu początkowego”
            </li>
            <li className="flex items-center gap-2">
              <span className="size-4 shrink-0" aria-hidden />
              Otwórz DevPuls z ekranu głównego i włącz powiadomienia
            </li>
          </ol>
        </CardContent>
      </Card>
    );
  }

  // Brak przechwyconego zdarzenia = przeglądarka albo już zainstalowała appkę,
  // albo nie spełnia kryteriów instalowalności. Nie ma czego pokazywać.
  if (!deferred) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zainstaluj DevPuls</CardTitle>
        <CardDescription>
          Jako zainstalowana appka dostajesz powiadomienia nawet przy zamkniętej
          przeglądarce.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={() => {
            void deferred.prompt();
            consumeInstallPrompt();
          }}
        >
          Zainstaluj
        </Button>
      </CardContent>
    </Card>
  );
}
