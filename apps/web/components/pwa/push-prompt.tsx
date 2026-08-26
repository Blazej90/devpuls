"use client";

import Link from "next/link";
import { ArrowRight, BellRing } from "lucide-react";

import { usePushStatus } from "@/components/pwa/push-status";

/**
 * The one thing about notifications that stays on the inbox screen (Phase 11).
 *
 * The full controls moved to `/settings`, and hiding them entirely would have
 * cost the app its point: someone who never opens the gear would never turn on
 * the feature DevPuls exists for. So a single line remains, and only while
 * notifications are actually off — once they are on it disappears, instead of
 * repeating a question that has been answered.
 *
 * "unsupported" and "blocked" get no line here on purpose: neither can be
 * resolved by tapping anything in this app, and an explanation belongs where
 * the switch is, not above the news.
 */
export function PushPrompt() {
  const [status] = usePushStatus();

  if (status !== "off") return null;

  return (
    <Link
      href="/settings"
      className="border-brand/40 bg-brand/5 hover:border-brand focus-visible:ring-ring flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
    >
      <BellRing className="text-brand size-4 shrink-0" aria-hidden />
      <span>Włącz powiadomienia o nowych wpisach</span>
      <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0" aria-hidden />
    </Link>
  );
}
