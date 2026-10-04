import { useEffect } from "react";

import { playedCards } from "~/lib/cards";
import { announceCards } from "~/lib/moments";
import { canAutoSave, currentProgress, hydrated, useProgress } from "~/lib/progress";
import { shellHistory } from "~/lib/shell";

/** When each card was collected this session, for "new cards" on a win. */
const collectedAt = new Map<string, number>();
let scanning: Promise<string[]> | null = null;
let collect: ((ids: string[]) => void) | null = null;

/**
 * Read the history once and collect anything new. Concurrent calls share one
 * read. The very first scan of a history that already holds many commands is
 * a backlog, not a string of discoveries, so it is announced as one line.
 */
export function scanCards(): Promise<string[]> {
  scanning ??= (async () => {
    try {
      await hydrated;
      if (!canAutoSave()) return [];
      const have = currentProgress().cards;
      const fresh = playedCards(await shellHistory()).filter((id) => !have[id]);
      if (fresh.length && collect) {
        collect(fresh);
        const now = Date.now();
        for (const id of fresh) collectedAt.set(id, now);
        announceCards(fresh, Object.keys(have).length === 0 && fresh.length > 2);
      }
      return fresh;
    } catch {
      return [];
    } finally {
      scanning = null;
    }
  })();
  return scanning;
}

/** Cards collected since `since` (ms), this session. */
export function cardsSince(since: number): string[] {
  return [...collectedAt].filter(([, at]) => at >= since).map(([id]) => id);
}

// ponytail: polls the history files every 4 s while the window is visible; a file watcher would be instant.
const POLL_MS = 4000;

/** Mounted once at the root: keeps the deck in step with the terminal. */
export function useCardCollector() {
  const { collectCards } = useProgress();
  collect = collectCards;

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void scanCards();
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, []);
}
