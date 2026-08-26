import type { SourceConfig } from "@/types.js";

const USER_AGENT = "DevPuls/0.1 (+https://github.com/Blazej90/devpuls)";

/** How many times we retry after 429/5xx before declaring the source failed. */
const MAX_ATTEMPTS = 4;

/**
 * How long a single source may spend waiting before we give up on it.
 *
 * A whole run is eleven feeds, so one feed must not be able to hold the rest
 * hostage. Reddit's window measured at 40–60s, hence a budget that covers a
 * couple of them and nothing more.
 */
const WAIT_BUDGET_MS = 90_000;

/** Assumed window when a server says "no budget left" without saying for how long. */
const BLIND_WAIT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The earliest a request to a given host may go out, as the host itself asked.
 *
 * Module-level, so it carries across the sequential fetches of one run: what
 * the first Reddit feed learns is what stops the next two from being refused.
 */
const nextSlot = new Map<string, number>();

/**
 * Seconds the server asks us to wait, from whichever header it uses.
 *
 * `Retry-After` is the standard one and comes first. Reddit does not send it
 * at all — it sends `x-ratelimit-reset` (seconds to the end of the current
 * window) — and reading only the standard header is what made every retry
 * here pointless: `Number(null)` is 0, so the code fell through to a backoff
 * of 1s and 2s against a window of about a minute.
 *
 * `Retry-After` may also hold an HTTP date rather than a number; that form
 * yields `NaN` here and we fall through to the other header or to the backoff,
 * which is the same conservative direction as not reading it at all.
 */
function askedWait(response: Response): number | null {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;

  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) return reset;

  return null;
}

/** Whether the response says this host's budget is spent — 200 or 429 alike. */
function exhausted(response: Response): boolean {
  const remaining = Number(response.headers.get("x-ratelimit-remaining"));
  return Number.isFinite(remaining) && remaining <= 0;
}

/** Never brings a slot forward: the longest wait anyone asked for wins. */
function hold(host: string, ms: number): void {
  nextSlot.set(host, Math.max(nextSlot.get(host) ?? 0, Date.now() + ms));
}

/**
 * Fetches a feed, pacing itself by what the host reports about its own limits.
 *
 * Reddit allows a single unauthenticated request per window of roughly a
 * minute per IP, and it says so on the **successful** response as well:
 * `x-ratelimit-remaining: 0`, `x-ratelimit-reset: 40`. Three Reddit feeds
 * fetched back to back therefore cost the first one nothing and the other two
 * everything — measured, the same two failed on every recorded run.
 *
 * So the pause is taken **before** the next request to that host rather than
 * being retried through afterwards. Retries stay for what the pacing cannot
 * predict: 5xx, and hosts that refuse without explaining.
 */
export async function fetchFeedText(source: SourceConfig): Promise<string> {
  const host = new URL(source.url).hostname;
  let lastStatus = 0;
  let budget = WAIT_BUDGET_MS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const pending = (nextSlot.get(host) ?? 0) - Date.now();
    if (pending > 0) {
      // Better to lose one feed than to stall the whole run behind it. Thrown
      // rather than broken out of, because breaking here would report the
      // source as "HTTP 0" — a wait we declined is not a status the server sent.
      if (pending > budget) {
        throw new Error(
          `${source.id}: ${host} rate limit — ${Math.round(pending / 1000)}s wait exceeds the budget`,
        );
      }
      budget -= pending;
      console.log(`[${source.id}] waiting ${Math.round(pending / 1000)}s for ${host}`);
      await sleep(pending);
    }

    const response = await fetch(source.url, {
      headers: {
        "user-agent": USER_AGENT,
        accept:
          "application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      },
    });

    // Read before branching on the status: a 200 that spends the last of the
    // budget is exactly the case this is here for.
    if (exhausted(response)) {
      hold(host, (askedWait(response) ?? BLIND_WAIT_MS / 1000) * 1000 + 1000);
    }

    if (response.ok) return response.text();

    lastStatus = response.status;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_ATTEMPTS) break;

    // A 429 has normally already parked the host above. What is left for the
    // backoff are the servers that say nothing at all.
    if ((nextSlot.get(host) ?? 0) <= Date.now()) {
      hold(host, 2 ** (attempt - 1) * 1000);
    }

    console.warn(
      `[${source.id}] HTTP ${response.status}, retrying (attempt ${attempt + 1}/${MAX_ATTEMPTS})`,
    );
  }

  throw new Error(`${source.id}: HTTP ${lastStatus} from ${source.url}`);
}
