"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Light/dark theme (ADR-0003).
 *
 * Until Stage 2 the `.dark` block in `globals.css` was dead code — the full
 * token palette existed, but nothing ever added the `.dark` class to the
 * document, so every `dark:` variant in Tailwind never fired.
 *
 * `next-themes` rather than our own `useState`: the library injects a script
 * that sets the class **before** the first paint. A hand-rolled solution would
 * read the preference only in an effect, i.e. after hydration — and every visit
 * in dark mode would flash a white background.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Without this, switching animates every `transition-colors` declaration
      // on the page at once — it looks like a stutter, not like a theme change.
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
