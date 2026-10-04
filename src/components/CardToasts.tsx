import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { CommandCard, MODULE_COLOR } from "~/components/CommandCard";
import { cardById } from "~/lib/cards";
import { coinSound } from "~/lib/celebrate";
import { dismissToast, useCardToasts, type CardToast } from "~/lib/moments";
import { navigate } from "~/lib/router";
import { strings } from "~/strings";

const SHOW_MS = 5200;

/**
 * Bottom-right: a card turns over as it is collected, with the coin sound.
 * The first scan of a long history arrives as one note with a small fan of
 * cards rather than twenty toasts. Clicking opens the deck.
 */
export function CardToasts({ locale }: { locale: string }) {
  const toasts = useCardToasts();
  return createPortal(
    <div className="pointer-events-none fixed right-5 bottom-5 z-[140] flex w-[320px] flex-col gap-2">
      {toasts.slice(-3).map((toast) => (
        <Toast key={toast.key} toast={toast} locale={locale} />
      ))}
    </div>,
    document.body,
  );
}

function Toast({ toast, locale }: { toast: CardToast; locale: string }) {
  const t = strings(locale);
  const [leaving, setLeaving] = useState(false);
  const [held, setHeld] = useState(false);
  const cards = toast.ids.map(cardById).filter((c) => c !== undefined);
  const first = cards[0];

  useEffect(() => {
    if (!toast.backlog) coinSound(0.035);
  }, [toast]);

  useEffect(() => {
    if (held) return;
    const out = window.setTimeout(() => setLeaving(true), SHOW_MS);
    return () => window.clearTimeout(out);
  }, [held]);

  useEffect(() => {
    if (!leaving) return;
    const gone = window.setTimeout(() => dismissToast(toast.key), 220);
    return () => window.clearTimeout(gone);
  }, [leaving, toast.key]);

  if (!first) return null;
  const single = cards.length === 1 && !toast.backlog;

  return (
    <button
      type="button"
      data-leaving={leaving || undefined}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onClick={() => {
        navigate({ name: "deck" });
        setLeaving(true);
      }}
      className="gg-toast panel-glass pointer-events-auto flex items-center gap-3 rounded-xl border p-3 text-left"
    >
      <div className="relative h-[74px] w-14 shrink-0 [perspective:600px]">
        {cards.slice(0, 3).map((c, i) => (
          <CommandCard
            key={c.id}
            card={c}
            collected
            size="sm"
            className="gg-card-flip absolute top-0 left-0"
            style={{ "--d": `${120 + i * 90}ms`, rotate: `${(i - Math.min(2, cards.length - 1) / 2) * 9}deg`, zIndex: 3 - i } as CSSProperties}
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="font-extrabold text-[11px] uppercase tracking-wide" style={{ color: MODULE_COLOR[first.module] }}>
          {single ? t.cardNew : t.cardsNew.replace("{n}", String(cards.length))}
        </p>
        {single ? (
          <>
            <code className="mt-0.5 block font-bold font-mono text-sm [font-variant-ligatures:none]">{first.cmd}</code>
            <p className="text-muted-foreground text-xs">{first.does}</p>
          </>
        ) : (
          <p className="mt-0.5 text-sm">
            {toast.backlog ? t.cardsBacklog.replace("{n}", String(cards.length)) : cards.map((c) => c.cmd).join(", ")}
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">{t.cardsOpenDeck}</p>
      </div>
    </button>
  );
}
