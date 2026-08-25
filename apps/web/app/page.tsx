import { Hero } from "@/components/hero";
import { InstallHint } from "@/components/pwa/install-hint";
import { PushSettings } from "@/components/pwa/push-settings";
import { PushToggle } from "@/components/pwa/push-toggle";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Inbox } from "@/components/inbox";
import { RunStatus } from "@/components/run-status";
import { InboxNav, Pagination } from "@/components/inbox-filters";
import { InboxSearch } from "@/components/inbox-search";
import { calendarDay } from "@/lib/date-groups";
import {
  counts,
  countSources,
  countUnread,
  listItems,
  parsePage,
  parseQuery,
  parseSource,
  parseTopic,
  parseView,
} from "@/lib/items";
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
  };

  const [{ items, hasMore }, viewCounts, unread, sources, sourceNames, lastRun] =
    await Promise.all([
      listItems(filter, page),
      counts(filter),
      countUnread(),
      countSources(),
      // Only needed to label the chip, so it is not worth a query when no
      // source filter is on.
      filter.source ? listSources() : [],
      getLastRunSafe(),
    ]);

  const activeSource = sourceNames.find((entry) => entry.id === filter.source) ?? null;

  // The day is decided once, on the server, and passed down — otherwise the
  // split into "Today"/"Yesterday" could come out differently on the server
  // than in the browser (details in `lib/date-groups.ts`).
  const today = calendarDay(new Date());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <Hero unread={unread} sources={sources} />

      <RunStatus run={lastRun} />

      <InstallHint />
      <PushToggle />
      <PushSettings />

      {/* The field and the tabs are one control surface, so they sit closer to
          each other than to the rest of the page. */}
      <div className="space-y-4">
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
