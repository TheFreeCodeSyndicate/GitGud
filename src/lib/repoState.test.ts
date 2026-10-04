import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setGitRunner, type GitOutput } from "~/lib/git";
import { recentTypo } from "~/lib/hints";
import { describeChanges, layout, recentCommits, snapshot } from "./repoState";

const exec = promisify(execFile);

async function git(args: string[], cwd?: string): Promise<GitOutput> {
  try {
    const { stdout, stderr } = await exec("git", args, { cwd, env: { ...process.env, LANG: "C", LC_ALL: "C" } });
    return { stdout, stderr, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", code: err.code ?? 1 };
  }
}

let dir: string;
beforeAll(() => {
  setGitRunner(git);
  dir = mkdtempSync(join(tmpdir(), "gitgud-state-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("what changed", () => {
  it("narrates init → commit → branch → merge, and graphs it", async () => {
    const s0 = await snapshot(dir);
    expect(s0.repo).toBe(false);

    await git(["init", "--initial-branch=main"], dir);
    await git(["config", "user.email", "t@example.com"], dir);
    await git(["config", "user.name", "T"], dir);
    const s1 = await snapshot(dir);
    expect(describeChanges(s0, s1)[0]).toMatch(/became a Git repository/);

    writeFileSync(join(dir, "a.txt"), "a\n");
    const dirty = await snapshot(dir);
    expect(dirty.dirty).toBe(1);
    await git(["add", "-A"], dir);
    await git(["commit", "-m", "first"], dir);
    const s2 = await snapshot(dir);
    expect(describeChanges(dirty, s2)).toEqual([
      "1 new commit on `main`.",
      "Working tree is clean — nothing left uncommitted.",
    ]);

    await git(["checkout", "-b", "feature"], dir);
    writeFileSync(join(dir, "b.txt"), "b\n");
    await git(["add", "-A"], dir);
    await git(["commit", "-m", "on feature"], dir);
    const s3 = await snapshot(dir);
    expect(describeChanges(s2, s3)).toEqual([
      "New branch `feature` created.",
      "You switched from `main` to `feature` — HEAD moved with you.",
    ]);

    await git(["checkout", "main"], dir);
    writeFileSync(join(dir, "c.txt"), "c\n");
    await git(["add", "-A"], dir);
    await git(["commit", "-m", "on main"], dir);
    await git(["merge", "--no-edit", "feature"], dir);
    await git(["branch", "-d", "feature"], dir);
    const s4 = await snapshot(dir);
    expect(describeChanges(s3, s4)).toContain("Branch `feature` was deleted.");

    // merge, main, feature, first — the merge's second parent opens lane 1.
    const { nodes, lanes } = layout(await recentCommits(dir));
    expect(nodes[0].subject).toBe("Merge branch 'feature'");
    expect(new Set(nodes.map((n) => n.subject))).toEqual(new Set(["Merge branch 'feature'", "on feature", "on main", "first"]));
    expect(nodes[0].refs[0]).toBe("HEAD -> main");
    expect(lanes).toBe(2);
    expect(nodes[nodes.length - 1].subject).toBe("first");
    expect(nodes[nodes.length - 1].lane).toBe(0);
  });
});

describe("layout", () => {
  it("keeps a straight history in one lane and stubs a missing parent", () => {
    const { nodes, edges, lanes } = layout([
      { hash: "c", parents: ["b"], refs: [], subject: "" },
      { hash: "b", parents: ["a"], refs: [], subject: "" },
    ]);
    expect(lanes).toBe(1);
    expect(nodes.map((n) => n.lane)).toEqual([0, 0]);
    expect(edges[edges.length - 1].to).toEqual({ lane: 0, row: 2 });
  });
});

describe("typos", () => {
  const hist = (...commands: string[]) => [{ shell: "bash", path: "~/.bash_history", commands }];

  it("catches near misses, newest first", () => {
    expect(recentTypo(hist("git comit -m x"))).toEqual({ typed: "git comit", meant: "git commit" });
    expect(recentTypo(hist("git stauts"))).toEqual({ typed: "git stauts", meant: "git status" });
    expect(recentTypo(hist("mkdri notes", "pwdd"))).toEqual({ typed: "pwdd", meant: "pwd" });
  });

  it("leaves real commands alone", () => {
    expect(recentTypo(hist("cp a b", "cls", "cat x", "git show", "git status", "code .", "ls -a"))).toBeNull();
  });
});
