"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js`. Renders nothing — it hangs in the layout so the worker
 * stays active regardless of the subpage.
 *
 * Registration waits for `load` so it does not compete for bandwidth with the
 * first render.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("[pwa] service worker registration failed", error);
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
