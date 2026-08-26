import { Fragment } from "react";

import { queryTokens } from "@/lib/items";

/**
 * The searched-for words marked out in a piece of text.
 *
 * Without this, a hit whose match sits in the Polish summary rather than the
 * title looks like a random card in the list — there is nothing to tell the
 * user why it was returned.
 *
 * The text is split into pieces and rendered as React children; we never build
 * an HTML string, so `dangerouslySetInnerHTML` is not needed and a title
 * containing `<` stays a title.
 */
export function Highlight({ text, query }: { text: string; query: string | null }) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return <>{text}</>;

  const spans = matches(text, tokens);
  if (spans.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  spans.forEach(([start, end], index) => {
    if (start > cursor) parts.push(<Fragment key={`t${index}`}>{text.slice(cursor, start)}</Fragment>);
    parts.push(
      // `mark` comes with a yellow background and black text by default, which
      // is unreadable in the dark theme — hence explicit brand tokens.
      <mark key={`m${index}`} className="text-foreground bg-brand/25 rounded-[3px] px-0.5">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });

  parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}

/**
 * Positions of every token in the text, merged where they overlap — two
 * adjacent `<mark>`s over the same word would draw a visible seam.
 *
 * Matching happens on lowercased copies, in step with the `ILIKE` the database
 * uses, so what is highlighted is exactly what was matched.
 */
function matches(text: string, tokens: string[]): [number, number][] {
  const haystack = text.toLowerCase();
  const found: [number, number][] = [];

  for (const token of tokens) {
    const needle = token.toLowerCase();
    // A token can be lowercased into an empty string; `indexOf("")` returns 0
    // forever, so guarding here saves an infinite loop.
    if (needle === "") continue;

    let at = haystack.indexOf(needle);
    while (at !== -1) {
      found.push([at, at + needle.length]);
      at = haystack.indexOf(needle, at + needle.length);
    }
  }

  found.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [start, end] of found) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  return merged;
}
