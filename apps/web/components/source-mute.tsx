"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setBadge } from "@/lib/badge";

/**
 * Muting a source, and undoing it (migration 008).
 *
 * The same button in two places: next to the active source filter in the inbox,
 * where the thought "I have had enough of these" actually happens, and in the
 * list on `/sources`, which is the only way back — a muted source has no cards
 * left in the inbox to click on.
 *
 * There is no optimistic state here. Every other write in the app hides one
 * card; this one changes what the whole inbox contains, and drawing that
 * ahead of the server would mean guessing counts we do not have. The button
 * goes into a pending state instead and the page re-renders from the database.
 */
export function MuteButton({
  id,
  name,
  muted,
  variant = "ghost",
}: {
  id: string;
  name: string;
  muted: boolean;
  variant?: "ghost" | "outline";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();

  async function apply(next: boolean, announce = true) {
    setSaving(true);
    try {
      const response = await fetch("/api/sources/mute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, muted: next }),
      });
      if (!response.ok) throw new Error(`Write failed (HTTP ${response.status})`);

      const { unread } = (await response.json()) as { unread: number };
      setBadge(unread);
      startTransition(() => router.refresh());

      if (announce) {
        toast(next ? `Wyciszono: ${name}` : `Przywrócono: ${name}`, {
          description: next
            ? "Wpisy zniknęły ze skrzynki, agent przestaje je pobierać."
            : "Wpisy wróciły na miejsce.",
          // Undo does not announce itself again — two toasts for one decision
          // read like something went wrong.
          action: { label: "Cofnij", onClick: () => void apply(!next, false) },
        });
      }
    } catch (cause: unknown) {
      console.error("[sources] mute failed", cause);
      toast.error("Nie udało się zmienić stanu źródła.");
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || refreshing;

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={busy}
      aria-label={muted ? `Przywróć źródło: ${name}` : `Wycisz źródło: ${name}`}
      onClick={() => void apply(!muted)}
      className={muted ? undefined : "text-muted-foreground hover:text-foreground"}
    >
      {muted ? (
        <Bell className="size-4" aria-hidden />
      ) : (
        <BellOff className="size-4" aria-hidden />
      )}
      {muted ? "Przywróć" : "Wycisz"}
    </Button>
  );
}
