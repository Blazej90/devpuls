/**
 * `beforeinstallprompt` fires once, right after the page loads — before React
 * has hydrated. A listener added in `useEffect` regularly misses it, so the
 * install button never appears.
 *
 * That is why the event is caught by a script injected before hydration (see
 * `INSTALL_PROMPT_BOOTSTRAP` in the layout), stashed on `window`, and read from
 * here by the component through `useSyncExternalStore`.
 */

/** A Chrome/Edge event — not present in lib.dom.d.ts. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __devpulsInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const INSTALL_PROMPT_EVENT = "devpuls:installprompt";

/**
 * The script that runs before hydration. Kept as a string, because it has to
 * reach the document earlier than any React bundle.
 */
export const INSTALL_PROMPT_BOOTSTRAP = `
window.__devpulsInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault();
  window.__devpulsInstallPrompt = event;
  window.dispatchEvent(new Event('${INSTALL_PROMPT_EVENT}'));
});
`.trim();

export function subscribeInstallPrompt(onChange: () => void): () => void {
  window.addEventListener(INSTALL_PROMPT_EVENT, onChange);
  return () => window.removeEventListener(INSTALL_PROMPT_EVENT, onChange);
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return window.__devpulsInstallPrompt ?? null;
}

export const getServerInstallPrompt = (): BeforeInstallPromptEvent | null => null;

/** The event can only be used once — we clear the store after calling it. */
export function consumeInstallPrompt(): void {
  window.__devpulsInstallPrompt = null;
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
}
