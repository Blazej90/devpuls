import { cn } from "@/lib/utils";

/**
 * The DevPuls mark — a pulse line (ADR-0003, Stage 4).
 *
 * Drawn with `stroke`, not `fill`, and in `currentColor`: that way one file
 * serves the hero, the light theme and the dark theme without a second
 * version. The variant with a background (the PWA icon) lives separately in
 * `public/logo.svg`, because there the colours have to be hard-coded — the
 * operating system does not know our tokens.
 *
 * The path: a flat baseline, a smaller peak, a deep dip, the tallest peak, back
 * to the baseline. The same silhouette as the placeholder icon, only drawn as
 * a vector instead of an upscaled bitmap.
 */
export const PULSE_PATH = "M3 24H13L18 13L24 35L30 9L35 24H45";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn("size-8", className)}
    >
      <path
        d={PULSE_PATH}
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The mark plus the name. The wordmark is **text**, not outlines — a screen
 * reader reads it, it scales with system settings and it weighs nothing.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark className="text-brand size-9 shrink-0" />
      <span className="text-4xl font-semibold tracking-tight">DevPuls</span>
    </span>
  );
}
