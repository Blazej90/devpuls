"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Jasny", Icon: Sun },
  { value: "dark", label: "Ciemny", Icon: Moon },
  { value: "system", label: "Systemowy", Icon: Monitor },
] as const;

/**
 * Whether we are on the client already.
 *
 * `useTheme()` does not know the selected theme on the server — rendering it
 * straight away would cause a hydration mismatch. `useSyncExternalStore`
 * instead of `useState` + `useEffect`, because setting state in an effect body
 * breaks the `react-hooks` rule; the same pattern backs the PWA install prompt.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Theme switch — three states, not two (ADR-0003).
 *
 * "System" is a separate option rather than a starting state that vanishes on
 * the first click: without it there is no way back to following the phone's
 * setting, and that is the only mode that switches itself in the evening.
 *
 * A segmented control instead of a dropdown — three options fit in one row, so
 * changing it takes a single tap and the current choice is visible without
 * opening anything.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <ToggleGroup
      type="single"
      // Nothing is selected before hydration — otherwise the server and the
      // client would render different states. The control does not change size,
      // so nothing jumps.
      value={mounted ? theme : ""}
      onValueChange={(value) => {
        // Radix allows deselecting the active item; a theme has to stay chosen.
        if (value) setTheme(value);
      }}
      variant="outline"
      size="sm"
      aria-label="Motyw"
      className="gap-0"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          title={label}
          // The shadcn default `data-[state=on]:bg-accent` is #f5f5f5 on white
          // in light mode — a contrast of 1.08:1, i.e. you cannot tell which
          // theme is selected. `primary` inverts the colours and works in both
          // themes, the same as the active relevance threshold in settings.
          // `-ml-px` welds adjacent borders into one segmented control.
          className={cn(
            "relative rounded-none border-input first:rounded-l-md last:rounded-r-md",
            "[&:not(:first-child)]:-ml-px",
            "data-[state=on]:z-10 data-[state=on]:border-primary",
            "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
