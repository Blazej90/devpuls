import webpush from "web-push";

import { requireEnv } from "@/config.js";
import { deleteSubscription, listSubscriptions } from "@/db.js";
import type { PushSubscriptionRow } from "@/db.js";
import { noteError } from "@/monitor.js";
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

/** The payload received by the service worker in `apps/web/public/sw.js`. */
interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** The app address — clicking a notification opens the inbox, not one article. */
const APP_URL = process.env.APP_URL ?? "https://devpuls-ecru.vercel.app/";

/** "1 nowy wpis", "2 nowe wpisy", "11 nowych wpisów" — Polish plural inflection. */
function formatItemCount(count: number): string {
  if (count === 1) return "1 nowy wpis";
  const units = count % 10;
  const teens = count % 100;
  const fewForm = units >= 2 && units <= 4 && (teens < 12 || teens > 14);
  return `${count} ${fewForm ? "nowe wpisy" : "nowych wpisów"}`;
}

/**
 * The digest body: the number of items plus a few of the most relevant titles,
 * so it is possible to judge whether it is worth going in without opening the
 * app (ADR-0002).
 */
function toDigestPayload(items: AssessedItem[]): PushPayload {
  const top = [...items]
    .sort((a, b) => b.assessment.relevance - a.assessment.relevance)
    .slice(0, 3)
    .map((item) => item.title);

  const rest = items.length - top.length;
  const tail = rest > 0 ? `\n…i ${rest} więcej` : "";

  return {
    title: `DevPuls — ${formatItemCount(items.length)}`,
    body: top.join("\n") + tail,
    url: APP_URL,
  };
}

/**
 * Whether this item matches the settings of a given subscription.
 *
 * The filter lives here rather than in `pipeline.ts` because since migration
 * 002 the threshold and the categories are stored **with the subscription** —
 * two devices may want different things out of the same run.
 */
function matches(item: AssessedItem, subscription: PushSubscriptionRow): boolean {
  if (item.assessment.relevance < subscription.minRelevance) return false;

  const selected = subscription.topics;
  // null or an empty list = all categories.
  if (!selected || selected.length === 0) return true;

  return item.assessment.topics.some((topic) => selected.includes(topic));
}

/**
 * Sends **one combined** notification per run (ADR-0002). Previously
 * `pipeline.ts` called the send separately for every item and 44 notifications
 * arrived one after another, seconds apart.
 *
 * Each subscription gets a digest built from the items that pass **its** own
 * settings — two devices may see different counts.
 *
 * Returns the number of subscriptions that were delivered to.
 */
export async function sendDigest(items: AssessedItem[]): Promise<number> {
  if (items.length === 0) return 0;

  // Subscriptions first, VAPID keys only afterwards: without a single
  // subscription there is nothing to send, so missing keys must not bring down
  // the whole run.
  const subscriptions = await listSubscriptions();
  if (subscriptions.length === 0) return 0;

  const targets = subscriptions
    .map((subscription) => ({
      subscription,
      matching: items.filter((item) => matches(item, subscription)),
    }))
    .filter((target) => target.matching.length > 0);

  if (targets.length === 0) return 0;

  configure();

  const results = await Promise.allSettled(
    targets.map(({ subscription, matching }) =>
      webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keysJson },
        JSON.stringify(toDigestPayload(matching)),
      ),
    ),
  );

  let delivered = 0;

  for (const [index, result] of results.entries()) {
    const target = targets[index];
    if (!target) continue;

    if (result.status === "fulfilled") {
      delivered += 1;
      console.log(
        `[push] digest with ${target.matching.length} items → ${new URL(target.subscription.endpoint).hostname}`,
      );
      continue;
    }

    const status = (result.reason as { statusCode?: number }).statusCode;

    // 404/410 = the subscription has expired. On iOS this happens after a
    // longer period of PWA inactivity (see ADR-0001, Consequences).
    if (status === 404 || status === 410) {
      await deleteSubscription(target.subscription.endpoint);
      console.warn(`[push] removed an expired subscription (${status})`);
    } else {
      console.error(`[push] delivery error (${status ?? "no code"})`, result.reason);
      noteError(
        "push",
        new URL(target.subscription.endpoint).hostname,
        `HTTP ${status ?? "no code"}`,
      );
    }
  }

  return delivered;
}
