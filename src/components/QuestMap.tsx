import { Check } from "lucide-react";

import { challengeTitle, grouped, moduleTitle } from "~/challenges";
import { href } from "~/lib/router";
import { cn } from "~/lib/utils";

/**
 * Course progress as one row of squares per module, the way GitHub's
 * contribution graph fills in: green for done, an outlined square for the
 * next one, with the plumber standing on it. Rows per module rather than one
 * wrapping block, so the break between modules never moves with the window.
 */
export function QuestMap({ completed, current, locale }: {
  completed: Record<string, boolean>;
  /** Index of the next challenge to do; past the end when all are done. */
  current: number;
  locale: string;
}) {
  return (
    <div className="space-y-[18px] pt-3">
      {grouped().map(({ module, items }) => {
        const done = items.filter(({ challenge }) => completed[challenge.id]).length;
        return (
          <div key={module.id} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{moduleTitle(module, locale)}</span>
            <ol className="flex flex-wrap gap-1.5">
              {items.map(({ challenge, index }) => {
                const ok = Boolean(completed[challenge.id]);
                const here = index === current;
                return (
                  <li key={challenge.id} className="relative">
                    {here && (
                      <img
                        src="/brand/mario.svg"
                        alt=""
                        aria-hidden="true"
                        width={18}
                        height={17}
                        className="map-walker pointer-events-none absolute -top-[17px] left-1/2"
                      />
                    )}
                    <a
                      href={href({ name: "challenge", id: challenge.id })}
                      title={`${index + 1}. ${challengeTitle(challenge, locale)}`}
                      aria-current={here ? "step" : undefined}
                      className={cn(
                        "tile flex size-6 items-center justify-center text-[10px] tabular-nums transition-colors",
                        ok && "bg-success text-white",
                        here && "bg-primary/20 text-foreground shadow-[inset_0_0_0_2px_var(--primary)]",
                        !ok && !here && "bg-muted-foreground/12 text-muted-foreground hover:bg-muted-foreground/25 hover:text-foreground",
                      )}
                    >
                      {ok ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                    </a>
                  </li>
                );
              })}
            </ol>
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {done}/{items.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}
