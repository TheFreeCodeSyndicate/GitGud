import confetti from "canvas-confetti";

/**
 * Raycast's confetti: two cannons in the bottom corners of the window, each
 * firing up and inward across the whole screen.
 *
 * The numbers are the ones the Vicinae confetti extension uses to imitate it
 * (ESHAYAT102/vicinae-confetti-extension, confetti.py): 320 pieces split
 * between the corners, each corner covering the quarter turn from straight up
 * to straight across, launch speed 0.68–1.4 × the window height per second,
 * gravity 1.25 × the height, every piece let go at a random moment in the
 * first 0.45 s, and its eight colours. canvas-confetti draws them, as it does
 * for Raycast.
 */
const COLORS = ["#ff4f64", "#ff8a00", "#ffd60a", "#ff5db1", "#9b6dff", "#5b8cff", "#31c5f4", "#72d572"];
const PIECES = 320;
const WAVES = 9; // the 0.45 s release, in steps
const SPREAD_MS = 450;

let triangle: confetti.Shape | null = null;

/**
 * canvas-confetti moves per frame: the launch speed decays by `decay` and the
 * piece falls a constant `gravity × 3` px. In the extension a typical piece
 * (mid speed, mid angle) peaks about half the window up, so solve for the
 * start velocity whose arc peaks there.
 */
function startVelocity(decay: number, gravity: number) {
  const target = window.innerHeight * 0.5;
  const sin = Math.sin((67.5 * Math.PI) / 180);
  const peak = (v: number) => {
    let y = 0;
    for (let dy = sin * v - gravity * 3; dy > 0; v *= decay, dy = sin * v - gravity * 3) y += dy;
    return y;
  };
  let lo = 1, hi = 400;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (peak(mid) < target) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Both corner cannons at once. `scale` > 1 for the bigger moments. */
export function cannons(scale = 1) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  triangle ??= confetti.shapeFromPath({ path: "M0 -6 L6 6 L-6 6 Z" });
  const decay = 0.93;
  const gravity = 1.25;
  const base = {
    colors: COLORS,
    shapes: ["square", "circle", triangle] as confetti.Shape[],
    spread: 90,
    startVelocity: startVelocity(decay, gravity),
    decay,
    gravity,
    ticks: 320,
    scalar: 1.15,
    zIndex: 200,
    disableForReducedMotion: true,
  };
  const perWave = Math.round((PIECES * scale) / 2 / WAVES);
  for (let w = 0; w < WAVES; w++) {
    window.setTimeout(() => {
      // Up-and-right from the left corner, up-and-left from the right.
      void confetti({ ...base, particleCount: perWave, angle: 45, origin: { x: 0, y: 1 } });
      void confetti({ ...base, particleCount: perWave, angle: 135, origin: { x: 1, y: 1 } });
    }, w === 0 ? 0 : Math.random() * SPREAD_MS);
  }
}

let audio: AudioContext | null = null;

/** Square-wave notes, one after another, each held and fading. */
export function chime(freqs: number[], volume = 0.05, gap = 0.08) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime + 0.01;
    freqs.forEach((freq, i) => {
      const at = t + i * gap;
      const len = i === freqs.length - 1 ? 0.45 : 0.09;
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(gain).connect(audio!.destination);
      osc.start(at);
      osc.stop(at + len);
    });
  } catch {
    // No audio device is not a reason to lose the moment.
  }
}

/** The plumber's coin: B5 then E6. Synthesised, so there is no file to ship. */
export const coinSound = (volume = 0.05) => chime([987.77, 1318.51], volume);
