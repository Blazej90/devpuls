import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { MuteButton } from "@/components/source-mute";
import { cn } from "@/lib/utils";
import {
  PAGE_SIZE,
  SORTS,
  SORT_LABELS,
  TOPICS,
  TOPIC_LABELS,
  VIEWS,
  VIEW_LABELS,
  type Sort,
  type Topic,
  type View,
} from "@/lib/items";

/**
 * Tab and filter live in the URL (ADR-0003), so navigation is plain links
 * rather than a client component holding state. The payoff: the back button
 * works, a refresh does not lose context, and a view can be sent to another
 * device.
 *
 * We deliberately do **not** use the shadcn `tabs`: Radix switches panels on
 * the client, while here every tab is a different database query. Driving it
 * from the URL would mean two sources of truth fighting over the same thing.
 */
export function hrefFor({
  view,
  topic,
  query,
  source,
  sort,
  page = 1,
}: {
  view: View;
  topic: Topic | null;
  query: string | null;
  source: string | null;
  sort: Sort;
  /** Omitted on purpose wherever the page should reset — see below. */
  page?: number;
}): string {
  const params = new URLSearchParams();
  // Defaults are omitted so that a "clean" address is simply `/`.
  if (view !== "new") params.set("view", view);
  if (topic) params.set("topic", topic);
  if (query) params.set("q", query);
  if (source) params.set("source", source);
  if (sort !== "recency") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));

  const search = params.toString();
  return search ? `/?${search}` : "/";
}

/**
 * Switching the tab or the category **resets the page** — `hrefFor` called
 * without `page` omits it. Otherwise moving to a category with three items
 * while page four is open would show an empty list. The search phrase goes the
 * other way: it is carried along everywhere, because switching tabs while
 * searching means "show me the hits in that other tab", not "drop the phrase".
 */

/**
 * Inbox navigation: tabs (the view level) above chips (the filter level).
 * Two different shapes — an underline versus a pill — because these are two
 * different levels of hierarchy; if both were pills they would be
 * indistinguishable.
 */
export function InboxNav({
  view,
  topic,
  query,
  source,
  sort,
  sourceName,
  sourceMuted,
  counts,
}: {
  view: View;
  topic: Topic | null;
  query: string | null;
  source: string | null;
  sort: Sort;
  /** Label for the active source; `null` when the id matches nothing. */
  sourceName: string | null;
  /** Whether that source is muted — decides the direction of the button. */
  sourceMuted: boolean;
  counts: Record<View, number>;
}) {
  return (
    <div className="space-y-4">
      {/*
        The hairline sits on the `nav`, not on the `ul` — see the strip below
        for why. The `ul` is pulled a pixel over it, so the last row of the
        tabs and the line occupy the same pixel.
      */}
      <nav aria-label="Widok skrzynki" className="border-border border-b">
        {/*
          The separator is a hairline in the `border` colour, while the active
          tab indicator is a thicker line in the brand colour. The indicator
          used to be `primary` (near black / near white) and sat exactly on the
          line, so it read as one continuous rule instead of a selection.

          Horizontal scrolling, because four tabs with counters do not fit the
          width of a phone — and **strictly** horizontal. `overflow-x: auto`
          alone turns the box into a scroll container on both axes (CSS computes
          the other `visible` into `auto`), so the pixel the indicator used to
          hang outside the `ul` was a pixel of vertical scroll range: on a phone
          the whole strip rubber-banded up and down under the finger. Hence
          `overflow-y: hidden` — which in turn is why the hairline moved to the
          `nav`, because anything hanging below the `ul` would now be clipped
          instead of merely scrollable.

          `overscroll-x-contain` keeps a fling that runs off the end inside the
          strip rather than handing it to the browser's back gesture.
        */}
        <ul className="-mb-px flex gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {VIEWS.map((entry) => {
            const active = entry === view;
            return (
              <li key={entry} className="shrink-0">
                <Link
                  href={hrefFor({ view: entry, topic, query, source, sort })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring flex items-center gap-2 border-b-2 px-3 py-2.5",
                    "text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none",
                    active
                      ? "border-brand text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  {VIEW_LABELS[entry]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums",
                      active
                        ? "bg-brand/15 text-brand"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[entry]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/*
        Category chips. Until Stage 3 they sat in the header as plain `Badge`s
        with no click handling — they looked exactly like the filter the app
        was missing.

        The active one is filled with the brand colour, not with `primary`.
        `primary` is near-black in light and near-white in dark, so the selected
        category came out as the heaviest thing on the screen and said nothing
        about which app it belonged to. Brand is what already marks a selection
        here — the tab underline and its counter — and `--brand-foreground`
        exists precisely so the colour can also be a fill: 4.9:1 in light,
        7.5:1 in dark, both above the 4.5:1 that 12px text needs.

        The hover on an inactive chip is a fifth of the same colour, so the row
        hints at what the click is about to do instead of just lighting up grey.
      */}
      <nav aria-label="Filtr kategorii" className="flex flex-wrap gap-2">
        {([null, ...TOPICS] as (Topic | null)[]).map((entry) => {
          const active = entry === topic;
          return (
            <Link
              key={entry ?? "all"}
              href={hrefFor({ view, topic: entry, query, source, sort })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring inline-flex items-center rounded-full border px-3 py-1.5",
                "text-xs font-medium whitespace-nowrap transition-colors",
                "focus-visible:ring-1 focus-visible:outline-none",
                active
                  ? "border-brand bg-brand text-brand-foreground shadow-sm"
                  : "border-border text-muted-foreground hover:border-brand/30 hover:bg-brand/5 hover:text-foreground",
              )}
            >
              {entry === null ? "Wszystkie" : TOPIC_LABELS[entry]}
            </Link>
          );
        })}
      </nav>

      {/*
        The active source filter. It has no chip row of its own: with ten
        sources, names as long as "TypeScript - GitHub Releases" would not fit a
        phone and would compete with the categories for attention. It is turned
        on by clicking the source on a card and shown here as a single removable
        chip — the whole chip is the link that removes it, so there is one
        target rather than a label with a tiny cross next to it.
      */}
      {/*
        The order. A segmented pair rather than a `select`: there are exactly two
        answers, and a native picker on a phone would put a full-screen sheet in
        front of a choice that is one tap either way.

        It sits last, right above the list, because it is the control whose
        effect starts at the first card below it — and it is right-aligned so it
        does not read as an eighth category chip.

        Track and thumb, the shape shadcn gives its own tabs, rather than the
        pill of a category chip: this switches how the same items are ordered,
        it does not take any of them away, and two controls that do different
        things should not look identical. The thumb carries the brand colour as
        text only — a second solid brand fill in the same block would fight the
        active category for the eye.
      */}
      <nav aria-label="Kolejność wpisów" className="flex justify-end">
        <div className="bg-muted border-border/60 inline-flex rounded-full border p-0.5">
          {SORTS.map((entry) => {
            const active = entry === sort;
            return (
              <Link
                key={entry}
                href={hrefFor({ view, topic, query, source, sort: entry })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "focus-visible:ring-ring rounded-full px-3 py-1.5 text-xs font-medium",
                  "whitespace-nowrap transition-colors",
                  "focus-visible:ring-1 focus-visible:outline-none",
                  active
                    ? "bg-background text-brand shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {SORT_LABELS[entry]}
              </Link>
            );
          })}
        </div>
      </nav>

      {source && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={hrefFor({ view, topic, query, source: null, sort })}
            className="border-brand/40 bg-brand/10 text-foreground hover:border-brand focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none"
          >
            <span className="text-muted-foreground font-normal">Źródło:</span>
            {sourceName ?? source}
            <X className="size-3.5" aria-hidden />
            <span className="sr-only">— wyłącz filtr źródła</span>
          </Link>

          {/* Muting starts here, right after looking at what the source
              actually delivers. Undoing it lives on `/sources`, because a muted
              source leaves no card in the inbox to click. */}
          <MuteButton
            id={source}
            name={sourceName ?? source}
            muted={sourceMuted}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Moving between inbox pages.
 *
 * A separate component below the list rather than a control inside `inbox.tsx`:
 * this is URL navigation, exactly like the tabs, so there is no reason to pull
 * it into client state. `<Link>` scrolls to the top after a page change — with
 * pagination that is what one expects.
 */
export function Pagination({
  view,
  topic,
  query,
  source,
  sort,
  page,
  hasMore,
  shown,
  total,
}: {
  view: View;
  topic: Topic | null;
  query: string | null;
  source: string | null;
  sort: Sort;
  page: number;
  hasMore: boolean;
  shown: number;
  total: number;
}) {
  // A single page holds everything — there is nothing to navigate.
  if (page === 1 && !hasMore) return null;

  const first = (page - 1) * PAGE_SIZE + 1;
  const last = first + shown - 1;

  return (
    <nav
      aria-label="Strony skrzynki"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
    >
      <PageLink
        href={hrefFor({ view, topic, query, source, sort, page: page - 1 })}
        enabled={page > 1}
        label="Poprzednia"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Poprzednia
      </PageLink>

      <p className="text-muted-foreground text-xs tabular-nums">
        {shown > 0 ? `${first}–${last}` : "0"} z {total}
      </p>

      <PageLink
        href={hrefFor({ view, topic, query, source, sort, page: page + 1 })}
        enabled={hasMore}
        label="Następna"
      >
        Następna
        <ChevronRight className="size-4" aria-hidden />
      </PageLink>
    </nav>
  );
}

/** A disabled direction renders as a `<span>`, not a greyed-out link —
 *  a dead anchor confuses screen readers and invites a click. */
function PageLink({
  href,
  enabled,
  label,
  children,
}: {
  href: string;
  enabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const classes =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors";

  if (!enabled) {
    return (
      <span aria-hidden className={cn(classes, "text-muted-foreground/40")}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        classes,
        "text-foreground hover:bg-accent focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
      )}
    >
      {children}
    </Link>
  );
}
