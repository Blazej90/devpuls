"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TOPICS = [
  { id: "typescript", label: "TypeScript" },
  { id: "react", label: "React" },
  { id: "javascript", label: "JavaScript" },
  { id: "fullstack", label: "Fullstack" },
  { id: "ai", label: "AI" },
  { id: "other", label: "Inne" },
] as const;

const THRESHOLDS = [2, 3, 4, 5] as const;

/**
 * The settings are stored with the subscription, not in localStorage — it is
 * the agent that decides what to send and it has to see them on its side.
 * The component only shows up once a subscription exists.
 */
export function PushSettings() {
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [minRelevance, setMinRelevance] = useState(4);
  const [topics, setTopics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /**
   * State mirrored in refs. Two clicks within the same React tick would read
   * the same stale state from the closure and the second would overwrite the
   * first (observed: selecting a category dropped the previous one). A ref
   * always sees the current value.
   */
  const thresholdRef = useRef(4);
  const topicsRef = useRef<string[]>([]);

  /**
   * The write queue. The arrival order of HTTP requests is not guaranteed —
   * on a Neon cold start the first PATCH can land after the second and
   * overwrite newer state with older. A promise chain sends them in order.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!("serviceWorker" in navigator)) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription || cancelled) return;

      const response = await fetch("/api/push/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      if (!response.ok || cancelled) return;

      const data = (await response.json()) as {
        minRelevance: number;
        topics: string[] | null;
      };

      if (cancelled) return;
      thresholdRef.current = data.minRelevance;
      topicsRef.current = data.topics ?? [];
      setEndpoint(subscription.endpoint);
      setMinRelevance(data.minRelevance);
      setTopics(data.topics ?? []);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    (nextThreshold: number, nextTopics: string[]) => {
      if (!endpoint) return;

      setSaving(true);
      setSaved(false);

      queue.current = queue.current.then(async () => {
        try {
          const response = await fetch("/api/push/settings", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              endpoint,
              minRelevance: nextThreshold,
              // An empty list = no filter, which is how the endpoint reads it too.
              topics: nextTopics.length > 0 ? nextTopics : null,
            }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          setSaved(true);
        } catch (error: unknown) {
          console.error("[settings] write failed", error);
        } finally {
          setSaving(false);
        }
      });
    },
    [endpoint],
  );

  const setThreshold = (threshold: number) => {
    thresholdRef.current = threshold;
    setMinRelevance(threshold);
    save(threshold, topicsRef.current);
  };

  const toggleTopic = (id: string) => {
    const current = topicsRef.current;
    const next = current.includes(id)
      ? current.filter((topic) => topic !== id)
      : [...current, id];

    topicsRef.current = next;
    setTopics(next);
    save(thresholdRef.current, next);
  };

  if (!endpoint) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ustawienia powiadomień</CardTitle>
        <CardDescription>
          Zmiany działają od najbliższego przebiegu agenta — nic nie trzeba
          wdrażać na nowo.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Minimalna trafność</p>
          <div className="flex flex-wrap gap-2">
            {THRESHOLDS.map((threshold) => (
              <Button
                key={threshold}
                size="sm"
                variant={minRelevance === threshold ? "default" : "outline"}
                onClick={() => setThreshold(threshold)}
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
              const selected = topics.includes(topic.id);
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
            {topics.length === 0
              ? "Nic nie zaznaczone = wszystkie kategorie."
              : `Powiadomienia tylko z ${topics.length} wybranych kategorii.`}
          </p>
        </div>

        <p
          className={cn(
            "text-xs transition-opacity",
            saving || saved ? "opacity-100" : "opacity-0",
          )}
        >
          {saving ? "Zapisuję…" : "Zapisano."}
        </p>
      </CardContent>
    </Card>
  );
}
