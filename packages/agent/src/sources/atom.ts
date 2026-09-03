import { XMLParser } from "fast-xml-parser";

import { fetchFeedText } from "@/sources/http.js";
import type { NormalizedItem, SourceConfig } from "@/types.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

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

interface AtomLink {
  "@_href"?: string;
  "@_rel"?: string;
}

interface AtomEntry {
  title?: unknown;
  link?: AtomLink | AtomLink[];
  updated?: unknown;
  published?: unknown;
  summary?: unknown;
  content?: unknown;
}

/** In Atom, <link> carries an href attribute, often several with different rel. */
function pickHref(link: AtomEntry["link"]): string {
  const links = toArray(link);
  const alternate = links.find((l) => l["@_rel"] === "alternate" || !l["@_rel"]);
  return (alternate ?? links[0])?.["@_href"]?.trim() ?? "";
}

export async function fetchAtom(source: SourceConfig): Promise<NormalizedItem[]> {
  const xml = await fetchFeedText(source);
  const doc = parser.parse(xml) as {
    feed?: { entry?: AtomEntry | AtomEntry[] };
  };

  const entries = toArray(doc.feed?.entry);

  return entries
    .map((entry): NormalizedItem | null => {
      const url = pickHref(entry.link);
      const title = textOf(entry.title).trim();
      if (!url || !title) return null;

      const rawDate = textOf(entry.published) || textOf(entry.updated);
      const parsedDate = rawDate ? new Date(rawDate) : null;

      return {
        sourceId: source.id,
        url,
        title,
        publishedAt:
          parsedDate && !Number.isNaN(parsedDate.valueOf())
            ? parsedDate.toISOString()
            : null,
        excerpt:
          textOf(entry.summary).trim() || textOf(entry.content).trim() || undefined,
      };
    })
    .filter((item): item is NormalizedItem => item !== null);
}
