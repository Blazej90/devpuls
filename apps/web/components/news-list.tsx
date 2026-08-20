import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NewsItem } from "@/lib/items";

/** Etykiety kategorii zwracanych przez `packages/agent/src/claude.ts`. */
const TOPIC_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  react: "React",
  javascript: "JavaScript",
  fullstack: "Fullstack",
  ai: "AI",
  inne: "Inne",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return null;
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function RelevanceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  // Piątka to must-read — wyróżniamy ją, reszta zostaje stonowana.
  return (
    <Badge variant={score >= 5 ? "default" : "secondary"}>
      Trafność {score}
    </Badge>
  );
}

export function NewsList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Jeszcze nic nie ma</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Agent nie zebrał dotąd żadnych wpisów powyżej progu. Pierwsze pojawią się
          po najbliższym przebiegu harmonogramu.
        </CardContent>
      </Card>
    );
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const date = formatDate(item.publishedAt);

        return (
          <li key={item.id}>
            <Card className="transition-colors hover:border-foreground/20">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <RelevanceBadge score={item.relevance} />
                  {item.topics?.map((topic) => (
                    <Badge key={topic} variant="outline">
                      {TOPIC_LABELS[topic] ?? topic}
                    </Badge>
                  ))}
                </div>

                <CardTitle className="text-base leading-snug">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1.5 hover:underline"
                  >
                    {item.title}
                    <ExternalLink
                      className="mt-1 size-3.5 shrink-0 opacity-60"
                      aria-hidden
                    />
                  </a>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {item.summaryPl && (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.summaryPl}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  {item.sourceName}
                  {date && ` · ${date}`}
                </p>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
