"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCheck,
  ExternalLink,
  FilterX,
  Inbox as InboxIcon,
  SearchX,
  Star,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Highlight } from "@/components/highlight";
import { setBadge } from "@/lib/badge";
import { cn } from "@/lib/utils";
import { formatDate, groupByDate } from "@/lib/date-groups";
import { hrefFor } from "@/components/inbox-filters";
import {
  TOPIC_LABELS,
  type Filter,
  type NewsItem,
  type Topic,
  type View,
} from "@/lib/items";

type Route = "/api/items/read" | "/api/items/delete" | "/api/items/star";

/** Every write route responds with the current unread count. */
async function send(route: Route, body: unknown): Promise<number> {
  const response = await fetch(route, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  // Throw instead of returning null: the optimistic UI has already hidden the
  // card, so a silent failure looks like success. That is exactly how the
  // bigint bug looked for a while — the write never landed and the interface
  // said nothing.
  if (!response.ok) throw new Error(`Write failed (HTTP ${response.status})`);

  const data = (await response.json()) as { unread: number };
  return data.unread;
}

function ItemCard({
  item,
  read,
  starred,
  selected,
  filter,
  onSelect,
  onToggleRead,
  onToggleStarred,
  onDelete,
}: {
  item: NewsItem;
  read: boolean;
  starred: boolean;
  selected: boolean;
  /** The active filter: the phrase is marked out, the source is linked to. */
  filter: Filter;
  onSelect: (id: number, selected: boolean) => void;
  onToggleRead: (id: number, read: boolean) => void;
  onToggleStarred: (id: number, starred: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const date = formatDate(item.publishedAt);

  return (
    <Card className={cn("transition-opacity", read && "opacity-60")}>
      <CardHeader className="gap-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(state) => onSelect(item.id, state === true)}
            aria-label={`Zaznacz: ${item.title}`}
            className="mt-1 shrink-0"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {item.relevance !== null && (
                <Badge variant={item.relevance >= 5 ? "default" : "secondary"}>
                  Trafność {item.relevance}
                </Badge>
              )}
              {item.topics?.map((topic) => (
                <Badge key={topic} variant="outline">
                  {TOPIC_LABELS[topic as Topic] ?? topic}
                </Badge>
              ))}
            </div>

            <CardTitle className="text-base leading-snug">
              {/*
                Opening the link does NOT mark the item as read (ADR-0003).
                It used to do that on the user's behalf, so opening an article
                in a new tab "for later" threw it out of the inbox.
              */}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 hover:underline"
              >
                <span>
                  <Highlight text={item.title} query={filter.query} />
                </span>
                <ExternalLink className="mt-1 size-3.5 shrink-0 opacity-60" aria-hidden />
              </a>
            </CardTitle>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-pressed={starred}
            aria-label={starred ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
            title={starred ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
            onClick={() => onToggleStarred(item.id, !starred)}
            className={cn(
              "-mt-1 shrink-0",
              starred
                ? "text-brand hover:text-brand"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Star className={cn("size-4", starred && "fill-current")} aria-hidden />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {item.summaryPl && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            <Highlight text={item.summaryPl} query={filter.query} />
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            {/*
              The source name is the way into the source filter — the thought
              "more from these" happens exactly here, while reading the card, so
              the control belongs here rather than in a separate list of ten
              names above the inbox. Once that source is the active filter the
              name goes back to being plain text: a link that leads to the page
              you are already on is a dead end.
            */}
            {filter.source === item.sourceId ? (
              item.sourceName
            ) : (
              <Link
                href={hrefFor({ ...filter, source: item.sourceId })}
                title={`Pokaż tylko wpisy z: ${item.sourceName}`}
                className="hover:text-foreground focus-visible:ring-ring rounded-sm underline decoration-dotted underline-offset-2 transition-colors focus-visible:ring-1 focus-visible:outline-none"
              >
                {item.sourceName}
              </Link>
            )}
            {date && ` · ${date}`}
          </p>

          <div className="flex items-center gap-2">
            {/*
              One toggle instead of a one-way action: until Stage 5 marking as
              read could only be undone through the database, so a mistaken
              click was irreversible from inside the app.
            */}
            <Button
              variant={read ? "ghost" : "outline"}
              size="sm"
              aria-pressed={read}
              title={
                read ? "Oznacz z powrotem jako nieprzeczytane" : "Oznacz jako przeczytane"
              }
              onClick={() => onToggleRead(item.id, !read)}
              className={read ? "text-muted-foreground" : undefined}
            >
              {read ? (
                <Undo2 className="size-4" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {read ? "Nieprzeczytane" : "Przeczytane"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(item.id)}
              aria-label={`Usuń: ${item.title}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The empty state, one entry per tab.
 *
 * The icon carries the same meaning as the sentence — an empty inbox, a
 * starless list, nothing ticked off. It is read before the sentence is, and it
 * is what makes the card look like a state of the app rather than a failure to
 * load; the message alone, grey text on an empty card, reads like something
 * went wrong.
 */
const EMPTY_STATES: Record<View, { icon: LucideIcon; message: string }> = {
  new: {
    icon: InboxIcon,
    message:
      "Skrzynka pusta. Agent sprawdza źródła co dwa dni — nowe wpisy pojawią się tutaj.",
  },
  starred: {
    icon: Star,
    message:
      "Nic jeszcze nie ma gwiazdki. Oznacz wpis gwiazdką, żeby wrócić do niego później.",
  },
  read: { icon: CheckCheck, message: "Nic jeszcze nie zostało odhaczone." },
  all: {
    icon: InboxIcon,
    message: "Brak wpisów. Po pierwszym przebiegu agenta pojawią się tutaj.",
  },
};

export function Inbox({
  items,
  filter,
  today,
}: {
  items: NewsItem[];
  /** The whole filter, because the cards link back into it (source, phrase). */
  filter: Filter;
  /** Calendar day decided by the server — see `lib/date-groups.ts`. */
  today: string;
}) {
  const { view, query } = filter;
  const router = useRouter();
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  // Optimistic overrides: a `Map` rather than a `Set`, because both states are
  // now bidirectional — the mere presence of an id no longer says which way
  // the change went.
  const [readOverrides, setReadOverrides] = useState<Map<number, boolean>>(new Map());
  const [starOverrides, setStarOverrides] = useState<Map<number, boolean>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  const isRead = (item: NewsItem) => readOverrides.get(item.id) ?? item.readAt !== null;
  const isStarred = (item: NewsItem) =>
    starOverrides.get(item.id) ?? item.starredAt !== null;

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (deleted.has(item.id)) return false;

        const read = readOverrides.get(item.id) ?? item.readAt !== null;
        const starred = starOverrides.get(item.id) ?? item.starredAt !== null;

        // An item disappears only from the tab it stopped belonging to.
        // In "All" it stays and merely changes appearance — otherwise the card
        // would run away from under the cursor in a view whose whole point is
        // showing everything.
        if (view === "new" && read) return false;
        if (view === "read" && !read) return false;
        if (view === "starred" && !starred) return false;
        return true;
      }),
    [items, deleted, readOverrides, starOverrides, view],
  );

  const groups = useMemo(() => groupByDate(visible, today), [visible, today]);
  const selectedVisible = visible.filter((item) => selected.has(item.id));

  const toggleSelection = (id: number, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  /** Shared handling of optimistic overrides with rollback on failure. */
  function save(
    apply: React.Dispatch<React.SetStateAction<Map<number, boolean>>>,
    ids: number[],
    value: boolean,
    route: Route,
    body: unknown,
    logMessage: string,
  ) {
    if (ids.length === 0) return;

    let previous: Map<number, boolean> = new Map();
    apply((current) => {
      previous = current;
      const next = new Map(current);
      for (const id of ids) next.set(id, value);
      return next;
    });

    setError(null);
    clearSelection();

    void send(route, body)
      .then((unread) => {
        setBadge(unread);
        refresh();
      })
      .catch((cause: unknown) => {
        console.error(`[inbox] ${logMessage}`, cause);
        setError("Nie udało się zapisać. Wpisy wróciły na miejsce.");
        apply(previous);
      });
  }

  const setRead = (ids: number[], read: boolean) =>
    save(
      setReadOverrides,
      ids,
      read,
      "/api/items/read",
      read ? { ids } : { ids, unmark: true },
      "changing read state failed",
    );

  const setStarred = (ids: number[], starred: boolean) =>
    save(
      setStarOverrides,
      ids,
      starred,
      "/api/items/star",
      { ids, starred },
      "changing starred state failed",
    );

  function undoDelete(ids: number[]) {
    void send("/api/items/delete", { ids, restore: true })
      .then((unread) => {
        setBadge(unread);
        setDeleted((current) => {
          const next = new Set(current);
          for (const id of ids) next.delete(id);
          return next;
        });
        refresh();
      })
      .catch((cause: unknown) => {
        console.error("[inbox] undo failed", cause);
        toast.error("Nie udało się cofnąć usunięcia.");
      });
  }

  function remove(ids: number[]) {
    if (ids.length === 0) return;
    const previous = deleted;

    setDeleted((current) => new Set([...current, ...ids]));
    setError(null);
    clearSelection();

    void send("/api/items/delete", { ids })
      .then((unread) => {
        setBadge(unread);
        refresh();

        // Deleting is soft (ADR-0003), so undo is an ordinary write rather than
        // resurrecting something that no longer exists.
        toast(ids.length === 1 ? "Wpis usunięty" : `Usunięto wpisy: ${ids.length}`, {
          action: { label: "Cofnij", onClick: () => undoDelete(ids) },
        });
      })
      .catch((cause: unknown) => {
        console.error("[inbox] delete failed", cause);
        setError("Nie udało się usunąć. Wpisy wróciły na miejsce.");
        setDeleted(previous);
      });
  }

  const toMarkRead = selectedVisible.filter((item) => !isRead(item));
  const toMarkUnread = selectedVisible.filter((item) => isRead(item));
  const toStar = selectedVisible.filter((item) => !isStarred(item));

  // With a filter on, the tab's own empty message would be a lie — the inbox is
  // not empty, this phrase or source simply has nothing here. The icon says the
  // same thing before the sentence does: a crossed-out magnifier or funnel is
  // "your filter", not "your inbox".
  const { icon: EmptyIcon, message: emptyMessage } =
    query !== null
      ? {
          icon: SearchX,
          message: `Brak wyników dla „${query}” w tej zakładce. Liczniki nad listą pokazują, czy fraza trafia gdzie indziej.`,
        }
      : filter.source !== null
        ? {
            icon: FilterX,
            message:
              "Brak wpisów z tego źródła w tej zakładce. Wyłącz filtr źródła chipem nad listą.",
          }
        : EMPTY_STATES[view];

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-10 text-center text-sm">
            {/* Thin stroke and low opacity: this is a mood, not a control —
                at full weight a 40px icon would outshout the whole list it is
                standing in for. `aria-hidden`, because it repeats the
                sentence right under it. */}
            <EmptyIcon
              className="size-10 opacity-30"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="max-w-sm text-balance">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => {
          const unread = group.items.filter((item) => !isRead(item));

          return (
            <section key={group.bucket} className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                  <span className="ml-2 tabular-nums opacity-70">{group.items.length}</span>
                </h2>

                {unread.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground text-xs"
                    onClick={() =>
                      setRead(
                        unread.map((item) => item.id),
                        true,
                      )
                    }
                  >
                    <CheckCheck className="size-3.5" aria-hidden />
                    Oznacz grupę
                  </Button>
                )}
              </div>

              <ol className="space-y-4">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <ItemCard
                      item={item}
                      read={isRead(item)}
                      starred={isStarred(item)}
                      selected={selected.has(item.id)}
                      filter={filter}
                      onSelect={toggleSelection}
                      onToggleRead={(id, state) => setRead([id], state)}
                      onToggleStarred={(id, state) => setStarred([id], state)}
                      onDelete={(id) => remove([id])}
                    />
                  </li>
                ))}
              </ol>
            </section>
          );
        })
      )}

      {/* Bulk action bar — appears only once something is selected.
          `fixed`, not `sticky`: on a phone it has to stay within thumb reach no
          matter how far the user has scrolled. The scroll-to-top button sits
          higher (`bottom-24`), so the two never overlap. */}
      {selectedVisible.length > 0 && (
        <div
          role="region"
          aria-label="Akcje dla zaznaczonych"
          className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
        >
          <div className="bg-popover text-popover-foreground border-border flex flex-wrap items-center justify-center gap-2 rounded-lg border p-2 shadow-lg">
            <span className="px-2 text-sm tabular-nums">
              Zaznaczone: {selectedVisible.length}
            </span>

            {/* The direction of the action depends on what is selected — for a
                mixed selection we show both buttons, each acting on its part. */}
            {toMarkRead.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRead(
                    toMarkRead.map((item) => item.id),
                    true,
                  )
                }
              >
                <Check className="size-4" aria-hidden />
                Przeczytane
              </Button>
            )}

            {toMarkUnread.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRead(
                    toMarkUnread.map((item) => item.id),
                    false,
                  )
                }
              >
                <Undo2 className="size-4" aria-hidden />
                Nieprzeczytane
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setStarred(
                  (toStar.length > 0 ? toStar : selectedVisible).map((item) => item.id),
                  toStar.length > 0,
                )
              }
            >
              <Star
                className={cn("size-4", toStar.length === 0 && "fill-current")}
                aria-hidden
              />
              {toStar.length > 0 ? "Do ulubionych" : "Bez gwiazdki"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => remove(selectedVisible.map((item) => item.id))}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              Usuń
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              aria-label="Odznacz wszystkie"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
