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
    // Safari on iOS does not support display-mode and exposes its own flag.
    ("standalone" in navigator && navigator.standalone === true)
  );
}

/**
 * The platform does not change during the life of the page, but it depends on
 * browser APIs, so it is unknown on the server. `useSyncExternalStore` covers
 * exactly this case — no setState in an effect and no hydration mismatch.
 */
const noopSubscribe = () => () => {};

function getPlatform(): Platform {
  if (isStandalone()) return "standalone";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "other";
}

const getServerPlatform = (): Platform => "other";

/**
 * On iOS, Web Push works **only** once the app has been added to the home
 * screen (Safari 16.4+) — see ADR-0001. There we show instructions, because
 * Apple offers no programmatic prompt.
 *
 * On Android/desktop we use the captured `beforeinstallprompt`.
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

  // No captured event = the browser has either installed the app already or
  // does not meet the installability criteria. There is nothing to show.
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
