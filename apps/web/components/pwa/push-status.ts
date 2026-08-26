"use client";

import { useEffect, useState } from "react";

/**
 * Whether this device can receive pushes, and whether it currently does.
 *
 * Extracted from `push-toggle.tsx` once the settings moved to `/settings`
 * (Phase 11): the inbox now shows a one-line invitation whenever notifications
 * are off, and two components deciding "is this device subscribed" from two
 * copies of the same code would sooner or later disagree.
 */
export type PushStatus =
  | "checking"
  | "unsupported"
  | "blocked"
  | "off"
  | "on"
  | "working";

/**
 * Reads the state once on mount. The setter is part of the contract, because
 * the toggle changes the state itself — subscribing and unsubscribing are the
 * only things that move it, and both happen in the same click that has to
 * render the result.
 */
export function usePushStatus(): [PushStatus, (status: PushStatus) => void] {
  const [status, setStatus] = useState<PushStatus>("checking");

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

      // A blocked permission cannot be undone from here — only in the browser's
      // own settings — so it is a state of its own, not a variant of "off".
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

  return [status, setStatus];
}
