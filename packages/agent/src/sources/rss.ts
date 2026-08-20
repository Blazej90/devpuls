import { XMLParser } from "fast-xml-parser";

import { fetchFeedText } from "@/sources/http.js";
import { MAX_ITEMS_PER_SOURCE } from "@/config.js";
import type { NormalizedItem, SourceConfig } from "@/types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

/** RSS bywa niekonsekwentne — pojedynczy <item> nie jest tablicą. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) {
    return String((value as { "#text": unknown })["#text"]);
  }
  return "";
}

interface RssItem {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  description?: unknown;
}

export async function fetchRss(source: SourceConfig): Promise<NormalizedItem[]> {
  const xml = await fetchFeedText(source);
  const doc = parser.parse(xml) as {
    rss?: { channel?: { item?: RssItem | RssItem[] } };
  };

  const items = toArray(doc.rss?.channel?.item);

  return items
    .slice(0, MAX_ITEMS_PER_SOURCE)
    .map((item): NormalizedItem | null => {
      const url = textOf(item.link).trim();
      const title = textOf(item.title).trim();
      if (!url || !title) return null;

      const pubDate = textOf(item.pubDate).trim();
      const parsedDate = pubDate ? new Date(pubDate) : null;

      return {
        sourceId: source.id,
        url,
        title,
        publishedAt:
          parsedDate && !Number.isNaN(parsedDate.valueOf())
            ? parsedDate.toISOString()
            : null,
        excerpt: textOf(item.description).trim() || undefined,
      };
    })
    .filter((item): item is NormalizedItem => item !== null);
}
