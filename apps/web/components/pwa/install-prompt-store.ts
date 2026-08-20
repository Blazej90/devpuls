/**
 * `beforeinstallprompt` leci raz, zaraz po załadowaniu strony — zanim React
 * zdąży się zhydratować. Listener dodany w `useEffect` regularnie go przegapia,
 * przez co przycisk instalacji nigdy się nie pojawia.
 *
 * Dlatego zdarzenie łapie skrypt wstrzykiwany przed hydratacją (patrz
 * `INSTALL_PROMPT_BOOTSTRAP` w layoucie), odkłada je na `window`, a komponent
 * czyta stąd przez `useSyncExternalStore`.
 */

/** Zdarzenie Chrome/Edge — nie ma go w lib.dom.d.ts. */
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
 * Skrypt uruchamiany przed hydratacją. Trzymany jako string, bo musi trafić
 * do dokumentu wcześniej niż jakikolwiek bundle Reacta.
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

/** Zdarzenia można użyć tylko raz — po wywołaniu czyścimy magazyn. */
export function consumeInstallPrompt(): void {
  window.__devpulsInstallPrompt = null;
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
}
