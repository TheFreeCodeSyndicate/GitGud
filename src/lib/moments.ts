import { useSyncExternalStore } from "react";

/**
 * The app's two kinds of reward moment, as a module store like `headerTitle`:
 * the full-screen celebration when a challenge is completed, and the small
 * card that slides in when a command card is collected. Producers (the verify
 * box, the card collector) and the hosts that draw them sit far apart in the
 * tree; nothing in between needs to know.
 */

export interface Win {
  challengeId: string;
  title: string;
  mascotId?: string;
  /** Set when this completed the last challenge of a module. */
  moduleDone?: string;
  /** Set when this completed the whole course. */
  courseDone?: boolean;
  course: { before: number; after: number; total: number };
  /** Time spent on the challenge this visit. */
  seconds: number;
  hintsUsed: number;
  newCards: string[];
  /** Only when this was the first completion today: the streak screen. */
  streak?: { before: number; after: number; days: string[] };
  /** Where Continue goes. */
  next: { kind: "challenge"; id: string } | { kind: "finale" } | null;
}

export interface CardToast {
  key: number;
  ids: string[];
  /** First scan of an existing history: many at once, said as one line. */
  backlog: boolean;
}

let win: Win | null = null;
let toasts: CardToast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function celebrate(next: Win) {
  win = next;
  emit();
}

export function dismissWin() {
  win = null;
  emit();
}

export const useWin = () => useSyncExternalStore(subscribe, () => win, () => null);

export function announceCards(ids: string[], backlog = false) {
  if (ids.length === 0) return;
  toasts = [...toasts, { key: ++seq, ids, backlog }];
  emit();
}

export function dismissToast(key: number) {
  toasts = toasts.filter((t) => t.key !== key);
  emit();
}

export const useCardToasts = () => useSyncExternalStore(subscribe, () => toasts, () => toasts);
