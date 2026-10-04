import { runGit } from "~/lib/git";

/**
 * What the learner's repository looks like right now, and how it got that way.
 *
 * Two uses: the "what changed" list after a check passes (a before/after diff
 * of these snapshots), and the live commit graph beside the lesson.
 */

export interface RepoSnapshot {
  repo: boolean;
  /** Checked-out branch; empty when detached or not a repo. */
  head: string;
  /** Local branches: name → commit. */
  branches: Record<string, string>;
  /** Remote-tracking branches: `origin/main` → commit. */
  tracking: Record<string, string>;
  /** Remotes: name → fetch URL. */
  remotes: Record<string, string>;
  /** Commits reachable from HEAD. */
  commits: number;
  /** Uncommitted paths, staged or not. */
  dirty: number;
}

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export async function snapshot(path: string): Promise<RepoSnapshot> {
  const empty: RepoSnapshot = { repo: false, head: "", branches: {}, tracking: {}, remotes: {}, commits: 0, dirty: 0 };
  const inside = await runGit(["rev-parse", "--is-inside-work-tree"], path);
  if (inside.stdout.trim() !== "true") return empty;

  const [head, refs, remotes, count, status] = await Promise.all([
    runGit(["branch", "--show-current"], path),
    runGit(["for-each-ref", "--format=%(refname)%09%(objectname)", "refs/heads", "refs/remotes"], path),
    runGit(["remote", "-v"], path),
    runGit(["rev-list", "--count", "HEAD"], path),
    runGit(["status", "--porcelain"], path),
  ]);

  const snap: RepoSnapshot = { ...empty, repo: true, head: head.stdout.trim() };
  for (const line of lines(refs.stdout)) {
    const [ref, sha] = line.split("\t");
    if (ref.startsWith("refs/heads/")) snap.branches[ref.slice(11)] = sha;
    else if (!ref.endsWith("/HEAD")) snap.tracking[ref.slice(13)] = sha;
  }
  for (const line of lines(remotes.stdout)) {
    const [name, url, kind] = line.split(/\s+/);
    if (kind === "(fetch)") snap.remotes[name] = url;
  }
  snap.commits = count.code === 0 ? Number.parseInt(count.stdout, 10) || 0 : 0;
  snap.dirty = lines(status.stdout).length;
  return snap;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Plain sentences for what moved between two snapshots, most important first. */
export function describeChanges(before: RepoSnapshot, after: RepoSnapshot): string[] {
  if (!after.repo) return [];
  if (!before.repo) {
    return ["This folder became a Git repository — Git made a hidden `.git` folder to keep its history in."];
  }

  const out: string[] = [];

  for (const [name, url] of Object.entries(after.remotes)) {
    if (!(name in before.remotes)) out.push(`New remote \`${name}\` → ${url}.`);
    else if (before.remotes[name] !== url) out.push(`Remote \`${name}\` now points to ${url}.`);
  }
  for (const name of Object.keys(before.remotes)) {
    if (!(name in after.remotes)) out.push(`Remote \`${name}\` was removed.`);
  }

  for (const name of Object.keys(after.branches)) {
    // Right after `git init` the branch exists in name only; its first commit
    // is what makes it real, and that is reported as a commit below.
    const unborn = name === before.head && before.commits === 0;
    if (!(name in before.branches) && !unborn) out.push(`New branch \`${name}\` created.`);
  }
  if (before.head && after.head && before.head !== after.head) {
    out.push(`You switched from \`${before.head}\` to \`${after.head}\` — HEAD moved with you.`);
  }

  const added = after.commits - before.commits;
  if (before.head === after.head && added > 0) {
    out.push(`${plural(added, "new commit")} on \`${after.head}\`.`);
  } else if (after.head && before.branches[after.head] && before.branches[after.head] !== after.branches[after.head]) {
    out.push(`\`${after.head}\` moved to a new commit.`);
  }
  for (const [name, sha] of Object.entries(after.branches)) {
    if (name !== after.head && before.branches[name] && before.branches[name] !== sha) {
      out.push(`\`${name}\` moved to a new commit.`);
    }
  }

  for (const name of Object.keys(before.branches)) {
    if (!(name in after.branches)) out.push(`Branch \`${name}\` was deleted.`);
  }

  for (const [name, sha] of Object.entries(after.tracking)) {
    if (!(name in before.tracking)) out.push(`\`${name}\` appeared — that branch now exists on the remote.`);
    else if (before.tracking[name] !== sha) out.push(`\`${name}\` updated — Git now knows the remote's newer commits.`);
  }

  if (before.dirty > 0 && after.dirty === 0) out.push("Working tree is clean — nothing left uncommitted.");

  return out;
}

// --- the graph -------------------------------------------------------------

export interface GraphCommit {
  hash: string;
  parents: string[];
  /** Decorations: `HEAD -> main`, `origin/main`, `tag: v1`. */
  refs: string[];
  subject: string;
}

export interface PlacedCommit extends GraphCommit {
  lane: number;
  row: number;
}

export interface GraphEdge {
  from: { lane: number; row: number };
  /** `row` past the last commit when the parent is older than what was loaded. */
  to: { lane: number; row: number };
  /** Bend at the child (a merge's second parent) or at the parent (a fork). */
  bendAtStart: boolean;
  lane: number;
}

const SEP = "\x1f";

export async function recentCommits(path: string, limit = 30): Promise<GraphCommit[]> {
  const out = await runGit(
    ["log", "--all", "--topo-order", `-n${limit}`, `--format=%H${SEP}%P${SEP}%D${SEP}%s`],
    path,
  );
  if (out.code !== 0) return [];
  return lines(out.stdout).map((line) => {
    const [hash, parents, refs, subject] = line.split(SEP);
    return {
      hash,
      parents: parents ? parents.split(" ") : [],
      refs: refs ? refs.split(", ") : [],
      subject: subject ?? "",
    };
  });
}

/**
 * Lanes for a newest-first, topo-ordered commit list — the same idea as
 * `git log --graph`: each lane waits for one hash; a commit takes the lane
 * waiting for it, hands that lane to its first parent, and opens new lanes for
 * any other parents.
 */
export function layout(commits: GraphCommit[]): { nodes: PlacedCommit[]; edges: GraphEdge[]; lanes: number } {
  const waiting: (string | null)[] = [];
  const nodes: PlacedCommit[] = [];

  commits.forEach((c, row) => {
    let lane = waiting.indexOf(c.hash);
    if (lane === -1) {
      lane = waiting.indexOf(null);
      if (lane === -1) lane = waiting.push(null) - 1;
    }
    for (let i = 0; i < waiting.length; i++) if (waiting[i] === c.hash) waiting[i] = null;

    waiting[lane] = c.parents[0] ?? null;
    for (const p of c.parents.slice(1)) {
      if (waiting.includes(p)) continue;
      const free = waiting.indexOf(null);
      if (free === -1) waiting.push(p);
      else waiting[free] = p;
    }
    nodes.push({ ...c, lane, row });
  });

  const at = new Map(nodes.map((n) => [n.hash, n]));
  const edges: GraphEdge[] = [];
  for (const n of nodes) {
    n.parents.forEach((p, i) => {
      const parent = at.get(p);
      const to = parent ? { lane: parent.lane, row: parent.row } : { lane: n.lane, row: nodes.length };
      const bendAtStart = i > 0;
      edges.push({ from: { lane: n.lane, row: n.row }, to, bendAtStart, lane: bendAtStart ? to.lane : n.lane });
    });
  }

  return { nodes, edges, lanes: Math.max(1, ...nodes.map((n) => n.lane + 1)) };
}
