"use client";

import { useEffect } from "react";

/**
 * Rejestruje `/sw.js`. Nic nie renderuje — wisi w layoucie, żeby worker
 * był aktywny niezależnie od podstrony.
 *
 * Rejestrujemy dopiero po `load`, żeby nie konkurować o pasmo z pierwszym
 * renderem.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("[pwa] rejestracja service workera nieudana", error);
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
