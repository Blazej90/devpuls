"use client";

import { useSyncExternalStore } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

/** How far you have to scroll for the button to make sense — about one screen. */
const THRESHOLD = 800;

function subscribe(onChange: () => void): () => void {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/**
 * Back to the top on long lists.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: scroll position
 * is state from outside React, and setting state in an effect body breaks the
 * `react-hooks` rule. The server snapshot returns `false`, so the button is
 * absent from the HTML and there is no hydration mismatch.
 *
 * Placed higher than the inbox bulk action bar (`bottom-6`) so the two never
 * overlap — on a phone that bar takes up nearly the whole width, so separating
 * them horizontally would not be enough.
 */
export function ScrollToTop() {
  const visible = useSyncExternalStore(
    subscribe,
    () => window.scrollY > THRESHOLD,
    () => false,
  );

  if (!visible) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Wróć na górę strony"
      title="Wróć na górę"
      onClick={() =>
        window.scrollTo({
          top: 0,
          // Smooth scrolling only for those who did not ask for less motion.
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        })
      }
      className="bg-background/90 fixed right-4 bottom-24 z-40 shadow-lg backdrop-blur"
    >
      <ArrowUp className="size-4" aria-hidden />
    </Button>
  );
}
