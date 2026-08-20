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

function toPayload(item: AssessedItem): PushPayload {
  return {
    title: item.title,
    body: item.assessment.summaryPl,
    url: item.url,
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
 * Wysyła powiadomienie o wpisie do tych subskrypcji, których ustawienia go
 * przepuszczają. Zwraca liczbę subskrypcji, do których udało się dostarczyć.
 */
export async function sendPush(item: AssessedItem): Promise<number> {
  // Najpierw subskrypcje, dopiero potem klucze VAPID: bez ani jednej subskrypcji
  // nie ma czego wysyłać, więc brak kluczy nie może wywracać całego przebiegu.
  const wszystkie = await listSubscriptions();
  const subscriptions = wszystkie.filter((subscription) => pasuje(item, subscription));
  if (subscriptions.length === 0) return 0;

  configure();

  const payload = JSON.stringify(toPayload(item));

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keysJson },
        payload,
      ),
    ),
  );

  let delivered = 0;

  for (const [index, result] of results.entries()) {
    const subscription = subscriptions[index];
    if (!subscription) continue;

    if (result.status === "fulfilled") {
      delivered += 1;
      continue;
    }

    const status = (result.reason as { statusCode?: number }).statusCode;

    // 404/410 = subskrypcja wygasła. Na iOS zdarza się to po dłuższej
    // nieaktywności PWA (patrz ADR-0001, sekcja Konsekwencje).
    if (status === 404 || status === 410) {
      await deleteSubscription(subscription.endpoint);
      console.warn(`[push] usunięto wygasłą subskrypcję (${status})`);
    } else {
      console.error(`[push] błąd wysyłki (${status ?? "brak kodu"})`, result.reason);
    }
  }

  return delivered;
}
