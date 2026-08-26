"use client";

import { useEffect, useState } from "react";
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

const TOPICS = [
  { id: "typescript", label: "TypeScript" },
  { id: "react", label: "React" },
  { id: "javascript", label: "JavaScript" },
  { id: "fullstack", label: "Fullstack" },
  { id: "ai", label: "AI" },
  { id: "other", label: "Inne" },
] as const;

const THRESHOLDS = [2, 3, 4, 5] as const;

interface Settings {
  minRelevance: number;
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

function describe({ minRelevance, topics }: Settings): string {
  const labels = TOPICS.filter((topic) => topics.includes(topic.id)).map(
    (topic) => topic.label,
  );
  return `Trafność ${minRelevance}+ · ${
    labels.length === 0 ? "wszystkie kategorie" : labels.join(", ")
  }`;
}

/**
 * Notification settings (`/settings` since Phase 11).
 *
 * They are stored with the subscription rather than in localStorage, because it
 * is the agent that decides what to send and it has to see them on its side.
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
  const [saved, setSaved] = useState<Settings>({ minRelevance: 4, topics: [] });
  const [draft, setDraft] = useState<Settings>({ minRelevance: 4, topics: [] });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!("serviceWorker" in navigator)) {
        if (!cancelled) setReady(true);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (cancelled) return;

      if (!subscription) {
        setReady(true);
        return;
      }

      const response = await fetch("/api/push/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (cancelled) return;

      if (!response.ok) {
        setReady(true);
        return;
      }

      const data = (await response.json()) as {
        minRelevance: number;
        topics: string[] | null;
      };
      if (cancelled) return;

      const current = { minRelevance: data.minRelevance, topics: data.topics ?? [] };
      setEndpoint(subscription.endpoint);
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
    if (endpoint === null) return;

    setSaving(true);
    try {
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

      setSaved(draft);
      setEditing(false);
      toast("Zapisano ustawienia powiadomień", { description: describe(draft) });
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

  if (endpoint === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ustawienia powiadomień</CardTitle>
          <CardDescription>
            Próg trafności i kategorie ustawisz po włączeniu powiadomień — są
            zapisywane razem z subskrypcją tego urządzenia.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const dirty = !unchanged(draft, saved);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ustawienia powiadomień</CardTitle>
        <CardDescription>
          Dotyczą tego urządzenia. Zapisane zmiany działają od najbliższego
          przebiegu agenta — nic nie trzeba wdrażać na nowo.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <fieldset disabled={!editing || saving} className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Minimalna trafność</p>
            <div className="flex flex-wrap gap-2">
              {THRESHOLDS.map((threshold) => (
                <Button
                  key={threshold}
                  size="sm"
                  variant={draft.minRelevance === threshold ? "default" : "outline"}
                  onClick={() =>
                    setDraft((current) => ({ ...current, minRelevance: threshold }))
                  }
                >
                  {threshold}+
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              5 to tylko przełomowe rzeczy, 2 przepuszcza prawie wszystko.
            </p>
          </div>

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
            <span className="text-muted-foreground text-xs">{describe(saved)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
