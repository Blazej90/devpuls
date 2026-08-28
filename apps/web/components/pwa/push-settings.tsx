"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DEFAULT_RELEVANCE,
  parseRelevance,
  readRememberedRelevance,
  rememberRelevance,
  RELEVANCE_LEVELS,
  type RelevanceLevel,
} from "@/lib/relevance";

const TOPICS = [
  { id: "typescript", label: "TypeScript" },
  { id: "react", label: "React" },
  { id: "javascript", label: "JavaScript" },
  { id: "fullstack", label: "Fullstack" },
  { id: "ai", label: "AI" },
  { id: "other", label: "Inne" },
] as const;

interface Settings {
  minRelevance: RelevanceLevel;
  topics: string[];
}

/** Category order is not part of the choice, so it must not count as a change. */
function unchanged(a: Settings, b: Settings): boolean {
  return (
    a.minRelevance === b.minRelevance &&
    a.topics.length === b.topics.length &&
    a.topics.every((topic) => b.topics.includes(topic))
  );
}

function describe({ minRelevance, topics }: Settings, hasPush: boolean): string {
  // Without a subscription the categories are not being applied to anything,
  // so naming them here would describe a filter that is not running.
  if (!hasPush) return `Trafność ${minRelevance}+`;

  const labels = TOPICS.filter((topic) => topics.includes(topic.id)).map(
    (topic) => topic.label,
  );
  return `Trafność ${minRelevance}+ · ${
    labels.length === 0 ? "wszystkie kategorie" : labels.join(", ")
  }`;
}

/**
 * The relevance threshold and the notification categories (`/settings` since
 * Phase 11).
 *
 * The threshold governs **both** the inbox and the digest, so one save writes
 * to both of the stores it is read from — see `lib/relevance.ts` for why there
 * are two. The categories stay with the subscription alone: it is the agent
 * that decides what to send, and it has to see them on its side.
 *
 * The threshold section therefore works with notifications switched off, which
 * is now the point of it — a laptop that will never be pushed to still has an
 * inbox to filter.
 *
 * Two states, and the difference between them is the point of this screen:
 * locked, where every control is disabled and the choice can only be read, and
 * editing, which ends with an explicit "Zapisz". Before Phase 11 each click
 * wrote straight to the server — which meant a stray tap silently changed what
 * the agent would send, and the confirmation was a word that appeared and faded
 * on its own.
 *
 * That rewrite also removed two workarounds the old version needed: state
 * mirrored in refs (two clicks in one React tick read the same stale closure
 * and the second overwrote the first) and a promise queue serialising the
 * writes (on a Neon cold start the first PATCH could land after the second).
 * A draft edited through functional updates always sees the current value, and
 * one save per click cannot race with itself.
 */
export function PushSettings() {
  /** `null` until the check finishes; keeps the card from flashing on load. */
  const [ready, setReady] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  /** What the server holds. `draft` goes back to this on "Anuluj". */
  // The placeholder only ever shows for the moment before `load` reads the
  // cookie — the card stays hidden until then, so it is never rendered.
  const [saved, setSaved] = useState<Settings>({
    minRelevance: DEFAULT_RELEVANCE,
    topics: [],
  });
  const [draft, setDraft] = useState<Settings>({
    minRelevance: DEFAULT_RELEVANCE,
    topics: [],
  });
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // The cookie is what the inbox is filtering on at this very moment, so it
      // is the starting point even when there is no subscription to ask.
      let current: Settings = { minRelevance: readRememberedRelevance(), topics: [] };

      const subscription =
        "serviceWorker" in navigator
          ? await (await navigator.serviceWorker.ready).pushManager.getSubscription()
          : null;
      if (cancelled) return;

      if (subscription) {
        const response = await fetch("/api/push/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (cancelled) return;

        if (response.ok) {
          const data = (await response.json()) as {
            minRelevance: number;
            topics: string[] | null;
          };
          if (cancelled) return;

          // The subscription row wins over the cookie: it is the store that
          // existed first and the one the agent reads. Writing the cookie back
          // from it is what repairs a device whose threshold was chosen before
          // the inbox honoured it at all.
          current = {
            minRelevance: parseRelevance(String(data.minRelevance)),
            topics: data.topics ?? [],
          };
          rememberRelevance(current.minRelevance);
          setEndpoint(subscription.endpoint);
        }
      }

      setSaved(current);
      setDraft(current);
      setReady(true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      // The digest half of the save. Skipped, not failed, on a device with no
      // subscription — the threshold still has an inbox to apply to.
      if (endpoint !== null) {
        const response = await fetch("/api/push/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            endpoint,
            minRelevance: draft.minRelevance,
            // An empty list = no filter, which is how the endpoint reads it too.
            topics: draft.topics.length > 0 ? draft.topics : null,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }

      // The inbox half. Written after the request, so a failed PATCH cannot
      // leave the two stores disagreeing.
      rememberRelevance(draft.minRelevance);

      setSaved(draft);
      setEditing(false);
      // Every server-rendered page sits in the router cache with the old
      // threshold baked into it; without this the new one would only appear
      // after a hard reload.
      router.refresh();
      toast("Zapisano ustawienia", { description: describe(draft, endpoint !== null) });
    } catch (error: unknown) {
      console.error("[settings] write failed", error);
      // The form stays open with the draft intact — a failed save must not look
      // like a successful one, and retyping the choice would be the punishment.
      toast.error("Nie udało się zapisać ustawień.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(saved);
    setEditing(false);
  }

  function toggleTopic(id: string) {
    setDraft((current) => ({
      ...current,
      topics: current.topics.includes(id)
        ? current.topics.filter((topic) => topic !== id)
        : [...current.topics, id],
    }));
  }

  if (!ready) return null;

  const dirty = !unchanged(draft, saved);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trafność i kategorie</CardTitle>
        <CardDescription>
          Próg trafności decyduje o tym, co widzisz w skrzynce, i o tym, o czym
          dostajesz powiadomienie. Ustawienie dotyczy tej przeglądarki, więc
          telefon i laptop mogą mieć różne progi.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <fieldset disabled={!editing || saving} className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Minimalna trafność</p>
            <div className="flex flex-wrap gap-2">
              {RELEVANCE_LEVELS.map((level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={draft.minRelevance === level ? "default" : "outline"}
                  onClick={() =>
                    setDraft((current) => ({ ...current, minRelevance: level }))
                  }
                >
                  {level}+
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Skrzynka i powiadomienia biorą wpisy od wybranego progu w górę —{" "}
              {draft.minRelevance}+ to trafność{" "}
              {RELEVANCE_LEVELS.filter((level) => level >= draft.minRelevance).join(
                " i ",
              )}
              . Piątka to tylko przełomowe rzeczy, dwójka przepuszcza prawie
              wszystko.
            </p>
          </div>

          {/* Categories filter the digest and nothing else, so on a device
              without notifications there is nothing for them to do — the inbox
              has its own category filter in the address. */}
          {endpoint !== null && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Kategorie</p>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((topic) => {
                  const selected = draft.topics.includes(topic.id);
                  return (
                    <Button
                      key={topic.id}
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => toggleTopic(topic.id)}
                    >
                      {selected && <Check className="size-3.5" aria-hidden />}
                      {topic.label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                {draft.topics.length === 0
                  ? "Nic nie zaznaczone = wszystkie kategorie."
                  : `Powiadomienia tylko z ${draft.topics.length} wybranych kategorii.`}
              </p>
            </div>
          )}
        </fieldset>

        {/* The way back into editing. Without it the save would be one-way —
            the settings are meant to be revisited, just not changed by accident. */}
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              Zapisz
            </Button>
            <Button variant="ghost" onClick={cancel} disabled={saving}>
              Anuluj
            </Button>
            {dirty && !saving && (
              <span className="text-muted-foreground text-xs">
                Niezapisane zmiany
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden />
              Zmień
            </Button>
            <span className="text-muted-foreground text-xs">
              {describe(saved, endpoint !== null)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
