import { describe, expect, it } from "vitest";

import { streakLength, week } from "./streak";

const at = (s: string) => new Date(`${s}T12:00:00`);

describe("streak", () => {
  it("counts back from today, and still stands before today's practice", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03"];
    expect(streakLength(days, at("2026-10-03"))).toBe(3);
    expect(streakLength(days, at("2026-10-04"))).toBe(3);
    expect(streakLength(days, at("2026-10-05"))).toBe(0);
    expect(streakLength(["2026-09-30", "2026-10-02"], at("2026-10-02"))).toBe(1);
  });

  it("lays out Monday to Sunday", () => {
    const w = week(["2026-09-28", "2026-10-04"], at("2026-10-04"));
    expect(w.map((d) => d.done)).toEqual([true, false, false, false, false, false, true]);
    expect(w[6].isToday).toBe(true);
  });
});
