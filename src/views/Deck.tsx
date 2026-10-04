import type { CSSProperties } from "react";

import { byId, challengeTitle, MODULES, moduleTitle } from "~/challenges";
import { CommandCard, MODULE_COLOR } from "~/components/CommandCard";
import { CARDS } from "~/lib/cards";
import { useProgress } from "~/lib/progress";
import { strings } from "~/strings";

/** The deck: every card, by module, face up once played. */
export function Deck({ locale }: { locale: string }) {
  const t = strings(locale);
  const { progress } = useProgress();
  const have = progress.cards;
  const count = CARDS.filter((c) => have[c.id]).length;
  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-semibold text-2xl tracking-tight">{t.deckTitle}</h1>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{t.deckIntro}</p>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-[width] duration-700" style={{ width: `${(count / CARDS.length) * 100}%` }} />
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t.deckCount.replace("{n}", String(count)).replace("{total}", String(CARDS.length))}
        </span>
      </div>

      {MODULES.map((m) => {
        const cards = CARDS.filter((c) => c.module === m.id);
        const got = cards.filter((c) => have[c.id]).length;
        return (
          <section key={m.id} className="mt-9">
            <h2 className="flex items-baseline gap-2 font-bold text-[13px] uppercase tracking-wide" style={{ color: MODULE_COLOR[m.id as keyof typeof MODULE_COLOR] }}>
              {moduleTitle(m, locale)}
              <span className="font-medium text-muted-foreground text-xs normal-case tabular-nums tracking-normal">
                {got}/{cards.length}
              </span>
            </h2>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {cards.map((c, i) => {
                const at = have[c.id];
                const lesson = byId(c.taught);
                return (
                  <CommandCard
                    key={c.id}
                    card={c}
                    collected={Boolean(at)}
                    tilt
                    className="gg-rise w-full"
                    style={{ "--d": `${i * 40}ms` } as CSSProperties}
                    note={
                      at
                        ? t.deckCollected.replace("{date}", date.format(new Date(`${at}T12:00:00`)))
                        : t.deckTaughtIn.replace("{title}", lesson ? challengeTitle(lesson, locale) : "")
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
