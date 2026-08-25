"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * `applicationServerKey` has to be bytes, while the VAPID key arrives as
 * base64url. PushManager requires the conversion.
 */
// The return type is narrowed to Uint8Array<ArrayBuffer>: PushManager needs a
// BufferSource backed by an ArrayBuffer, and a bare `new Uint8Array(n)` has the
// wider ArrayBufferLike and fails type checking.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "checking" | "unsupported" | "blocked" | "off" | "on" | "working";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function PushToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("blocked");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!cancelled) setStatus(subscription ? "on" : "off");
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setStatus("working");

    try {
      if (!VAPID_PUBLIC_KEY) {
        throw new Error("Brak NEXT_PUBLIC_VAPID_PUBLIC_KEY — patrz apps/web/.env.local");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required by Chrome — notifications must always be visible to the user.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        // We do not leave a subscription in the browser the server knows nothing about.
        await subscription.unsubscribe();
        throw new Error(`Serwer odrzucił subskrypcję (HTTP ${response.status})`);
      }

      setStatus("on");
    } catch (cause: unknown) {
      console.error("[push] enabling failed", cause);
      setError(cause instanceof Error ? cause.message : "Nieznany błąd");
      setStatus("off");
    }
  }, []);

  const disable = useCallback(async () => {
    setError(null);
    setStatus("working");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      setStatus("off");
    } catch (cause: unknown) {
      console.error("[push] disabling failed", cause);
      setError(cause instanceof Error ? cause.message : "Nieznany błąd");
      setStatus("on");
    }
  }, []);

  if (status === "checking") return null;

  const descriptions: Record<Exclude<Status, "checking">, string> = {
    unsupported:
      "Ta przeglądarka nie obsługuje Web Push. Na iPhonie dodaj DevPuls do ekranu głównego.",
    blocked:
      "Powiadomienia są zablokowane w ustawieniach przeglądarki dla tej strony — trzeba je odblokować ręcznie.",
    off: "Dostaniesz powiadomienie o każdym nowym wpisie powyżej progu trafności, z linkiem do oryginału.",
    on: "Powiadomienia są włączone. Nowe wpisy przyjdą automatycznie.",
    working: "Chwileczkę…",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Powiadomienia</CardTitle>
        <CardDescription>{descriptions[status]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "off" && (
          <Button onClick={() => void enable()}>
            <BellRing className="size-4" aria-hidden />
            Włącz powiadomienia
          </Button>
        )}

        {status === "on" && (
          <Button variant="secondary" onClick={() => void disable()}>
            <BellOff className="size-4" aria-hidden />
            Wyłącz powiadomienia
          </Button>
        )}

        {status === "working" && (
          <Button disabled>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Pracuję…
          </Button>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
