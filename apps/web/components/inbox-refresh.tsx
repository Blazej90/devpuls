"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setBadge } from "@/lib/badge";
import { cn } from "@/lib/utils";

/** "1 nowy wpis", "3 nowe wpisy", "5 nowych wpisów" — Polish plural inflection. */
function formatAdded(count: number): string {
  if (count === 1) return "1 nowy wpis";
  const units = count % 10;
  const teens = count % 100;
  const fewForm = units >= 2 && units <= 4 && (teens < 12 || teens > 14);
  return `${count} ${fewForm ? "nowe wpisy" : "nowych wpisów"}`;
}

/**
 * The refresh itself, shared by the button and the gesture (Phase 11).
 *
 * Refreshing means re-reading the database — it does **not** run the agent.
 * Items only appear when the agent runs (every 2 days, ADR-0002) and every run
 * costs a Claude call per item, so a gesture one can trigger by accident must
 * not be able to spend money. That is exactly why the "nothing new" message
 * matters: without it the gesture would look broken every time it worked
 * correctly.
 *
 * `latestId` is the newest item id the server rendered. After `router.refresh()`
 * the prop arrives updated, so the next pull compares against the new state
 * without anything having to be remembered on the client.
 */
function useRefresh(latestId: number) {
  const router = useRouter();
  const [reading, setReading] = useState(false);
  const [rendering, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setReading(true);
    try {
      const response = await fetch(`/api/items/updates?since=${latestId}`);
      if (!response.ok) throw new Error(`Read failed (HTTP ${response.status})`);

      const { added, unread } = (await response.json()) as {
        added: number;
        unread: number;
      };
      setBadge(unread);
      startTransition(() => router.refresh());

      if (added > 0) {
        toast(formatAdded(added), {
          description: "Skrzynka jest już aktualna.",
          // The new items can easily be outside the current view — another tab,
          // a category, page four. Without a way to the top of the full list
          // the number would describe something the list does not show.
          action: { label: "Pokaż", onClick: () => router.push("/") },
        });
        return;
      }

      toast("Brak nowych wpisów", {
        description: "Agent sprawdza źródła co 2 dni.",
      });
    } catch (cause: unknown) {
      console.error("[inbox] refresh failed", cause);
      toast.error("Nie udało się odświeżyć skrzynki.");
    } finally {
      setReading(false);
    }
  }, [latestId, router]);

  // The re-render counts as part of the refresh: the spinner has to keep
  // spinning until the new list is actually on screen, not until the fetch
  // returns.
  return { refresh, busy: reading || rendering };
}

/**
 * The manual refresh, next to the line saying when the agent last ran.
 *
 * It sits there rather than in the header because that sentence is the reason
 * to press it — and because on a desktop, where the gesture does not exist,
 * this is the only way in.
 */
export function RefreshButton({ latestId }: { latestId: number }) {
  const { refresh, busy } = useRefresh(latestId);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={() => void refresh()}
      aria-label="Odśwież skrzynkę"
      className="text-muted-foreground hover:text-foreground -my-1 shrink-0"
    >
      <RefreshCw className={cn("size-4", busy && "animate-spin")} aria-hidden />
      <span className="hidden sm:inline">Odśwież</span>
    </Button>
  );
}

/** How far the finger has to travel before releasing actually refreshes. */
const THRESHOLD = 64;
/** Where the spinner parks while the refresh runs. */
const RESTING = 48;
/** Past this the indicator stops following the finger. */
const MAX = 96;
/** The indicator covers half the finger's travel, so the pull feels resisted. */
const FRICTION = 0.5;

/**
 * Pull-to-refresh (Phase 11).
 *
 * Only from the very top of the page — the hero view. Further down a downward
 * swipe means "scroll back up", and taking that over would make the page feel
 * stuck. Written by hand rather than pulled from a library: the whole gesture
 * is three touch handlers, and the alternative was a dependency that brings its
 * own spinner, its own theme and its own opinion about the scroll container.
 *
 * The counterpart of this component is `overscroll-behavior-y: contain` in
 * `globals.css`. Without it Chrome on Android runs its own pull-to-refresh at
 * the same time and the page reloads from scratch underneath ours.
 */
export function PullToRefresh({ latestId }: { latestId: number }) {
  const { refresh, busy } = useRefresh(latestId);
  const [phase, setPhase] = useState<"idle" | "pull" | "ready">("idle");

  const indicator = useRef<HTMLDivElement>(null);
  /** Where the gesture started; `null` = no gesture of ours in progress. */
  const start = useRef<{ x: number; y: number } | null>(null);
  const distance = useRef(0);

  // The touch handlers are registered once, for the lifetime of the component,
  // so they cannot be re-attached in the middle of a gesture. Everything they
  // need that changes over time therefore reaches them through a ref rather
  // than through the closure.
  const run = useRef(refresh);
  const working = useRef(busy);
  useEffect(() => {
    run.current = refresh;
    working.current = busy;
  }, [refresh, busy]);

  useEffect(() => {
    /** The indicator is moved by writing to the DOM: React state per touch
     *  frame would mean a re-render for every pixel of the pull. */
    function move(px: number, animate = false, opacity = Math.min(1, px / THRESHOLD)) {
      distance.current = px;
      const node = indicator.current;
      if (node === null) return;

      node.style.transition = animate
        ? "transform 200ms ease-out, opacity 200ms ease-out"
        : "none";
      node.style.transform = `translateY(${px}px)`;
      node.style.opacity = String(opacity);
    }

    function cancel() {
      start.current = null;
      setPhase("idle");
      if (distance.current > 0) move(0, true);
    }

    function onStart(event: TouchEvent) {
      if (working.current || window.scrollY > 0 || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      if (touch) start.current = { x: touch.clientX, y: touch.clientY };
    }

    function onMove(event: TouchEvent) {
      const origin = start.current;
      const touch = event.touches[0];
      if (origin === null || touch === undefined) return;

      const dy = touch.clientY - origin.y;
      const dx = touch.clientX - origin.x;

      // Upwards, sideways (the tab strip scrolls horizontally) or no longer at
      // the top — then the gesture belongs to the page, not to us.
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
        cancel();
        return;
      }

      // Stops the browser from bouncing the page and running its own
      // pull-to-refresh alongside this one.
      if (event.cancelable) event.preventDefault();

      const pulled = Math.min(MAX, dy * FRICTION);
      move(pulled);
      setPhase(pulled >= THRESHOLD ? "ready" : "pull");
    }

    async function onEnd() {
      if (start.current === null) return;
      start.current = null;

      // Too short a pull retracts without doing anything — that is what makes
      // the gesture cancellable once started.
      if (distance.current < THRESHOLD) {
        cancel();
        return;
      }

      setPhase("idle");
      // Fully opaque while parked: the opacity ramp belongs to the pull, and
      // half-transparent is not what a spinner doing actual work should look
      // like.
      move(RESTING, true, 1);
      await run.current();
      move(0, true);
    }

    // `touchmove` cannot be passive, because it is the one that calls
    // `preventDefault`. The other two stay passive — they only read.
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", cancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", cancel);
    };
  }, []);

  return (
    // `aria-hidden`, because the result is announced by the toast — a spinner
    // read out mid-gesture would only get in the way. The desktop path to the
    // same action is the button above.
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[env(safe-area-inset-top)]"
    >
      <div
        ref={indicator}
        style={{ transform: "translateY(0px)", opacity: 0 }}
        className="bg-card border-border -mt-12 flex size-10 items-center justify-center rounded-full border shadow-sm"
      >
        <RefreshCw
          className={cn(
            "text-brand size-5",
            // The flip announces "let go now". It has to stay clear of
            // `animate-spin`, which drives `transform` itself — a transition
            // running against a keyframe animation stutters.
            busy ? "animate-spin" : "transition-transform duration-200",
            !busy && phase === "ready" && "rotate-180",
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}
