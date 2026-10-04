import { hairlineStyles, HL } from "~/lib/hairline";

import type { GraphEdge, PlacedCommit } from "~/lib/repoState";

/**
 * The learner's repository as a Hairline figure: an isometric board with
 * lanes for branches and a raised commit for each commit. At rest HEAD stands
 * up with a little of its history behind it. The commit under the pointer
 * rises the same way, and its ancestors rise after it, less the further back.
 * That is the stock `branches` figure from @lucasmarkes/hairline, drawn from
 * real commits instead of a fixed example.
 */

const D = 30; // between commits along a lane
const FY = 44; // between lanes
const RW = 7; // lane width
const RT = 2.6; // lane thickness
const PR = 8; // pad radius
const PH = 2.4; // pad height
const CR = 6.6; // commit radius
const CH = 6; // commit height
const LIFT = 36;
const STEP = 45; // stagger per commit, ms
const REACH = 3; // how many ancestors rise after the one chosen

type Bez = [number, number][];
const bez = (a: number[], b: number[], ox: number, oy: number, ix: number, n: number): Bez => {
  const out: Bez = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const px = [a[0], a[0] + ox, b[0] - ix, b[0]], py = [a[1], a[1] + oy, b[1], b[1]];
    out.push([w[0] * px[0] + w[1] * px[1] + w[2] * px[2] + w[3] * px[3], w[0] * py[0] + w[1] * py[1] + w[2] * py[2] + w[3] * py[3]]);
  }
  return out;
};

/** A lane of width RW along a centre line, as one closed outline. */
function strip(c: Bez): Bez {
  const l: Bez = [], r: Bez = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    l.push([p[0] + (nx * RW) / 2, p[1] + (ny * RW) / 2]);
    r.push([p[0] - (nx * RW) / 2, p[1] - (ny * RW) / 2]);
  });
  return l.concat(r.reverse());
}

/** A commit the lesson is about to ask for, drawn dashed until it is real. */
export interface Ghost {
  lane: number;
  /** Its parent: a real commit's index, or the previous ghost. */
  parent: number | "prev";
}

export interface RepoScene {
  /** False draws only a dashed board: there is nothing to track yet. */
  repo: boolean;
  /** Newest first, as `layout` returns them. */
  nodes: PlacedCommit[];
  edges: GraphEdge[];
  /** Index of HEAD's commit; the rest mark. */
  head: number;
  ghosts: Ghost[];
  /** Hashes GitHub has, or null when there is no remote: then no second board. */
  remote: Set<string> | null;
  /** Time travel: the newest `cut` commits haven't happened yet. */
  cut: number;
  /** A thumbnail: frame it tightly, leaving room only for a small lift. */
  compact?: boolean;
  /**
   * Size the camera as if the board were this big, so sibling thumbnails
   * share one scale and a one-commit option doesn't balloon.
   */
  frame?: { slots: number; lanes: number; remote: boolean };
  /**
   * What the command in question produced, for thumbnails: the newest such
   * commit on this computer is the rest mark, and such commits on GitHub's
   * board are drawn in the bright stroke.
   */
  fresh?: Set<string>;
  freshRemote?: Set<string>;
}

/**
 * Draws the scene into `svg`, a 400 × 320 viewBox inside `stage`. `onRead`
 * gets the index of the commit the pointer chose, or null at rest. Returns
 * the tear-down.
 *
 * Front board: this computer. Behind it, when there is a remote, a lower
 * board for GitHub holding the commits it has; a commit that is only local
 * shows there as a dashed outline until it is pushed. Commits the lesson is
 * about to ask for, and commits time travel has not reached, are dashed too.
 */
export function mountRepoFigure(stage: HTMLElement, svg: SVGSVGElement, scene: RepoScene, onRead: (i: number | null) => void): () => void {
  const { Cam, fit, proj, facing, mk, rings, prism, put, solid, circ, poly, open, seg, tween, tset, tval, tdone, register, pointer, disposer, unproj, clamp } = HL;
  hairlineStyles();
  const bag = disposer();
  bag.add(() => svg.replaceChildren());
  const { nodes, edges, ghosts, remote, cut } = scene;
  const n = nodes.length;
  // An empty board still reads as a board: at least three commits long.
  const slots = Math.max(n === 0 ? 3 : 1, n + ghosts.length);
  // Oldest at the far corner, newest nearest the viewer; ghosts beyond the newest.
  const xy = (row: number, lane: number) => [(n - 1 - row) * D, lane * FY];
  const lanes = Math.max(1, ...nodes.map((c) => c.lane + 1), ...ghosts.map((gh) => gh.lane + 1));
  const stub = edges.some((e) => e.to.row >= n);
  const BX0 = (stub ? -D : 0) - 15, BX1 = (slots - 1) * D + 15, BY0 = -16, BY1 = (lanes - 1) * FY + 16, PB = 6;
  const ZTOP = RT + PH + CH;
  // GitHub's board sits behind, a lane's width clear of this one.
  const OFF = remote ? BY1 - BY0 + 22 : 0;

  // fit only centres; scale so the most extreme pose fills the frame (rule 03).
  const top = ZTOP + (scene.compact ? LIFT * 0.6 : LIFT);
  const box = [
    [BX0, BY0 - OFF, -PB], [BX1, BY1, -PB], [BX1, BY0 - OFF, -PB], [BX0, BY1, -PB],
    [BX0, BY0 - OFF, top], [BX1, BY0 - OFF, top], [BX0, BY0, top],
  ];
  // The box the scale is chosen for: this board, or the frame it shares.
  const F = scene.frame;
  const SX1 = F ? Math.max(BX1, (F.slots - 1) * D + 15) : BX1, SY1 = F ? Math.max(BY1, (F.lanes - 1) * FY + 16) : BY1;
  const SOFF = F?.remote ? SY1 - BY0 + 22 : OFF;
  const sizing = [
    [BX0, BY0 - SOFF, -PB], [SX1, SY1, -PB], [SX1, BY0 - SOFF, -PB], [BX0, SY1, -PB],
    [BX0, BY0 - SOFF, top], [SX1, BY0 - SOFF, top], [BX0, BY0, top],
  ];
  const P1 = proj(Cam(45, 0.5, 1));
  const pts = sizing.map(([x, y, z]) => P1(x, y, z));
  const w = Math.max(...pts.map((p: number[]) => p[0])) - Math.min(...pts.map((p: number[]) => p[0]));
  const h = Math.max(...pts.map((p: number[]) => p[1])) - Math.min(...pts.map((p: number[]) => p[1]));
  const C = Cam(45, 0.5, clamp(scene.compact ? Math.min(360 / w, 270 / h) : Math.min(330 / w, 250 / h), 0.5, 2.6));
  fit(C, box, 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  const [pr, pi] = [circ(PR, 24), circ(PR - 1.4, 24)], [cr, ci] = [circ(CR, 24), circ(CR - 1.2, 24)];
  const at = (ring: any[], x: number, y: number) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
  const future = (row: number) => row < cut;
  const depth = (i: number) => xy(i, nodes[i].lane)[0] + xy(i, nodes[i].lane)[1];
  const backToFront = nodes.map((_, i) => i).sort((i, j) => depth(i) - depth(j));

  /** A lane between two points: a solid strip, or a dashed centre line for what hasn't happened. */
  function lane(a: number[], b: number[], dashed: boolean, dy = 0, z0 = 0) {
    const A = [a[0], a[1] + dy], B = [b[0], b[1] + dy];
    const line: Bez = A[1] === B[1]
      ? [[A[0], A[1]], [B[0], B[1]]]
      : bez(B, A, (A[0] - B[0]) * 0.3, (A[1] - B[1]) * 0.5, (A[0] - B[0]) * 0.45, 14);
    if (dashed) {
      mk("path", { d: open(line.map((p) => P(p[0], p[1], z0 + RT))), class: "dash nf" }, g);
      return;
    }
    const s = strip(line);
    mk("path", { d: poly(s.map((p) => P(p[0], p[1], z0))), class: "lo" }, g);
    mk("path", { d: poly(s.map((p) => P(p[0], p[1], z0 + RT))), class: "" }, g);
  }
  /** A commit that isn't there: its outline, dashed. */
  function ghost(x: number, y: number, z0 = 0) {
    mk("path", { d: prism(P, front, at(pr, x, y), at(pi, x, y), z0 + RT, z0 + RT + PH).sil, class: "sil dash nf" }, g);
    mk("path", { d: prism(P, front, at(cr, x, y), at(ci, x, y), z0 + RT + PH, z0 + RT + PH + CH).sil, class: "sil dash nf" }, g);
  }

  // --- GitHub's board, behind and a step lower ----------------------------
  if (remote && scene.repo) {
    const Z = -3;
    const [rr, ri] = rings(BX0, BY0 - OFF, BX1, BY1 - OFF, 12, 2.2);
    put(solid(g), prism(P, front, rr, ri, Z - PB, Z));
    for (const e of edges) {
      if (e.to.row >= n) continue;
      if (remote.has(nodes[e.from.row].hash) && remote.has(nodes[e.to.row].hash)) {
        lane(xy(e.from.row, e.from.lane), xy(e.to.row, e.to.lane), false, -OFF, Z);
      }
    }
    for (const i of backToFront) {
      const [x, y] = xy(i, nodes[i].lane);
      if (remote.has(nodes[i].hash)) {
        put(solid(g), prism(P, front, at(pr, x, y - OFF), at(pi, x, y - OFF), Z + RT, Z + RT + PH));
        const up = solid(g);
        put(up, prism(P, front, at(cr, x, y - OFF), at(ci, x, y - OFF), Z + RT + PH, Z + RT + PH + CH * 0.7));
        // A commit this push delivered: the bright stroke says "this is what changed".
        if (scene.freshRemote?.has(nodes[i].hash)) up.sil.classList.add("hi");
      } else if (!future(i)) {
        ghost(x, y - OFF, Z);
      }
    }
  }

  // --- this computer's board ----------------------------------------------
  // Not a repository yet: the board itself is still to come, so it is dashed.
  const [br, bi] = rings(BX0, BY0, BX1, BY1, 12, 2.2);
  if (scene.repo) put(solid(g), prism(P, front, br, bi, -PB, 0));
  else mk("path", { d: prism(P, front, br, bi, -PB, 0).sil, class: "sil dash nf" }, g);

  // Lanes: a straight run within a lane, an S-curve where a branch forks off
  // or merges back, and a run off the board's end for older history.
  for (const e of edges) {
    const a = xy(e.from.row, e.from.lane);
    const b = e.to.row >= n ? [BX0 + 4, a[1]] : xy(e.to.row, e.to.lane);
    lane(a, b, future(e.from.row));
  }
  const ghostAt = ghosts.map((gh, k) => [(n + k) * D, gh.lane * FY]);
  ghosts.forEach((gh, k) => {
    const from = gh.parent === "prev" ? ghostAt[k - 1] : nodes[gh.parent] ? xy(gh.parent, nodes[gh.parent].lane) : null;
    if (from) lane(from, ghostAt[k], true);
  });

  const cs: any[] = [];
  for (const i of backToFront) {
    const [x, y] = xy(i, nodes[i].lane);
    if (future(i)) {
      ghost(x, y);
      continue;
    }
    put(solid(g), prism(P, front, at(pr, x, y), at(pi, x, y), RT, PH + RT));
    const drop = mk("path", { class: "dash nf" }, g);
    cs[i] = { x, y, drop, el: solid(g), ring: at(cr, x, y), inner: at(ci, x, y), z: tween(0), drawn: Number.NaN };
  }
  for (const [x, y] of ghostAt) ghost(x, y);

  const index = new Map(nodes.map((c, i) => [c.hash, i]));
  /** The commit and its first-parent history, each with its distance back. */
  const chain = (a: number) => {
    const out: [number, number][] = [];
    for (let i: number | undefined = a, k = 0; i !== undefined; i = index.get(nodes[i].parents[0] ?? ""), k++) out.push([i, k]);
    return out;
  };

  function draw(c: any, z: number) {
    if (z === c.drawn) return;
    c.drawn = z;
    const b = PH + RT + z;
    put(c.el, prism(P, front, c.ring, c.inner, b, b + CH));
    c.drop.setAttribute("d", seg(P(c.x, c.y, PH + RT), P(c.x, c.y, b)));
  }
  const loop = register(stage, (_dt: number, now: number) => {
    let moving = false;
    for (const c of cs) {
      if (!c) continue;
      draw(c, tval(c.z, now));
      if (!tdone(c.z, now)) moving = true;
    }
    return moving;
  });
  bag.add(loop.unregister);

  let act: number | null = null, lit: number | null = null, held = new Map<number, [number, number]>();
  function lift(a: number, reach: number, depthK: number, instant?: boolean) {
    if (!cs[a]) return;
    const now = performance.now(), want = new Map<number, [number, number]>();
    for (const [i, k] of chain(a)) if (k <= reach && cs[i]) want.set(i, [LIFT * depthK * clamp(1 - k / (reach + 1), 0, 1), k]);
    cs.forEach((c, i) => {
      if (!c) return;
      const [to, k] = want.get(i) ?? [0, (held.get(i) ?? [0, 0])[1]];
      if (instant) c.z = tween(to);
      else tset(c.z, to, now, k * STEP);
    });
    held = want;
    if (lit !== a) {
      if (lit !== null) cs[lit]?.el.sil.classList.remove("hi");
      lit = a;
      cs[a].el.sil.classList.add("hi");
    }
    loop.wake();
  }
  // At rest the bright mark is where you are: HEAD, or how far back time travel went.
  // With nothing new on this computer (a push), the rest mark gives way to
  // the bright commits on GitHub's board: one place lit at a time (rule 04).
  const rest = cut > 0 ? Math.min(cut, n - 1) : scene.fresh ? nodes.findIndex((c) => scene.fresh!.has(c.hash)) : scene.head;
  if (rest >= 0 && n > 0) lift(rest, 2.2, 0.5, true);

  function choose(a: number | null) {
    if (a === act) return;
    act = a;
    if (a === null) {
      if (rest >= 0 && n > 0) lift(rest, 2.2, 0.5);
    } else lift(a, REACH, 1);
    onRead(a);
  }
  // Against the commits' rest tops, which never move (rule 01).
  function hit(p: number[]) {
    const q = unproj(C, p[0], p[1], ZTOP);
    if (q[0] < BX0 || q[0] > BX1 || q[1] < BY0 || q[1] > BY1) return null;
    let best: number | null = null, bd = Number.POSITIVE_INFINITY;
    cs.forEach((c, i) => {
      if (!c) return;
      const d = Math.hypot(c.x - q[0], c.y - q[1]);
      if (d < bd) [bd, best] = [d, i];
    });
    return best;
  }
  bag.add(pointer(stage, { move: (p: number[]) => choose(hit(p)), leave: () => choose(null) }));
  return bag.dispose;
}
