import { today } from "~/lib/progress";

/**
 * Days in a row with at least one challenge completed, Duolingo's way: a
 * streak still stands on a day you haven't practised yet, and only breaks once
 * a whole day passes without one.
 */
export function streakLength(days: string[], now = new Date()): number {
  const set = new Set(days);
  const d = new Date(now);
  if (!set.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** The current week, Monday first: each day's date and whether it counts. */
export function week(days: string[], now = new Date()): { date: Date; done: boolean; isToday: boolean }[] {
  const set = new Set(days);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { date, done: set.has(today(date)), isToday: today(date) === today(now) };
  });
}

/** Streak lengths that earn the bigger moment, as Duolingo saves its full-screen ones. */
const MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365];
export const isMilestone = (n: number) => MILESTONES.includes(n) || (n > 365 && n % 100 === 0);
