import { cookies } from "next/headers";

import { parseRelevance, RELEVANCE_COOKIE, type RelevanceLevel } from "@/lib/relevance";

/**
 * Per-device settings, as the server sees them.
 *
 * A cookie rather than a column keyed by device: the inbox renders on the
 * server, so the threshold has to arrive *with* the request. Read from
 * `localStorage` it would land one paint too late and the list would visibly
 * jump from one threshold to another; keyed by push subscription it would not
 * exist at all on a device that never enabled notifications.
 */
export async function readMinRelevance(): Promise<RelevanceLevel> {
  return parseRelevance((await cookies()).get(RELEVANCE_COOKIE)?.value);
}
