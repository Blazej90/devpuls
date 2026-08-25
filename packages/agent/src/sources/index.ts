import { fetchAtom } from "@/sources/atom.js";
import { fetchRss } from "@/sources/rss.js";
import { fetchScrape } from "@/sources/scrape.js";
import type { NormalizedItem, SourceConfig, SourceType } from "@/types.js";

type Fetcher = (source: SourceConfig) => Promise<NormalizedItem[]>;

const fetchers: Record<SourceType, Fetcher> = {
  rss: fetchRss,
  atom: fetchAtom,
  scrape: fetchScrape,
};

export function fetchSource(source: SourceConfig): Promise<NormalizedItem[]> {
  const fetcher = fetchers[source.type];
  if (!fetcher) {
    throw new Error(`${source.id}: unknown source type "${source.type}"`);
  }
  return fetcher(source);
}
