import { Hero } from "@/components/hero";
import { InstallHint } from "@/components/pwa/install-hint";
import { PushSettings } from "@/components/pwa/push-settings";
import { PushToggle } from "@/components/pwa/push-toggle";
import { ScrollToTop } from "@/components/scroll-to-top";
import { Inbox } from "@/components/inbox";
import { RunStatus } from "@/components/run-status";
import { InboxNav, Pagination } from "@/components/inbox-filters";
import { calendarDay } from "@/lib/date-groups";
import {
  counts,
  countSources,
  countUnread,
  listItems,
  parsePage,
  parseTopic,
  parseView,
} from "@/lib/items";
import { getLastRunSafe } from "@/lib/runs";

/** The inbox reads the database on every visit — after a push it has to be current. */
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const topic = parseTopic(params.topic);
  const page = parsePage(params.page);

  const [{ items, hasMore }, viewCounts, unread, sources, lastRun] = await Promise.all([
    listItems({ view, topic }, page),
    counts(topic),
    countUnread(),
    countSources(),
    getLastRunSafe(),
  ]);

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

      <InboxNav view={view} topic={topic} counts={viewCounts} />

      <Inbox items={items} view={view} today={today} />

      <Pagination
        view={view}
        topic={topic}
        page={page}
        hasMore={hasMore}
        shown={items.length}
        total={viewCounts[view]}
      />

      <ScrollToTop />
    </main>
  );
}
