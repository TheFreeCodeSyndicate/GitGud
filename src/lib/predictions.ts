import type { RepoScene } from "~/lib/repoFigure";
import { layout, type GraphCommit } from "~/lib/repoState";

/**
 * Predict-then-run, after Brilliant: before a lesson's key command the
 * learner picks what they think it will do to the graph, from three small
 * drawings of it. Then they run it for real and watch their own graph.
 *
 * Every option must look different at a glance — a different shape, not a
 * different label — and the commit the command produced in that option is the
 * bright one, so the eye goes straight to the claim being made. An option
 * where nothing new appears has nothing bright.
 */
export interface Prediction {
  /** The question; backticks are code. */
  ask: string;
  options: { label: string; scene: RepoScene }[];
  answer: number;
  /** Why, in a sentence or two, shown once they have picked. */
  why: string;
}

const c = (hash: string, parents: string[] = [], refs: string[] = []): GraphCommit => ({ hash, parents, refs, subject: "" });

/** A thumbnail scene from commits listed newest first. */
function scene(commits: GraphCommit[], extra: Partial<RepoScene> = {}): RepoScene {
  const { nodes, edges } = layout(commits);
  const head = nodes.findIndex((n) => n.refs.some((r) => r.startsWith("HEAD")));
  return { repo: true, nodes, edges, head, ghosts: [], remote: null, cut: 0, compact: true, fresh: new Set(), ...extra };
}

/** `main` as a straight line of n commits, m1 the oldest. */
const line = (n: number, refs: string[] = ["HEAD -> main"]) =>
  Array.from({ length: n }, (_, i) => c(`m${n - i}`, i === n - 1 ? [] : [`m${n - i - 1}`], i === 0 ? refs : []));

const set = (...hashes: string[]) => new Set(hashes);

/**
 * Put the named commits on lane 1. `layout` follows Git's own graph, where a
 * branch with nothing merged and main not moved past it is just the line
 * carrying on — true, but it makes "a new branch" look exactly like "one more
 * commit on main", which is the very difference the question asks about.
 */
function branchLane(sc: RepoScene, ...hashes: string[]): RepoScene {
  const nodes = sc.nodes.map((n) => (hashes.includes(n.hash) ? { ...n, lane: 1 } : n));
  const at = new Map(nodes.map((n) => [n.hash, n]));
  const edges = nodes.flatMap((n) =>
    n.parents.map((p, i) => {
      const parent = at.get(p)!;
      const bendAtStart = i > 0;
      const to = { lane: parent.lane, row: parent.row };
      return { from: { lane: n.lane, row: n.row }, to, bendAtStart, lane: bendAtStart ? to.lane : n.lane };
    }),
  );
  return { ...sc, nodes, edges };
}

export const PREDICTIONS: Record<string, Prediction> = {
  repository: {
    ask: "You run `git init` in an empty folder. What appears?",
    options: [
      { label: "An empty repository, ready for commits", scene: scene([]) },
      { label: "A first commit with your files", scene: scene(line(1), { fresh: set("m1") }) },
      { label: "Nothing: Git needs a file first", scene: { ...scene([]), repo: false } },
    ],
    answer: 0,
    why: "`git init` makes the hidden `.git` folder: an empty history, waiting. Commits only come when you make them.",
  },
  commit_to_it: {
    ask: "You have one commit, and you've staged a change. What does `git commit` do to the graph?",
    options: [
      { label: "Nothing new: staging already saved it", scene: scene(line(1)) },
      { label: "A new commit, and HEAD moves onto it", scene: scene(line(2), { fresh: set("m2") }) },
      {
        label: "A new branch splits off for it",
        scene: branchLane(scene([c("f1", ["m1"], ["HEAD -> idea"]), c("m1", [], ["main"])], { fresh: set("f1") }), "f1"),
      },
    ],
    answer: 1,
    why: "Staging only chooses what goes in. The commit is the snapshot: one more on the line, and HEAD moves to the newest.",
  },
  remote_control: {
    ask: "Three commits on your computer (front), one of them on GitHub (behind). What does `git push` change?",
    options: [
      {
        label: "GitHub gets the two it was missing",
        scene: scene(line(3), { remote: set("m1", "m2", "m3"), freshRemote: set("m2", "m3") }),
      },
      {
        label: "GitHub gets only the newest one",
        scene: scene(line(3), { remote: set("m1", "m3"), freshRemote: set("m3") }),
      },
      { label: "Nothing, until GitHub pulls them", scene: scene(line(3), { remote: set("m1") }) },
    ],
    answer: 0,
    why: "Push copies every commit GitHub doesn't have yet, in order, so its history has no holes. Nothing leaves your computer: afterwards both boards match.",
  },
  branches_arent_just_for_birds: {
    ask: "On `main` with three commits, you run `git checkout -b add-you` and commit. Where does the new commit go?",
    options: [
      { label: "Onto main, after the others", scene: scene(line(4), { fresh: set("m4") }) },
      {
        label: "Onto a new lane forking off where you were",
        scene: branchLane(scene([c("b1", ["m3"], ["HEAD -> add-you"]), c("m3", ["m2"], ["main"]), c("m2", ["m1"]), c("m1")], { fresh: set("b1") }), "b1"),
      },
      {
        label: "Onto a new lane forking off the first commit",
        scene: branchLane(scene([c("m3", ["m2"], ["main"]), c("m2", ["m1"]), c("b1", ["m1"], ["HEAD -> add-you"]), c("m1")], { fresh: set("b1") }), "b1"),
      },
    ],
    answer: 1,
    why: "A branch starts from where you are standing — the newest commit you have checked out. Your commit goes on it, and main stays put.",
  },
  merge_tada: {
    ask: "Your branch has two commits main doesn't. What does merging it into main look like?",
    options: [
      { label: "The branch's commits disappear", scene: scene(line(2)) },
      {
        label: "The lanes join in a merge commit",
        scene: scene([c("mg", ["m2", "b2"], ["HEAD -> main"]), c("b2", ["b1"], ["add-you"]), c("b1", ["m1"]), c("m2", ["m1"]), c("m1")], { fresh: set("mg") }),
      },
      {
        label: "Its commits are copied onto the end of main",
        scene: scene([c("b2", ["b1"], ["HEAD -> main"]), c("b1", ["m2"]), c("m2", ["m1"]), c("m1")], { fresh: set("b2") }),
      },
    ],
    answer: 1,
    why: "A merge commit has two parents, so both lines of history meet and nothing is copied or lost. After that, deleting the branch only removes its name.",
  },
};
