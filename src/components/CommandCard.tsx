import { useRef, type CSSProperties } from "react";

import type { Card } from "~/lib/cards";
import { cn } from "~/lib/utils";

/** One colour per module, from the same Duolingo palette as the celebration. */
export const MODULE_COLOR: Record<Card["module"], string> = {
  terminal: "#1cb0f6",
  files: "#ce82ff",
  git: "#f05033",
};

/**
 * A command card, after Oh My Git!'s: the command, an icon and what it does,
 * framed in its module's colour with stepped pixel corners. Face down until
 * collected. `tilt` makes it lean toward the pointer with a glare across it,
 * the way a foil trading card catches the light.
 */
export function CommandCard({
  card,
  collected,
  size = "md",
  tilt = false,
  note,
  className,
  style,
}: {
  card: Card;
  collected: boolean;
  size?: "sm" | "md";
  tilt?: boolean;
  /** Small print at the foot: when it was collected, or where it is taught. */
  note?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const Icon = card.icon;
  const sm = size === "sm";

  function lean(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || !tilt) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
  }
  function rest() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={ref}
      onPointerMove={lean}
      onPointerLeave={rest}
      data-collected={collected || undefined}
      data-tilt={tilt || undefined}
      className={cn("gg-card", sm ? "w-14" : "w-[148px]", className)}
      style={{ "--m": MODULE_COLOR[card.module], ...style } as CSSProperties}
    >
      <div className="gg-card-frame">
        {collected ? (
          <div className="gg-card-face">
            <div className={cn("gg-card-art", sm ? "h-full border-b-0" : "h-[86px]")}>
              <Icon className={sm ? "size-5" : "size-10"} strokeWidth={sm ? 2.25 : 1.75} />
            </div>
            {!sm && (
              <div className="px-2.5 pt-2 pb-2.5 text-left">
                <code className="block truncate font-bold font-mono text-[13px] text-foreground [font-variant-ligatures:none]">
                  {card.cmd}
                </code>
                <p className="mt-1 min-h-[2lh] text-[11px] text-muted-foreground leading-snug">{card.does}</p>
                {note && <p className="mt-2 text-[10px] text-muted-foreground/80 tabular-nums">{note}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="gg-card-back">
            <span className={cn("font-black", sm ? "text-base" : "text-4xl")} style={{ color: "var(--m)" }}>?</span>
            {!sm && note && <p className="absolute inset-x-2 bottom-2.5 text-center text-[10px] text-muted-foreground leading-snug">{note}</p>}
          </div>
        )}
        {tilt && collected && <div className="gg-card-glare" />}
      </div>
    </div>
  );
}
