import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, Clock, Flag, Layers, Lightbulb } from "lucide-react";

import { cardById } from "~/lib/cards";
import { cannons, chime, coinSound } from "~/lib/celebrate";
import { dismissWin, useWin, type Win } from "~/lib/moments";
import { navigate } from "~/lib/router";
import { isMilestone, week } from "~/lib/streak";
import { strings, type UiStrings } from "~/strings";
import { cn } from "~/lib/utils";

/**
 * The moment a challenge is completed, after Duolingo's post-lesson sequence:
 * a hero and "complete", three stat cards that slide up one after another and
 * count up, one Continue. On the first completion of the day a second screen
 * follows — the streak: a grey flame that catches, the number rolling over to
 * the new count, and the week drawn in. Confetti fires from both bottom
 * corners, Raycast's way. Bigger moments (a module, the course, a streak
 * milestone) get more of it, and nothing else does.
 */
export function Celebration({ locale }: { locale: string }) {
  const win = useWin();
  if (!win) return null;
  // Keyed so a second win never inherits the first one's screen. Portalled to
  // the body: the shell's content column is a containing block for `fixed`.
  return createPortal(<Sequence key={`${win.challengeId}-${win.course.after}`} win={win} locale={locale} />, document.body);
}

function Sequence({ win, locale }: { win: Win; locale: string }) {
  const t = strings(locale);
  const [screen, setScreen] = useState<"done" | "streak">("done");
  const [leaving, setLeaving] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const big = win.courseDone ? 2 : win.moduleDone ? 1.6 : 1;
    cannons(big);
    coinSound();
    // A module or the course: a second volley as the first one falls.
    const again = big > 1 ? window.setTimeout(() => cannons(big * 0.7), 900) : 0;
    return () => window.clearTimeout(again);
  }, [win]);

  useEffect(() => {
    if (screen !== "streak" || !win.streak) return;
    const lit = window.setTimeout(() => {
      chime([659.25, 880, 1318.51]);
      if (isMilestone(win.streak!.after)) cannons(1.4);
    }, 260);
    return () => window.clearTimeout(lit);
  }, [screen, win]);

  // Continue is the one action; Enter and Space reach it from anywhere.
  useEffect(() => {
    const id = window.setTimeout(() => continueRef.current?.focus({ focusVisible: false } as FocusOptions), 700);
    return () => window.clearTimeout(id);
  }, [screen]);

  function finish(go: boolean) {
    setLeaving(true);
    window.setTimeout(() => {
      dismissWin();
      if (!go || !win.next) return;
      if (win.next.kind === "finale") navigate({ name: "finale" });
      else navigate({ name: "challenge", id: win.next.id });
    }, 180);
  }

  function onContinue() {
    if (screen === "done" && win.streak) setScreen("streak");
    else finish(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gg-win-title"
      data-leaving={leaving || undefined}
      className="gg-win fixed inset-0 z-[150] flex items-center justify-center bg-background/85 p-6 backdrop-blur-lg"
      onKeyDown={(e) => {
        if (e.key === "Escape") finish(false);
      }}
    >
      <div key={screen} className="gg-win-screen flex w-full max-w-[440px] flex-col items-center text-center">
        {screen === "done" ? <Done win={win} t={t} /> : <Streak win={win} t={t} locale={locale} />}

        <button ref={continueRef} type="button" onClick={onContinue} className="gg-raised mt-9 w-full" style={{ "--d": "1150ms" } as CSSProperties}>
          {t.winContinue}
        </button>
        {!(screen === "done" && win.streak) && win.next && (
          <button
            type="button"
            onClick={() => finish(false)}
            className="gg-rise mt-3 text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
            style={{ "--d": "1250ms" } as CSSProperties}
          >
            {t.winStay}
          </button>
        )}
      </div>
    </div>
  );
}

// --- screen one: complete --------------------------------------------------

function Done({ win, t }: { win: Win; t: UiStrings }) {
  const title = win.courseDone ? t.winCourse : win.moduleDone ? t.winModule : t.winChallenge;
  const third =
    win.newCards.length > 0
      ? { label: t.winCards, icon: Layers, color: "var(--warning)", value: `+${win.newCards.length}`, to: win.newCards.length, from: 0 }
      : { label: t.winHints, icon: Lightbulb, color: "var(--warning)", value: String(win.hintsUsed), to: win.hintsUsed, from: 0 };

  return (
    <>
      <Hero win={win} />
      <h2 id="gg-win-title" className="gg-rise gg-win-title mt-6 font-extrabold text-3xl tracking-tight" style={{ "--d": "250ms" } as CSSProperties}>
        {title}
      </h2>
      <p className="gg-rise mt-1.5 text-muted-foreground text-sm" style={{ "--d": "330ms" } as CSSProperties}>
        {win.moduleDone ?? win.title}
      </p>

      <div className="mt-7 grid w-full grid-cols-3 gap-3">
        <Stat label={t.winCourse2} color="var(--success)" icon={Flag} delay={480}>
          <Count from={win.course.before} to={win.course.after} delay={900} format={(n) => `${n}/${win.course.total}`} />
        </Stat>
        <Stat label={t.winTime} color="var(--primary)" icon={Clock} delay={580}>
          <Count from={0} to={win.seconds} delay={1000} format={clock} />
        </Stat>
        <Stat label={third.label} color={third.color} icon={third.icon} delay={680}>
          <Count from={third.from} to={third.to} delay={1100} format={(n) => (win.newCards.length > 0 ? `+${n}` : String(n))} />
        </Stat>
      </div>

      {win.newCards.length > 0 && (
        <div className="gg-rise mt-4 flex flex-wrap justify-center gap-1.5" style={{ "--d": "900ms" } as CSSProperties}>
          {win.newCards.map((id) => (
            <code key={id} className="rounded-md border bg-card/80 px-1.5 py-0.5 font-mono text-[11px] [font-variant-ligatures:none]">
              {cardById(id)?.cmd}
            </code>
          ))}
        </div>
      )}
    </>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

/** The lesson's guide pops up in a ring of pixel sparks; a module gets the plumber and his coin. */
function Hero({ win }: { win: Win }) {
  const big = Boolean(win.moduleDone || win.courseDone);
  return (
    <div className="relative grid size-28 place-items-center">
      <div className="gg-halo absolute inset-0 rounded-full" />
      {SPARKS.map(([dx, dy], i) => (
        <span key={i} className="gg-spark absolute size-2" style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--d": `${120 + i * 25}ms` } as CSSProperties} />
      ))}
      {big ? (
        <div className="gg-pop relative">
          <img src="/brand/coin.svg" alt="" aria-hidden="true" width={34} height={34} className="gg-win-coin absolute -top-9 left-1/2" />
          <img src="/brand/mario.svg" alt="" aria-hidden="true" width={72} height={66} className="gg-win-plumber [image-rendering:pixelated]" />
        </div>
      ) : (
        <img
          src={`/mascots/${win.mascotId ?? "pixelArt"}.svg`}
          alt=""
          aria-hidden="true"
          className="gg-pop size-24 rounded-full border-4 border-success bg-card"
        />
      )}
    </div>
  );
}

const SPARKS: [number, number][] = [
  [-70, -38], [-58, 30], [-34, -66], [0, -78], [36, -64], [64, -30], [70, 26], [0, 74], [-40, 62], [44, 60],
];

function Stat({ label, color, icon: Icon, delay, children }: {
  label: string;
  color: string;
  icon: typeof Clock;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <div className="gg-stat gg-rise-bounce" style={{ "--c": color, "--d": `${delay}ms` } as CSSProperties}>
      <div className="gg-stat-head">{label}</div>
      <div className="gg-stat-body">
        <Icon className="size-4 shrink-0" strokeWidth={2.75} />
        {children}
      </div>
    </div>
  );
}

/** Counts from → to once the card has landed, easing out, as Duolingo's tickers do. */
function Count({ from, to, delay, format }: { from: number; to: number; delay: number; format: (n: number) => string }) {
  const [n, setN] = useState(from);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const dur = Math.min(900, 250 + Math.abs(to - from) * 60);
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / dur));
      setN(from + (to - from) * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay]);
  return <span className="tabular-nums">{format(Math.round(n))}</span>;
}

// --- screen two: the streak ------------------------------------------------

function Streak({ win, t, locale }: { win: Win; t: UiStrings; locale: string }) {
  const s = win.streak!;
  const days = week(s.days);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const message = isMilestone(s.after) ? t.streakMilestone : s.after === 1 ? t.streakFirst : t.streakKeep;

  // The run of done days that ends today, so the line joins only real neighbours.
  const runs = days.map((d, i) => d.done && i > 0 && days[i - 1].done);

  return (
    <>
      <div className="relative grid size-36 place-items-center">
        <div className="gg-flash absolute size-24 rounded-full" />
        {SPARKS.slice(0, 8).map(([dx, dy], i) => (
          <span key={i} className="gg-ember absolute size-1.5" style={{ "--dx": `${dx * 1.1}px`, "--dy": `${dy * 1.1}px`, "--d": `${300 + i * 20}ms` } as CSSProperties} />
        ))}
        <Flame />
      </div>

      <div className="-mt-1 flex items-baseline gap-2">
        <Roll from={s.before} to={s.after} />
      </div>
      <p id="gg-win-title" className="gg-rise font-bold text-warning text-lg uppercase tracking-wide" style={{ "--d": "650ms" } as CSSProperties}>
        {t.streakLabel}
      </p>

      <div className="gg-rise panel-glass mt-6 w-full rounded-2xl border px-4 py-3.5" style={{ "--d": "760ms" } as CSSProperties}>
        <div className="relative grid grid-cols-7 gap-1">
          {days.map((d, i) => (
            <div key={d.date.toISOString()} className="flex flex-col items-center gap-1.5">
              <span className={cn("font-bold text-[11px]", d.isToday ? "text-warning" : "text-muted-foreground")}>
                {fmt.format(d.date)}
              </span>
              <span className="relative grid h-7 w-full place-items-center">
                {runs[i] && <span className="gg-streak-link absolute top-1/2 right-1/2 h-1.5 w-full -translate-y-1/2" style={{ "--d": `${950 + i * 60}ms` } as CSSProperties} />}
                <span
                  className={cn("tile relative grid size-7 place-items-center", d.done ? "gg-day-done" : "bg-muted-foreground/15", d.isToday && "gg-day-today")}
                  style={{ "--d": `${900 + i * 60}ms` } as CSSProperties}
                >
                  {d.done && <Check className="size-3.5 text-white" strokeWidth={3.5} />}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="gg-rise mt-5 text-muted-foreground text-sm" style={{ "--d": "1050ms" } as CSSProperties}>
        {message.replace("{n}", String(s.after)).replace("{next}", String(s.after + 1))}
      </p>
    </>
  );
}

/** The old count rolls up and out as the new one rolls in from below. */
function Roll({ from, to }: { from: number; to: number }) {
  return (
    <span className="gg-roll relative inline-grid h-[1.1em] overflow-hidden font-black text-7xl text-warning tabular-nums leading-none">
      <span className="gg-roll-out col-start-1 row-start-1">{from}</span>
      <span className="gg-roll-in col-start-1 row-start-1">{to}</span>
    </span>
  );
}

/** A pixel flame: grey and still until it catches. */
const FLAME = [
  ".....a......",
  ".....aa.....",
  "....aaa.....",
  "....aaaa..a.",
  "...aaaaa..a.",
  "...aaabaa.aa",
  "..aaabbaaaaa",
  "..aabbbbaaaa",
  ".aaabbccbaaa",
  ".aabbcccbbaa",
  ".aabcccccbaa",
  ".aabcccccba.",
  "..abbcccbba.",
  "...aabbbaa..",
];

function Flame() {
  return (
    <svg viewBox="0 0 12 14" width={84} height={98} shapeRendering="crispEdges" className="gg-flame relative" aria-hidden="true">
      {FLAME.flatMap((row, y) =>
        [...row].map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} className={`gg-flame-${c}`} />)),
      )}
    </svg>
  );
}
