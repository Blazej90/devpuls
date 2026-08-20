import webpush from "web-push";

import { requireEnv } from "@/config.js";
import { deleteSubscription, listSubscriptions } from "@/db.js";
import type { PushSubscriptionRow } from "@/db.js";
import type { AssessedItem } from "@/types.js";

let configured = false;

function configure(): void {
  if (configured) return;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:blazejbart@gmail.com",
    requireEnv("VAPID_PUBLIC_KEY"),
    requireEnv("VAPID_PRIVATE_KEY"),
  );
  configured = true;
}

/** Payload odbierany przez service workera w `apps/web/public/sw.js`. */
interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** Adres appki — klik w powiadomienie otwiera skrzynkę, nie pojedynczy artykuł. */
const APP_URL = process.env.APP_URL ?? "https://devpuls-ecru.vercel.app/";

function odmianaWpisow(liczba: number): string {
  if (liczba === 1) return "1 nowy wpis";
  const reszta = liczba % 10;
  const dziesiatki = liczba % 100;
  const mnoga = reszta >= 2 && reszta <= 4 && (dziesiatki < 12 || dziesiatki > 14);
  return `${liczba} ${mnoga ? "nowe wpisy" : "nowych wpisów"}`;
}

/**
 * Treść digestu: liczba wpisów plus kilka najtrafniejszych tytułów, żeby dało
 * się ocenić, czy warto wchodzić, bez otwierania appki (ADR-0002).
 */
function toDigestPayload(items: AssessedItem[]): PushPayload {
  const najlepsze = [...items]
    .sort((a, b) => b.assessment.relevance - a.assessment.relevance)
    .slice(0, 3)
    .map((item) => item.title);

  const reszta = items.length - najlepsze.length;
  const ogon = reszta > 0 ? `\n…i ${reszta} więcej` : "";

  return {
    title: `DevPuls — ${odmianaWpisow(items.length)}`,
    body: najlepsze.join("\n") + ogon,
    url: APP_URL,
  };
}

/**
 * Czy ten wpis pasuje do ustawień danej subskrypcji.
 *
 * Filtr siedzi tutaj, a nie w `pipeline.ts`, bo od migracji 002 próg i
 * kategorie są zapisane **przy subskrypcji** — dwa urządzenia mogą chcieć
 * czegoś innego z tego samego przebiegu.
 */
function pasuje(item: AssessedItem, subscription: PushSubscriptionRow): boolean {
  if (item.assessment.relevance < subscription.minRelevance) return false;

  const wybrane = subscription.topics;
  // null lub pusta lista = wszystkie kategorie.
  if (!wybrane || wybrane.length === 0) return true;

  return item.assessment.topics.some((topic) => wybrane.includes(topic));
}
/**
 * Wysyła **jedno zbiorcze** powiadomienie na przebieg (ADR-0002). Wcześniej
 * `pipeline.ts` wołał wysyłkę osobno dla każdego wpisu i 44 powiadomienia
 * przychodziły jedno po drugim w odstępach kilku sekund.
 *
 * Każda subskrypcja dostaje digest złożony z wpisów, które przepuszczają
 * **jej** ustawienia — dwa urządzenia mogą zobaczyć różne liczby.
 *
 * Zwraca liczbę subskrypcji, do których udało się dostarczyć.
 */
export async function sendDigest(items: AssessedItem[]): Promise<number> {
  if (items.length === 0) return 0;

  // Najpierw subskrypcje, dopiero potem klucze VAPID: bez ani jednej subskrypcji
  // nie ma czego wysyłać, więc brak kluczy nie może wywracać całego przebiegu.
  const subscriptions = await listSubscriptions();
  if (subscriptions.length === 0) return 0;

  const doWyslania = subscriptions
    .map((subscription) => ({
      subscription,
      pasujace: items.filter((item) => pasuje(item, subscription)),
    }))
    .filter((wpis) => wpis.pasujace.length > 0);

  if (doWyslania.length === 0) return 0;

  configure();

  const results = await Promise.allSettled(
    doWyslania.map(({ subscription, pasujace }) =>
      webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keysJson },
        JSON.stringify(toDigestPayload(pasujace)),
      ),
    ),
  );

  let delivered = 0;

  for (const [index, result] of results.entries()) {
    const wpis = doWyslania[index];
    if (!wpis) continue;

    if (result.status === "fulfilled") {
      delivered += 1;
      console.log(
        `[push] digest z ${wpis.pasujace.length} wpisami → ${new URL(wpis.subscription.endpoint).hostname}`,
      );
      continue;
    }

    const status = (result.reason as { statusCode?: number }).statusCode;

    // 404/410 = subskrypcja wygasła. Na iOS zdarza się to po dłuższej
    // nieaktywności PWA (patrz ADR-0001, sekcja Konsekwencje).
    if (status === 404 || status === 410) {
      await deleteSubscription(wpis.subscription.endpoint);
      console.warn(`[push] usunięto wygasłą subskrypcję (${status})`);
    } else {
      console.error(`[push] błąd wysyłki (${status ?? "brak kodu"})`, result.reason);
    }
  }

  return delivered;
}
