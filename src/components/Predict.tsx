import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Sparkles, X } from "lucide-react";

import { Ticks } from "~/components/VerifyBlock";
import { chime } from "~/lib/celebrate";
import { PREDICTIONS } from "~/lib/predictions";
import { mountRepoFigure, type RepoScene } from "~/lib/repoFigure";
import { strings } from "~/strings";
import { cn } from "~/lib/utils";

const key = (id: string) => `gg-predict:${id}`;

/**
 * Predict, then run it. Three small graphs; the learner picks one before they
 * touch the terminal. The right one lights green, a wrong pick red, and a
 * line says why, then points at their own live graph to watch it happen.
 */
export function Predict({ challengeId, locale }: { challengeId: string; locale: string }) {
  const t = strings(locale);
  const p = PREDICTIONS[challengeId];
  const [picked, setPicked] = useState<number | null>(() => {
    const v = localStorage.getItem(key(challengeId));
    return v === null ? null : Number(v);
  });
  if (!p) return null;

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    localStorage.setItem(key(challengeId), String(i));
    if (i === p!.answer) chime([783.99, 1046.5], 0.04);
  }

  const right = picked === p.answer;
  // One scale for all three, sized to the biggest, so a small option looks
  // small rather than zoomed in.
  const frame = {
    slots: Math.max(3, ...p.options.map((o) => o.scene.nodes.length)),
    lanes: Math.max(1, ...p.options.map((o) => Math.max(1, ...o.scene.nodes.map((n) => n.lane + 1)))),
    remote: p.options.some((o) => o.scene.remote),
  };

  return (
    <section className="alert-glass my-6 rounded-lg border p-4" data-variant={picked === null ? "info" : right ? "success" : "warning"}>
      <p className="flex items-center gap-1.5 font-bold text-[11px] text-info-foreground uppercase tracking-wide">
        <Sparkles className="size-3.5" />
        {t.predictEyebrow}
      </p>
      <p className="mt-1.5 font-medium text-[15px]">
        <Ticks text={p.ask} />
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {p.options.map((o, i) => {
          const isAnswer = i === p.answer;
          const state = picked === null ? "open" : isAnswer ? "right" : picked === i ? "wrong" : "other";
          return (
            <button
              key={o.label}
              type="button"
              // aria-disabled, not disabled: a disabled button swallows the
              // pointer, and the figures stay explorable after the answer.
              aria-disabled={picked !== null}
              onClick={() => pick(i)}
              data-state={state}
              className={cn(
                "gg-option group relative flex flex-col rounded-lg border-2 bg-card/50 p-1.5 pb-2.5 text-left transition-[border-color,background-color,opacity,translate] duration-200",
                picked !== null && "cursor-default",
                state === "open" && "cursor-pointer border-border hover:-translate-y-0.5 hover:border-primary/60",
                state === "right" && "border-success bg-success-surface",
                state === "wrong" && "gg-shake border-error bg-error-surface",
                state === "other" && "border-border opacity-55",
              )}
            >
              <Thumb scene={{ ...o.scene, frame }} frameKey={`${challengeId}-${i}`} />
              <span className="px-1 text-[12px] leading-snug">{o.label}</span>
              {(state === "right" || state === "wrong") && (
                <span
                  className={cn(
                    "gg-tick absolute top-2 right-2 grid size-5 place-items-center rounded-full text-white",
                    state === "right" ? "bg-success" : "bg-error",
                  )}
                >
                  {state === "right" ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <p className="gg-rise mt-3 text-sm" style={{ "--d": "80ms" } as CSSProperties}>
          <span className={cn("font-semibold", right ? "text-success-foreground" : "text-warning-foreground")}>
            {right ? t.predictRight : t.predictWrong}
          </span>{" "}
          <Ticks text={p.why} /> <span className="text-muted-foreground">{t.predictNow}</span>
        </p>
      )}
    </section>
  );
}

/**
 * A live hairline figure of one option: point at a commit and it rises with
 * its history, as on the learner's own board.
 */
function Thumb({ scene, frameKey }: { scene: RepoScene; frameKey: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!stage.current || !svg.current) return;
    return mountRepoFigure(stage.current, svg.current, scene, () => {});
    // The scene is rebuilt each render; the option it belongs to is frameKey.
  }, [frameKey]);
  return (
    <div ref={stage} data-hairline="predict" className="mb-1.5 w-full">
      <svg ref={svg} viewBox="0 0 400 320" aria-hidden="true" />
    </div>
  );
}
