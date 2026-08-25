import type { SourceConfig } from "@/types.js";

const USER_AGENT = "DevPuls/0.1 (+https://github.com/Blazej90/devpuls)";

/** How many times we retry after 429/5xx before declaring the source failed. */
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a feed, retrying on 429 and 5xx. Reddit can bounce several parallel
 * requests, and `Promise.allSettled` in the pipeline hits every source at once
 * — without a retry we lose them for the whole run.
 *
 * We honour the Retry-After header when present; otherwise a 1s, 2s, 4s backoff.
 */
export async function fetchFeedText(source: SourceConfig): Promise<string> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(source.url, {
      headers: { "user-agent": USER_AGENT, accept: "application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8" },
    });

    if (response.ok) return response.text();

    lastStatus = response.status;
    const retryable = response.status === 429 || response.status >= 500;

    if (!retryable || attempt === MAX_ATTEMPTS) break;

    const retryAfter = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2 ** (attempt - 1) * 1000;

    console.warn(
      `[${source.id}] HTTP ${response.status}, retrying in ${delayMs}ms ` +
        `(attempt ${attempt + 1}/${MAX_ATTEMPTS})`,
    );
    await sleep(delayMs);
  }

  throw new Error(`${source.id}: HTTP ${lastStatus} from ${source.url}`);
}
