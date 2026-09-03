import { MAX_ITEMS_PER_SOURCE } from "@/config.js";
import { fetchAtom } from "@/sources/atom.js";
import { fetchRss } from "@/sources/rss.js";
import { fetchScrape } from "@/sources/scrape.js";
import type {
  FetchResult,
  NormalizedItem,
  SourceConfig,
  SourceType,
} from "@/types.js";

type Fetcher = (source: SourceConfig) => Promise<NormalizedItem[]>;

const fetchers: Record<SourceType, Fetcher> = {
  rss: fetchRss,
  atom: fetchAtom,
  scrape: fetchScrape,
};

/**
 * Fetches a source and applies the two policies that live in the config:
 * `titlePattern` (which items count at all) and the cap (how many of them we
 * take).
 *
 * The order matters and is the whole point of doing this here rather than in
 * each fetcher: the fetchers hand back everything the feed had, the filter runs
 * on the full page, and only then does the cap apply. Slicing first — which is
 * what the fetchers used to do — would mean taking fifteen next.js canaries and
 * then discovering none of them qualify, while the stable release sat at
 * position sixteen.
 */
export async function fetchSource(source: SourceConfig): Promise<FetchResult> {
  const fetcher = fetchers[source.type];
  if (!fetcher) {
    throw new Error(`${source.id}: unknown source type "${source.type}"`);
  }

  const all = await fetcher(source);

  const pattern = source.titlePattern
    ? new RegExp(source.titlePattern)
    : null;
  const kept = pattern ? all.filter((item) => pattern.test(item.title)) : all;

  return {
    items: kept.slice(0, source.maxItems ?? MAX_ITEMS_PER_SOURCE),
    fetched: all.length,
  };
}
