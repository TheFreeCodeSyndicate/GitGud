import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Check, Circle, FolderOpen, Lightbulb, Loader2, RotateCcw, Sparkles, X } from "lucide-react";

import { CHALLENGES, challengeTitle, indexOf, moduleOf, moduleTitle, type Challenge } from "~/challenges";
import { cardsSince, scanCards } from "~/lib/cardCollector";
import { celebrate, type Win } from "~/lib/moments";
import { currentProgress, today, useProgress, type Progress } from "~/lib/progress";
import { streakLength } from "~/lib/streak";
import { HINTS, recentTypo, type Typo } from "~/lib/hints";
import { describeChanges, snapshot, type RepoSnapshot } from "~/lib/repoState";
import { shellHistory } from "~/lib/shell";
import { passed, toneOf, verifierFor, type CheckResult, type ResultTone } from "~/lib/verify";
import { strings, type UiStrings } from "~/strings";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * How each result state is coloured. Optional checks stay quieter than
 * required ones either way — they are encouragement, not a gate — but a
 * satisfied one has to look satisfied.
 */
const TONE: Record<ResultTone, string> = {
  done: "text-success-foreground",
  failed: "bg-error-surface text-error-foreground",
  "optional-done": "text-success-foreground/85",
  "optional-todo": "text-muted-foreground",
};

/**
 * The directory prompt in the learner's language. The English fallback lives
 * on the challenge itself; these two terminal challenges are the only ones
 * that override the default "repository folder" wording.
 */
function localizedDirPrompt(id: string, t: UiStrings): string | undefined {
  if (id === "you_are_here") return t.dirPromptHome;
  if (id === "make_it_so") return t.dirPromptPractice;
  return undefined;
}

/** Renders `inline code` in check messages and hints as code. */
export function Ticks({ text }: { text: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/).map((part, i) =>
        i % 2 ? (
          <code key={i} className="rounded bg-muted px-1 py-px font-mono text-[0.9em] [font-variant-ligatures:none]">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * The repository as it was at the learner's last passing check, so "what
 * changed" covers everything since then — including work done before this
 * lesson was opened. Kept per folder; seeded from the lesson-open state.
 */
const baselineKey = (dir: string) => `gg-baseline:${dir}`;
function readBaseline(dir: string): RepoSnapshot | null {
  try {
    return JSON.parse(localStorage.getItem(baselineKey(dir)) ?? "null");
  } catch {
    return null;
  }
}
const writeBaseline = (dir: string, s: RepoSnapshot) => localStorage.setItem(baselineKey(dir), JSON.stringify(s));

/**
 * Challenges whose checks only read this computer — the folder, Git's own
 * files, the shell history — and so can run every few seconds while the
 * learner works, ticking steps off without a click. The rest ask GitHub's API
 * or fetch from a remote, which is slow and rate-limited, and stay on the
 * button.
 */
const LIVE = new Set([
  "meet_the_terminal",
  "command_performance",
  "you_are_here",
  "there_and_back_again",
  "make_it_so",
  "get_git",
  "repository",
  "commit_to_it",
  "remote_control",
  "forks_and_clones",
  "branches_arent_just_for_birds",
]);
// ponytail: a 2.5 s poll; a file watcher on the folder and history files would be instant.
const LIVE_MS = 2500;
const STUCK_MS = 60_000;

/** What the celebration shows, worked out from progress before and after the pass. */
async function winFor(challenge: Challenge, before: Progress, after: Progress, openedAt: number, hintsUsed: number, locale: string, mascotId?: string): Promise<Win> {
  await scanCards();
  const total = CHALLENGES.length;
  const count = (p: Progress) => CHALLENGES.filter((c) => p.completed[c.id]).length;
  const inModule = CHALLENGES.filter((c) => c.module === challenge.module);
  const moduleDone = inModule.every((c) => after.completed[c.id]) && !inModule.every((c) => before.completed[c.id]);
  const courseDone = count(after) === total;
  const firstToday = !before.days.includes(today());
  const index = indexOf(challenge.id);
  const nextId = CHALLENGES.slice(index + 1).find((c) => !after.completed[c.id])?.id ?? CHALLENGES.find((c) => !after.completed[c.id])?.id;
  const mod = moduleOf(challenge);
  return {
    challengeId: challenge.id,
    title: challengeTitle(challenge, locale),
    mascotId,
    moduleDone: moduleDone && mod ? moduleTitle(mod, locale) : undefined,
    courseDone,
    course: { before: count(before), after: count(after), total },
    seconds: Math.max(1, Math.round((Date.now() - openedAt) / 1000)),
    hintsUsed,
    newCards: cardsSince(openedAt),
    streak: firstToday ? { before: streakLength(before.days), after: streakLength(after.days), days: after.days } : undefined,
    next: courseDone ? { kind: "finale" } : nextId ? { kind: "challenge", id: nextId } : null,
  };
}

/**
 * The verify box. Replaces git-it-electron's `verify-button.html` /
 * `verify-directory-button.html` partials plus `challenge.js` and
 * `challenge-completed.js`.
 *
 * The original disabled the verify button permanently once a challenge passed
 * and re-enabled it only via "clear status", which meant a user who fixed
 * something could not simply re-check. Here the button stays live; completion
 * is a result, not a lock.
 */
export function VerifyBlock({
  challenge,
  locale,
  mascotId,
}: {
  challenge: Challenge;
  locale: string;
  /** The lesson's guide, who delivers the hints. */
  mascotId?: string;
}) {
  const t = strings(locale);
  const { progress, isComplete, setCompleted, setSavedDir } = useProgress();

  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathWarning, setPathWarning] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [typo, setTypo] = useState<Typo | null>(null);
  const [changes, setChanges] = useState<string[]>([]);
  /** Whether the shown results came from the button, which may show failures in red. */
  const [manual, setManual] = useState(false);
  const openedAt = useRef(Date.now());
  const busy = useRef(false);
  const lastKey = useRef("");

  const verifier = verifierFor(challenge.id);
  const done = isComplete(challenge.id);
  const dir = progress.savedDir;
  const tracksRepo = challenge.needsDirectory && challenge.module === "git";
  const hints = HINTS[challenge.id];
  const live = LIVE.has(challenge.id) && !done && (!challenge.needsDirectory || Boolean(dir));
  // While checks run on their own, help waits until the learner has been at it
  // a while, or asks with the button: a hint before you've started is noise.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setStuck(true), STUCK_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Seed the baseline the first time a folder is seen — and again when the
  // folder was deleted and made anew, or its history went backwards, since a
  // baseline from a different repository would describe changes that never
  // happened.
  useEffect(() => {
    if (!tracksRepo || !dir) return;
    snapshot(dir)
      .then((now) => {
        const was = readBaseline(dir);
        if (!was || !now.repo || now.commits < was.commits) writeBaseline(dir, now);
      })
      .catch(() => {});
  }, [tracksRepo, dir]);

  async function pickDirectory() {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string") {
      setSavedDir(picked);
      setPathWarning(false);
    }
  }

  async function check(byHand: boolean) {
    if (challenge.needsDirectory && !dir) {
      if (byHand) setPathWarning(true);
      return;
    }
    if (busy.current) return;
    busy.current = true;

    if (byHand) {
      setRunning(true);
      setError(null);
      setResults(null);
      setChanges([]);
      setTypo(null);
    }

    try {
      const out = await verifier!({
        path: dir ?? undefined,
        invitedFriend: progress.invitedFriend,
      });
      // A silent check that found nothing new should not re-render the list.
      const key = JSON.stringify(out);
      const changed = key !== lastKey.current;
      if (byHand || changed) {
        lastKey.current = key;
        setResults(out);
        setManual(byHand);
      }
      // Only ever set completion to true here. A previously-passed challenge
      // must not silently un-complete because the user moved a folder.
      if (passed(out)) {
        const before = currentProgress();
        const first = !before.completed[challenge.id];
        setCompleted(challenge.id, true);
        setManual(true);
        // A nicety on top of a pass — never let it turn the pass into an error.
        if (tracksRepo && dir) {
          const after = await snapshot(dir).catch(() => null);
          const was = readBaseline(dir);
          if (after && was) setChanges(describeChanges(was, after));
          if (after) writeBaseline(dir, after);
        }
        if (first) celebrate(await winFor(challenge, before, currentProgress(), openedAt.current, hintLevel, locale, mascotId));
      } else if (byHand || changed) {
        setTypo(recentTypo(await shellHistory().catch(() => [])));
      }
    } catch (e) {
      if (byHand) setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      if (byHand) setRunning(false);
    }
  }

  // Live: check quietly while the window is visible, until the challenge passes.
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === "visible") void checkRef.current(false);
    };
    tick();
    const id = window.setInterval(tick, LIVE_MS);
    return () => window.clearInterval(id);
  }, [live, dir]);

  if (!verifier) {
    return (
      <div className="my-6 rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
        {t.noCheck}
      </div>
    );
  }

  return (
    <section
      data-variant={done ? "success" : undefined}
      className={cn(
        "alert-glass my-6 rounded-lg border p-4 transition-colors",
        done ? "border-success/32" : "border-primary/32",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {challenge.needsDirectory && (
          <Button
            onClick={pickDirectory}
            disabled={running}
            variant="outline"
          >
            <FolderOpen className="size-4" />
            {dir ? t.changeDirectory : t.selectDirectory}
          </Button>
        )}

        <Button
          onClick={() => void check(true)}
          disabled={running}
          variant="default"
        >
          {running && <Loader2 className="size-4 animate-spin" />}
          {running ? t.checking : done ? t.checkAgain : t.verify}
        </Button>

        {live && (
          <span className="ml-1 flex items-center gap-1.5 text-muted-foreground text-xs">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
              <span className="relative size-2 rounded-full bg-success" />
            </span>
            {t.liveWatching}
          </span>
        )}

        {done && (
          <Button
            onClick={() => {
              setCompleted(challenge.id, false);
              setResults(null);
              lastKey.current = "";
            }}
            variant="ghost"
          >
            <RotateCcw className="size-3.5" />
            {t.clearStatus}
          </Button>
        )}
      </div>

      {challenge.needsDirectory && (
        <p
          className={cn(
            "mt-2 break-all font-mono text-xs",
            pathWarning ? "text-error-foreground" : "text-muted-foreground",
          )}
        >
          {dir ?? localizedDirPrompt(challenge.id, t) ?? challenge.dirPrompt ?? t.pathRequired}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-error-surface px-2 py-1.5 text-error-foreground text-sm">
          {error}
        </p>
      )}

      {results && (
        <ul className="mt-3 space-y-1">
          {results.map((result, i) => (
            <li
              key={`${result.message}-${i}`}
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-300",
                // Before the learner asks, an unmet step is a to-do, not a failure.
                !manual && !result.passed ? TONE["optional-todo"] : TONE[toneOf(result)],
              )}
            >
              {/* An optional check that was satisfied gets a tick like any
                  other. Drawing it as a hollow circle made a check that had
                  passed look like one that had never been read. */}
              {result.passed ? (
                <Check key="done" className="gg-tick mt-0.5 size-4 shrink-0" />
              ) : result.optional || !manual ? (
                <Circle className="mt-0.5 size-4 shrink-0" />
              ) : (
                <X className="mt-0.5 size-4 shrink-0" />
              )}
              <span>
                <Ticks text={result.message} />
                {result.optional && ` ${t.optionalSuffix}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {changes.length > 0 && (
        <div className="mt-3 rounded-md border border-success/24 bg-success-surface/40 px-3 py-2 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-success-foreground">
            <Sparkles className="size-3.5" />
            {t.whatChanged}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-foreground/90">
            {changes.map((c) => (
              <li key={c}>
                <Ticks text={c} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {results && !passed(results) && (manual || stuck) && (typo || hints) && (
        <div className="mt-3 flex items-start gap-3 rounded-md border bg-card/60 p-3">
          {mascotId && (
            <img
              src={`/mascots/${mascotId}.svg`}
              alt=""
              aria-hidden="true"
              className="size-9 shrink-0 rounded-full border bg-card"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            {typo && (
              <p>
                {t.typoPrefix} <code className="rounded bg-error-surface px-1 font-mono text-error-foreground">{typo.typed}</code>{" "}
                — {t.typoMeant} <code className="rounded bg-muted px-1 font-mono">{typo.meant}</code>?
              </p>
            )}
            {hints?.slice(0, hintLevel).map((h, i) => (
              <p key={i}>
                <span className="mr-1.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {t.hintLevels[i]}
                </span>
                <Ticks text={h} />
              </p>
            ))}
            {hints && hintLevel < hints.length && (
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setHintLevel((n) => n + 1)}>
                <Lightbulb className="size-3.5" />
                {hintLevel === 0 ? t.hintAsk : t.hintMore}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
