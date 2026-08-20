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
 * `applicationServerKey` musi być bajtami, a klucz VAPID przychodzi jako
 * base64url. Konwersja jest wymagana przez PushManager.
 */
// Zwracany typ jest zawężony do Uint8Array<ArrayBuffer>: PushManager wymaga
// BufferSource opartego o ArrayBuffer, a goły `new Uint8Array(n)` ma szerszy
// ArrayBufferLike i nie przechodzi kontroli typów.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status =
  | "sprawdzanie"
  | "niewspierane"
  | "zablokowane"
  | "wylaczone"
  | "wlaczone"
  | "pracuje";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function PushToggle() {
  const [status, setStatus] = useState<Status>("sprawdzanie");
  const [blad, setBlad] = useState<string | null>(null);

  useEffect(() => {
    let anulowane = false;

    const sprawdz = async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!anulowane) setStatus("niewspierane");
        return;
      }

      if (Notification.permission === "denied") {
        if (!anulowane) setStatus("zablokowane");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!anulowane) setStatus(subscription ? "wlaczone" : "wylaczone");
    };

    void sprawdz();
    return () => {
      anulowane = true;
    };
  }, []);

  const wlacz = useCallback(async () => {
    setBlad(null);
    setStatus("pracuje");

    try {
      if (!VAPID_PUBLIC_KEY) {
        throw new Error("Brak NEXT_PUBLIC_VAPID_PUBLIC_KEY — patrz apps/web/.env.local");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "zablokowane" : "wylaczone");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Wymagane przez Chrome — powiadomienia zawsze widoczne dla użytkownika.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        // Nie zostawiamy subskrypcji w przeglądarce, skoro serwer jej nie zna.
        await subscription.unsubscribe();
        throw new Error(`Serwer odrzucił subskrypcję (HTTP ${response.status})`);
      }

      setStatus("wlaczone");
    } catch (error: unknown) {
      console.error("[push] włączenie nieudane", error);
      setBlad(error instanceof Error ? error.message : "Nieznany błąd");
      setStatus("wylaczone");
    }
  }, []);

  const wylacz = useCallback(async () => {
    setBlad(null);
    setStatus("pracuje");

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

      setStatus("wylaczone");
    } catch (error: unknown) {
      console.error("[push] wyłączenie nieudane", error);
      setBlad(error instanceof Error ? error.message : "Nieznany błąd");
      setStatus("wlaczone");
    }
  }, []);

  if (status === "sprawdzanie") return null;

  const opis: Record<Exclude<Status, "sprawdzanie">, string> = {
    niewspierane:
      "Ta przeglądarka nie obsługuje Web Push. Na iPhonie dodaj DevPuls do ekranu głównego.",
    zablokowane:
      "Powiadomienia są zablokowane w ustawieniach przeglądarki dla tej strony — trzeba je odblokować ręcznie.",
    wylaczone:
      "Dostaniesz powiadomienie o każdym nowym wpisie powyżej progu trafności, z linkiem do oryginału.",
    wlaczone: "Powiadomienia są włączone. Nowe wpisy przyjdą automatycznie.",
    pracuje: "Chwileczkę…",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Powiadomienia</CardTitle>
        <CardDescription>{opis[status]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "wylaczone" && (
          <Button onClick={() => void wlacz()}>
            <BellRing className="size-4" aria-hidden />
            Włącz powiadomienia
          </Button>
        )}

        {status === "wlaczone" && (
          <Button variant="secondary" onClick={() => void wylacz()}>
            <BellOff className="size-4" aria-hidden />
            Wyłącz powiadomienia
          </Button>
        )}

        {status === "pracuje" && (
          <Button disabled>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Pracuję…
          </Button>
        )}

        {blad && <p className="text-destructive text-sm">{blad}</p>}
      </CardContent>
    </Card>
  );
}
