import { useEffect, useRef, useState } from "react";
import { GitBranch, History } from "lucide-react";

import { Ticks } from "~/components/VerifyBlock";
import { runGit } from "~/lib/git";
import { mountRepoFigure, type Ghost } from "~/lib/repoFigure";
import { layout, recentCommits, snapshot, type GraphEdge, type PlacedCommit } from "~/lib/repoState";
import { strings } from "~/strings";
import { cn } from "~/lib/utils";

const ROW = 26;
// Enough history to read at a glance; past a dozen the figure's commits get too small.
const LIMIT = 12;
// ponytail: polls git every 2s while visible; swap for a `notify` watcher on .git if it ever shows up in a profile.
const POLL_MS = 2000;

interface View {
  repo: boolean;
  head: string;
  /** Commits reachable from HEAD, all of them, not just the ones drawn. */
  commits: number;
  dirty: number;
  nodes: PlacedCommit[];
  edges: GraphEdge[];
  lanes: number;
  /** Hashes some remote has, or null when there are no remotes. */
  remote: string[] | null;
}

async function read(dir: string): Promise<View> {
  const [snap, commits] = await Promise.all([snapshot(dir), recentCommits(dir, LIMIT)]);
  let remote: string[] | null = null;
  if (Object.keys(snap.remotes).length > 0) {
    const out = await runGit(["rev-list", "--remotes", "-n", "200"], dir);
    remote = out.code === 0 ? out.stdout.split("\n").filter(Boolean) : [];
  }
  return { repo: snap.repo, head: snap.head, commits: snap.commits, dirty: snap.dirty, remote, ...layout(commits) };
}

const isHead = (c: PlacedCommit) => c.refs.some((r) => r === "HEAD" || r.startsWith("HEAD -> "));

/**
 * What the lesson is about to ask for, as dashed commits on the board — Learn
 * Git Branching's "make it look like this", drawn over the real repository so
 * the goal and the progress toward it are one picture.
 */
function goalFor(challengeId: string, view: View): Ghost[] {
  const head = view.nodes.findIndex(isHead);
  const lane = head >= 0 ? view.nodes[head].lane : 0;
  if (challengeId === "commit_to_it") {
    // A first commit, then a second after changing the file.
    const need = Math.max(0, 2 - view.commits);
    return Array.from({ length: need }, (_, k) => ({ lane, parent: k === 0 && head >= 0 ? head : "prev" }));
  }
  if (challengeId === "branches_arent_just_for_birds" && head >= 0 && /^(main|master)?$/.test(view.head)) {
    // A branch of your own, with a commit on it.
    return [{ lane: view.lanes, parent: head }];
  }
  return [];
}

/**
 * The learner's real repository, drawn as a hairline figure and kept live
 * while they work in their own terminal — Learn Git Branching's picture, of
 * the repo on their disk rather than a simulated one.
 */
export function RepoGraph({ dir, locale, challengeId }: { dir: string; locale: string; challengeId: string }) {
  const t = strings(locale);
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    let last = "";
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await read(dir).catch(() => null);
      const key = JSON.stringify(next);
      if (alive && key !== last) {
        last = key;
        setView(next);
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [dir]);

  if (!view) return null;
  const ghosts = goalFor(challengeId, view);

  return (
    <section className="alert-glass my-6 rounded-lg border p-4">
      <header className="flex items-center gap-2 text-sm">
        <GitBranch className="size-4 text-muted-foreground" />
        <span className="font-medium">{t.repoTitle}</span>
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <span className="size-1.5 animate-pulse bg-success" />
          {t.repoLive}
        </span>
        {view.repo && (
          <span className={cn("ml-auto text-xs", view.dirty ? "text-warning-foreground" : "text-muted-foreground")}>
            {view.dirty ? `${view.dirty} ${t.repoDirty}` : view.nodes.length > 0 ? t.repoClean : ""}
          </span>
        )}
      </header>

      <Graph view={view} ghosts={ghosts} locale={locale} />
    </section>
  );
}

/** The figure, and beside it the same commits by name; each lights the other. */
function Graph({ view, ghosts, locale }: { view: View; ghosts: Ghost[]; locale: string }) {
  const t = strings(locale);
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [cut, setCut] = useState(0);
  const head = view.nodes.findIndex(isHead);
  const n = view.nodes.length;
  const safeCut = Math.min(cut, Math.max(0, n - 1));
  const remote = view.remote ? new Set(view.remote) : null;
  const ghostKey = JSON.stringify(ghosts);

  // New commits land at "now"; a learner who time-travelled comes back for them.
  useEffect(() => setCut(0), [n]);

  useEffect(() => {
    if (!stage.current || !svg.current) return;
    return mountRepoFigure(
      stage.current,
      svg.current,
      { repo: view.repo, nodes: view.nodes, edges: view.edges, head, ghosts, remote, cut: safeCut },
      setActive,
    );
    // ghosts and remote are rebuilt each render; their content is in view and ghostKey.
  }, [view, head, ghostKey, safeCut]);

  const lit = active ?? (safeCut > 0 ? safeCut : head);
  const caption = [remote && t.repoBoards, ghosts.length > 0 && t.repoGhosts].filter(Boolean).join(" · ");

  return (
    <div className="mt-3 flex items-center gap-4">
      <div className="w-[19rem] shrink-0">
        <div ref={stage} data-hairline="repo" role="img" aria-label={t.repoTitle}>
          <svg ref={svg} viewBox="0 0 400 320" aria-hidden="true" />
        </div>
        {caption && <p className="-mt-2 text-center text-[11px] text-muted-foreground">{caption}</p>}
        {n >= 2 && (
          <label className="mt-2 flex items-center gap-2 px-6 text-[11px] text-muted-foreground">
            <History className="size-3.5 shrink-0" />
            <input
              type="range"
              min={0}
              max={n - 1}
              value={n - 1 - safeCut}
              onChange={(e) => setCut(n - 1 - Number(e.target.value))}
              aria-label={t.repoTravel}
              className="gg-range min-w-0 flex-1"
            />
            <span className="w-16 shrink-0 text-right tabular-nums">
              {safeCut === 0 ? t.repoNow : t.repoAgo.replace("{n}", String(safeCut))}
            </span>
          </label>
        )}
      </div>

      {!view.repo || n === 0 ? (
        <p className="min-w-0 flex-1 text-muted-foreground text-sm">
          <Ticks text={view.repo ? t.repoNoCommits : t.repoNotYet} />
          {view.dirty > 0 && ` (${view.dirty} ${t.repoDirty})`}
        </p>
      ) : (
        <ol className="min-w-0 flex-1 font-mono text-xs" data-selectable>
          {view.nodes.map((c, i) => (
            <li
              key={c.hash}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap px-1.5 transition-colors",
                i === lit ? "bg-muted text-foreground" : "text-muted-foreground",
                i < safeCut && "opacity-40",
              )}
              style={{ height: ROW - 4 }}
            >
              <span>{c.hash.slice(0, 7)}</span>
              {c.refs.map((r) => (
                <RefChip key={r} decoration={r} />
              ))}
              {remote && !remote.has(c.hash) && (
                <span className="border border-warning/60 border-dashed px-1 font-sans text-[10px] text-warning-foreground leading-4">{t.repoUnpushed}</span>
              )}
              <span className="truncate font-sans">{c.subject}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function RefChip({ decoration }: { decoration: string }) {
  const head = decoration.startsWith("HEAD -> ");
  const name = head ? decoration.slice(8) : decoration.replace(/^tag: /, "");
  const kind = head || decoration === "HEAD" ? "head" : decoration.startsWith("tag: ") ? "tag" : name.includes("/") ? "remote" : "local";

  return (
    <span
      className={cn(
        "border px-1 leading-4",
        kind === "head" && "border-primary bg-primary text-primary-foreground",
        kind === "local" && "border-primary/60 text-primary",
        kind === "remote" && "border-dashed border-muted-foreground/60 text-muted-foreground",
        kind === "tag" && "border-warning/60 text-warning-foreground",
      )}
    >
      {head ? `HEAD → ${name}` : name}
    </span>
  );
}
