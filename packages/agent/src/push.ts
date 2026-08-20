import webpush from "web-push";

import { requireEnv } from "@/config.js";
import { deleteSubscription, listSubscriptions } from "@/db.js";
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
 * Wysyła jedno powiadomienie na wpis do wszystkich zapisanych subskrypcji.
 * Zwraca liczbę subskrypcji, do których udało się dostarczyć.
 */
export async function sendPush(item: AssessedItem): Promise<number> {
  configure();

  const subscriptions = await listSubscriptions();
  if (subscriptions.length === 0) return 0;

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
