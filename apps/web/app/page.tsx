import { Hero } from "@/components/hero";
import { InstallHint } from "@/components/pwa/install-hint";
import { PushPrompt } from "@/components/pwa/push-prompt";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Inbox } from "@/components/inbox";
import { RunStatus } from "@/components/run-status";
import { InboxNav, Pagination } from "@/components/inbox-filters";
import { InboxSearch } from "@/components/inbox-search";
import { PullToRefresh } from "@/components/inbox-refresh";
import { calendarDay } from "@/lib/date-groups";
import {
  counts,
  countSources,
  countUnread,
  latestItemId,
  listItems,
  parsePage,
  parseQuery,
  parseSort,
  parseSource,
  parseTopic,
  parseView,
} from "@/lib/items";
import { readMinRelevance } from "@/lib/preferences";
import { listSources } from "@/lib/sources";
import { getLastRunSafe } from "@/lib/runs";

/** The inbox reads the database on every visit — after a push it has to be current. */
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);

  // The four filter dimensions travel together everywhere below, so they are
  // assembled once instead of being passed one by one.
  const filter = {
    view: parseView(params.view),
    topic: parseTopic(params.topic),
    query: parseQuery(params.q),
    source: parseSource(params.source),
    sort: parseSort(params.sort),
  };

  // The relevance floor is a device setting, not a URL one (`lib/relevance.ts`):
  // it belongs to whoever is reading, not to the link they might share. Every
  // query below takes it, so the list, the tab counters and the icon badge
  // cannot end up describing different inboxes.
  const minRelevance = await readMinRelevance();

  const [
    { items, hasMore },
    viewCounts,
    unread,
    sources,
    sourceNames,
    lastRun,
    latestId,
  ] = await Promise.all([
    listItems(filter, minRelevance, page),
    counts(filter, minRelevance),
    countUnread(minRelevance),
    countSources(),
    // Only needed to label the chip, so it is not worth a query when no
    // source filter is on.
    filter.source ? listSources() : [],
    getLastRunSafe(),
    // The reference point for the refresh: everything above this id arrived
    // after this render (Phase 11).
    latestItemId(minRelevance),
  ]);

  const activeSource = sourceNames.find((entry) => entry.id === filter.source) ?? null;

  // The day is decided once, on the server, and passed down — otherwise the
  // split into "Today"/"Yesterday" could come out differently on the server
  // than in the browser (details in `lib/date-groups.ts`).
  const today = calendarDay(new Date());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      {/* Fixed to the top of the window, so it stands outside the flow of the
          page — mounted here only because the inbox is the one view a refresh
          means anything on. */}
      <PullToRefresh latestId={latestId} />

      <Hero unread={unread} sources={sources} />

      <RunStatus run={lastRun} latestId={latestId} />

      <InstallHint />
      {/* The switch and the settings live under the gear since Phase 11; what
          is left here is one line, and only while notifications are off. */}
      <PushPrompt />

      {/* The field and the tabs are one control surface, so they sit closer to
          each other than to the rest of the page.

          `#inbox` is where the count in the header links to. It points at the
          tabs rather than at the first card, because the tab is what confirms
          the jump landed: "Nowe 8" is the same number that was pressed. */}
      <div id="inbox" className="scroll-mt-6 space-y-4">
        <InboxSearch {...filter} results={viewCounts[filter.view]} />
        <InboxNav
          {...filter}
          sourceName={activeSource?.name ?? null}
          sourceMuted={activeSource?.mutedAt != null}
          counts={viewCounts}
        />
      </div>

      <Inbox items={items} filter={filter} today={today} />

      <Pagination
        {...filter}
        page={page}
        hasMore={hasMore}
        shown={items.length}
        total={viewCounts[filter.view]}
      />

      <ScrollToTop />
    </main>
  );
}
