import { hairlineStyles, HL } from "~/lib/hairline";

/**
 * The learner's folder as a Hairline figure: a tray, and on it one thing per
 * entry — a box with a tab for a folder, a flat sheet for a file. A folder's
 * lid carries a dot for each thing inside it, up to five (rule 10: number
 * with dots). The item under the pointer rises on a 700 ms tween, its
 * neighbours a little after it by distance (rules 02, 08). No names are drawn;
 * they go to the read-out.
 */
export interface FolderItem {
  name: string;
  isDir: boolean;
  /** For a folder: how many things are inside. */
  count: number;
}

const CELL = 34;
const PAD = 12;
const BOX = { w: 24, d: 18, h: 11 };
const SHEET = { w: 17, d: 22, h: 1.6 };
const LIFT = 16;
const STEP = 45;

export function mountFolderFigure(stage: HTMLElement, svg: SVGSVGElement, items: FolderItem[], onRead: (i: number | null) => void): () => void {
  const { Cam, fit, proj, facing, mk, rings, prism, put, solid, tween, tset, tval, tdone, register, pointer, disposer, unproj, flatDot, place } = HL;
  hairlineStyles();
  const bag = disposer();
  bag.add(() => svg.replaceChildren());
  const n = Math.max(1, items.length);
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))));
  const rowsN = Math.max(1, Math.ceil(n / cols));
  const X1 = cols * CELL + PAD * 2, Y1 = rowsN * CELL + PAD * 2, TH = 5;

  const C = Cam(45, 0.5, 1);
  const box = [[0, 0, -TH], [X1, 0, -TH], [0, Y1, -TH], [X1, Y1, -TH], [0, 0, BOX.h + LIFT + 6], [X1, 0, BOX.h + LIFT + 6]];
  const P1 = proj(C);
  const pts = box.map(([x, y, z]) => P1(x, y, z));
  const w = Math.max(...pts.map((p: number[]) => p[0])) - Math.min(...pts.map((p: number[]) => p[0]));
  const h = Math.max(...pts.map((p: number[]) => p[1])) - Math.min(...pts.map((p: number[]) => p[1]));
  const Cs = Cam(45, 0.5, Math.min(2.2, 310 / w, 240 / h));
  fit(Cs, box, 200, 166);
  const P = proj(Cs), front = facing(Cs);
  const g = mk("g", {}, svg);

  // The tray: a plate with a raised rim, so the things sit in something.
  const [tr, ti] = rings(0, 0, X1, Y1, 10, 2.2);
  put(solid(g), prism(P, front, tr, ti, -TH, 0));

  const cellOf = (i: number) => {
    const c = i % cols, r = Math.floor(i / cols);
    return [PAD + c * CELL + CELL / 2, PAD + r * CELL + CELL / 2];
  };
  // Back to front: ascending x + y (the far corner first).
  const order = items.map((_, i) => i).sort((a, b) => {
    const [ax, ay] = cellOf(a), [bx, by] = cellOf(b);
    return ax + ay - (bx + by);
  });

  const parts: any[] = [];
  for (const i of order) {
    const it = items[i];
    const [cx, cy] = cellOf(i);
    const s = it.isDir ? BOX : SHEET;
    const body = solid(g);
    const tab = it.isDir ? solid(g) : null;
    const dots = it.isDir
      ? Array.from({ length: Math.min(5, it.count) }, () => flatDot(g, Cs, 0.9, "dot m"))
      : [];
    const drop = mk("path", { class: "dash nf" }, g);
    parts[i] = { cx, cy, s, body, tab, dots, drop, z: tween(0), drawn: Number.NaN };
  }

  function draw(p: any, z: number) {
    if (z === p.drawn) return;
    p.drawn = z;
    const { cx, cy, s } = p;
    const [r, ri] = rings(cx - s.w / 2, cy - s.d / 2, cx + s.w / 2, cy + s.d / 2, p.tab ? 2.5 : 1.5, p.tab ? 1.4 : 0.6);
    put(p.body, prism(P, front, r, ri, z, z + s.h));
    if (p.tab) {
      // The folder's tab, along its back edge.
      const [tr2, ti2] = rings(cx - s.w / 2, cy - s.d / 2, cx - s.w / 2 + 10, cy - s.d / 2 + 4, 1.2, 0.6);
      put(p.tab, prism(P, front, tr2, ti2, z + s.h, z + s.h + 2.2));
      p.dots.forEach((d: any, k: number) => place(d, P(cx - 6 + k * 3, cy + 3, z + s.h)));
    }
    p.drop.setAttribute("d", z > 0.2 ? `M${P(cx, cy, 0).join(" ")}L${P(cx, cy, z).join(" ")}` : "");
  }
  const loop = register(stage, (_dt: number, now: number) => {
    let moving = false;
    for (const p of parts) {
      if (!p) continue;
      draw(p, tval(p.z, now));
      if (!tdone(p.z, now)) moving = true;
    }
    return moving;
  });
  bag.add(loop.unregister);

  let act: number | null = null, lit: any = null;
  function light(i: number | null) {
    const next = i === null ? null : parts[i];
    if (lit === next) return;
    if (lit) lit.body.sil.classList.remove("hi");
    lit = next;
    if (lit) lit.body.sil.classList.add("hi");
  }
  // At rest, the first folder is the bright mark: where you'd go next.
  const restMark = items.findIndex((it) => it.isDir);
  light(restMark >= 0 ? restMark : items.length ? 0 : null);

  function choose(a: number | null) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    parts.forEach((p, i) => {
      if (!p) return;
      if (a === null) return tset(p.z, 0, now, 0);
      const d = Math.hypot(...[0, 1].map((k) => (cellOf(i)[k] - cellOf(a)[k]) / CELL));
      tset(p.z, i === a ? LIFT : d < 1.5 ? LIFT * 0.25 : 0, now, d * STEP);
    });
    light(a ?? (restMark >= 0 ? restMark : null));
    onRead(a);
    loop.wake();
  }
  // Against the tray's floor, which never moves (rule 01).
  function hit(p: number[]) {
    const [x, y] = unproj(Cs, p[0], p[1], 0);
    if (x < PAD || y < PAD || x > X1 - PAD || y > Y1 - PAD) return null;
    const i = Math.floor((y - PAD) / CELL) * cols + Math.floor((x - PAD) / CELL);
    return i < items.length ? i : null;
  }
  bag.add(pointer(stage, { move: (p: number[]) => choose(hit(p)), leave: () => choose(null) }));
  return bag.dispose;
}
