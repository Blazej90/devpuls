"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { hrefFor } from "@/components/inbox-filters";
import { VIEW_LABELS, type Topic, type View } from "@/lib/items";

/**
 * How long we wait after the last keystroke. The page is `force-dynamic`, so
 * every navigation is a database round trip — without the delay a five-letter
 * word would be five of them.
 */
const DEBOUNCE_MS = 300;

/**
 * Searching the inbox.
 *
 * The phrase is the third URL-level filter next to the tab and the category
 * (ADR-0003), so it survives a refresh and can be sent to another device. The
 * field itself has to be a client component — typing is local state — but the
 * result of typing is an ordinary address change, and the filtering happens in
 * the database, because only one page of items is ever loaded.
 *
 * The phrase **narrows the active tab** rather than escaping it. Nothing
 * switches tabs on the user's behalf: the tab counters are computed with the
 * phrase applied, so they show at a glance which tab holds the hits.
 */
export function InboxSearch({
  view,
  topic,
  query,
  source,
  results,
}: {
  view: View;
  topic: Topic | null;
  query: string | null;
  source: string | null;
  /** Hits in the active tab — the number reported next to the field. */
  results: number;
}) {
  const router = useRouter();
  const field = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(query ?? "");
  const [pending, startTransition] = useTransition();

  /**
   * The phrase this component last put into the address. It is what tells a
   * navigation we caused apart from one that came from outside (the back
   * button, a shared link) — the latter has to win over local state.
   */
  const applied = useRef(query);

  useEffect(() => {
    if (query === applied.current) return;
    applied.current = query;
    setValue(query ?? "");
  }, [query]);

  const go = useCallback(
    (raw: string) => {
      // The same normalisation `parseQuery` does on the server, so a trailing
      // space does not look like a new phrase and trigger a pointless request.
      const phrase = raw.trim().replace(/\s+/g, " ");
      const next = phrase === "" ? null : phrase;
      if (next === applied.current) return;

      applied.current = next;
      startTransition(() => {
        // `replace`, not `push`: otherwise every keystroke would leave its own
        // history entry and the back button would spell the phrase backwards.
        // `scroll: false`, because the field stays where it is and what changes
        // is the list below it.
        router.replace(hrefFor({ view, topic, source, query: next }), { scroll: false });
      });
    },
    [router, view, topic, source],
  );

  useEffect(() => {
    const timer = setTimeout(() => go(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, go]);

  function clear() {
    setValue("");
    go("");
    field.current?.focus();
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        // Enter applies the phrase without waiting out the debounce.
        event.preventDefault();
        go(value);
      }}
      className="space-y-2"
    >
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />

        <Input
          ref={field}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && value !== "") {
              event.preventDefault();
              clear();
            }
          }}
          placeholder="Szukaj w tytułach i streszczeniach"
          aria-label="Szukaj we wpisach"
          /* The browser's own `type="search"` clear button would bypass our
             state, so it is hidden in favour of the one below. */
          className="h-10 pr-10 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
        />

        {pending ? (
          <Loader2
            className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        ) : (
          value !== "" && (
            <button
              type="button"
              onClick={clear}
              aria-label="Wyczyść wyszukiwanie"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 transition-colors focus-visible:ring-1 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          )
        )}
      </div>

      {/* A live region, so the result of typing is announced rather than only
          drawn — the list itself is far below the field. */}
      <p role="status" aria-live="polite" className="text-muted-foreground text-xs">
        {query === null
          ? ""
          : results === 0
            ? `Brak wyników w zakładce „${VIEW_LABELS[view]}”. Sprawdź liczniki przy pozostałych.`
            : `Trafienia w zakładce „${VIEW_LABELS[view]}”: ${results}`}
      </p>
    </form>
  );
}
