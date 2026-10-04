import { hairlineStyles, HL } from "~/lib/hairline";

/**
 * The learner's own terminal, as a Hairline figure. This is the stock
 * `terminal` figure from @lucasmarkes/hairline — a window whose lines are
 * blocks the length of their words, scrolled by the pointer's height, the
 * line under it lifting off the screen — with its fixed history swapped for
 * the commands the learner really typed. No text is drawn (rule 10): each
 * word is a block as long as the word, and the command itself goes to the
 * read-out under the figure.
 */
const V = 7; // lines on screen
const G = 11; // line pitch
const T = 2.1; // half a line's height
const LH = 1.8; // block thickness
const CW = 3.9; // one character
const LIFT = 5.5;
const HB = 3.4; // bar height
const SLAB = 3;
const W = 150;
const TB = 17; // title bar
const PB = 17; // prompt bar
const PAD = 11;
const IN = 2.5;
const VB = PB;
const VA = PB + V * G;
const H = VA + TB;
const E = 4;
const MAX_CHARS = Math.floor((W - PAD * 2) / CW);

const falloff = (d: number, r: number) => HL.clamp(1 - d / r, 0, 1);
const smooth = (t: number) => t * t * (3 - 2 * t);
const front = (q: any) => 0.612 * q.nu + 0.5 * q.nv > 0;

/** A command as word lengths, cut to what fits on one line. */
export function wordsOf(cmd: string): number[] {
  const out: number[] = [];
  let used = 0;
  for (const w of cmd.trim().split(/\s+/)) {
    const len = Math.min(w.length, MAX_CHARS - used);
    if (len <= 0) break;
    out.push(len);
    used += len + 1;
  }
  return out.length ? out : [1];
}

/**
 * Draws `lines` (oldest first) into `svg`. `onRead` gets the line the pointer
 * is on, or null at rest. At rest the newest line stands a little off the
 * glass: the last thing you typed.
 */
export function mountTerminalFigure(stage: HTMLElement, svg: SVGSVGElement, lines: string[], onRead: (i: number | null) => void): () => void {
  const { Cam, fit, proj, mk, rings, rrect, prism, put, solid, poly, fillet, spring, stepS, register, pointer, disposer, clamp } = HL;
  hairlineStyles();
  const bag = disposer();
  bag.add(() => svg.replaceChildren());
  const hist = lines.length ? lines : [""];
  const N = Math.max(hist.length, V);
  const REST_TOP = Math.max(0, N - V);
  const REST_LINE = hist.length - 1;

  const C = Cam(45, 0.5, 1.62);
  const W3 = (u: number, v: number, w: number) => [u, w, v];
  fit(C, [W3(0, 0, -SLAB), W3(W, 0, -SLAB), W3(0, H, -SLAB), W3(W, H, -SLAB), W3(W, 0, HB + 2.8), W3(0, H, HB + 1.3), W3(PAD, VA - 4, LIFT + LH)], 200, 166);
  const P = proj(C), P2 = (u: number, v: number, w: number) => P(u, w, v);
  const cut = (ring: any[]) => ring.map((q) => ({ ...q, v: clamp(q.v, VB, VA) }));
  let over: number | "prompt" | null = null, lit: Element[] = [];
  const g = mk("g", {}, svg);
  const [sr, si] = rings(0, 0, W, H, 9, 2);
  put(solid(g), prism(P2, front, sr, si, -SLAB, 0));

  // Rows of word blocks. Rows the history doesn't fill stay empty.
  const rows = Array.from({ length: N }, (_, j) => {
    const cmd = hist[j - (N - hist.length)];
    const segs: { x0: number; x1: number; el: any }[] = [];
    if (cmd !== undefined && cmd !== "") {
      let at = 0;
      for (const n of wordsOf(cmd)) {
        const x0 = PAD + at * CW;
        segs.push({ x0, x1: x0 + n * CW - 1.4, el: solid(g) });
        at += n + 1;
      }
    }
    return { j, segs, sp: spring(0, { eps: 0.01 }), drawn: "" };
  });

  // The prompt bar with its chevron and cursor, and the title bar's three lights.
  const [pr, pi] = rings(IN, IN, W - IN, VB, 6, 1.4);
  put(solid(g), prism(P2, front, pr, pi, 0, HB));
  const cy = (IN + VB) / 2;
  const chev = fillet([[0, 6.2], [8.5, 0], [0, -6.2], [0, -3.1], [4.25, 0], [0, 3.1]], [0.9, 1.1, 0.9, 0.5, 0.6, 0.5]);
  const chevEl = mk("path", { d: poly(chev.map(([x, y]: number[]) => P2(PAD + x, cy + y, HB))), class: "nf" }, g);
  const [kr, ki] = rings(PAD + 13, cy - 5.2, PAD + 13 + CW * 1.5, cy + 5.2, 1.2, 0.8);
  const cursor = solid(g);
  put(cursor, prism(P2, front, kr, ki, HB, HB + 2.8));
  const [tr, ti] = rings(IN, VA, W - IN, H - IN, 6, 1.4);
  put(solid(g), prism(P2, front, tr, ti, 0, HB));
  for (let i = 0; i < 3; i++) {
    const cx = PAD + i * 8.5, cv = (VA + H - IN) / 2;
    const [r, ri] = rings(cx - 2.8, cv - 2.8, cx + 2.8, cv + 2.8, 2.8, 0.8);
    put(solid(g), prism(P2, front, r, ri, HB, HB + 1.3));
  }

  function drawRow(rw: (typeof rows)[number], top: number) {
    const key = `${top}|${rw.sp.x}`;
    if (key === rw.drawn) return;
    rw.drawn = key;
    const vc = VA - (rw.j - top + 0.5) * G, v0 = Math.max(vc - T, VB), v1 = Math.min(vc + T, VA);
    const env = smooth(clamp((VA - vc - T) / E, 0, 1)) * smooth(clamp((vc - T - VB) / E, 0, 1));
    const w0 = rw.sp.x * env;
    for (const s of rw.segs) {
      if (v1 - v0 < 0.05) {
        put(s.el, { sil: "", crease: "" });
        continue;
      }
      const ring = cut(rrect(s.x0, vc - T, s.x1, vc + T, T, 4)), inner = cut(rrect(s.x0 + 0.7, vc - T + 0.7, s.x1 - 0.7, vc + T - 0.7, T - 0.7, 4));
      put(s.el, prism(P2, front, ring, inner, w0, w0 + LH));
    }
  }
  function light(els: Element[]) {
    for (const el of lit) el.classList.remove("hi");
    lit = els;
    for (const el of lit) el.classList.add("hi");
  }

  const top = spring(REST_TOP, { eps: 2e-3 });
  const loop = register(stage, (dt: number) => {
    let moving = stepS(top, dt);
    for (const rw of rows) {
      if (stepS(rw.sp, dt)) moving = true;
      drawRow(rw, top.x);
    }
    return moving;
  });
  bag.add(loop.unregister);

  function onFace([sx, sy]: number[], w: number) {
    const o = P2(0, 0, w), a = P2(1, 0, w), b = P2(0, 1, w);
    const ax = a[0] - o[0], ay = a[1] - o[1], bx = b[0] - o[0], by = b[1] - o[1], det = ax * by - ay * bx;
    return [((sx - o[0]) * by - (sy - o[1]) * bx) / det, (ax * (sy - o[1]) - ay * (sx - o[0])) / det];
  }
  // Against the fixed glass and bars, never the lifted lines (rule 01).
  function hit(p: number[]): number | "prompt" | null {
    const qb = onFace(p, HB), inU = (q: number[]) => q[0] > IN && q[0] < W - IN;
    if (inU(qb) && qb[1] > IN && qb[1] < VB) return "prompt";
    if (inU(qb) && qb[1] > VA && qb[1] < H - IN) return 0;
    const q = onFace(p, 0);
    if (q[0] < 0 || q[0] > W || q[1] < 0 || q[1] > H) return null;
    return q[1] <= VB ? "prompt" : clamp((VA - G / 2 - q[1]) / ((V - 1) * G), 0, 1);
  }
  function retarget() {
    let t: number, c: number, r = 2;
    if (over === null) {
      t = REST_TOP;
      c = REST_LINE;
      onRead(null);
    } else if (over === "prompt") {
      t = N - V;
      c = -1;
      onRead(null);
    } else {
      t = over * (N - V);
      c = clamp(Math.round(over * (N - 1)), Math.ceil(t), Math.floor(t + V - 1));
      const k = c - (N - hist.length);
      onRead(k >= 0 && hist[k] ? k : null);
    }
    top.t = t;
    for (const rw of rows) rw.sp.t = c < 0 ? 0 : LIFT * falloff(Math.abs(rw.j - c), r);
    light(c < 0 || !rows[c]?.segs.length ? [cursor.sil, chevEl] : rows[c].segs.map((s) => s.el.sil));
    loop.wake();
  }
  retarget();
  for (const rw of rows) rw.sp.x = rw.sp.t;
  bag.add(
    pointer(stage, {
      move: (p: number[]) => {
        over = hit(p);
        retarget();
      },
      leave: () => {
        over = null;
        retarget();
      },
    }),
  );
  return bag.dispose;
}
