import { useEffect, useRef, useState, type ReactNode } from "react";
import { FolderOpen, SquareTerminal } from "lucide-react";

import { mountFolderFigure, type FolderItem } from "~/lib/folderFigure";
import { listDir, shellHistory, type HistoryFile } from "~/lib/shell";
import { mountTerminalFigure } from "~/lib/terminalFigure";
import { strings } from "~/strings";

// ponytail: both panels poll every 2 s while visible; file watchers would be instant.
const POLL_MS = 2000;

/** Re-reads `load` while the window is visible, publishing only real changes. */
function usePoll<T>(load: () => Promise<T>, deps: unknown[]): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let last = "", alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await load().catch(() => null);
      const key = JSON.stringify(next);
      if (alive && key !== last) {
        last = key;
        setValue(next);
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // load is rebuilt each render; what it reads is in deps.
  }, deps);
  return value;
}

function Panel({ icon, title, live, aside, children }: { icon: ReactNode; title: string; live: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="alert-glass my-6 rounded-lg border p-4">
      <header className="flex items-center gap-2 text-sm">
        {icon}
        <span className="whitespace-nowrap font-medium">{title}</span>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
          <span className="size-1.5 animate-pulse bg-success" />
          {live}
        </span>
        {aside && <span className="ml-auto truncate text-muted-foreground text-xs">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

/** A figure's stage and svg, mounted by `mount` whenever `key` changes. */
function Figure({ mount, deps, className }: { mount: (stage: HTMLElement, svg: SVGSVGElement) => () => void; deps: unknown[]; className?: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!stage.current || !svg.current) return;
    return mount(stage.current, svg.current);
  }, deps);
  return (
    <div ref={stage} data-hairline="live" className={className}>
      <svg ref={svg} viewBox="0 0 400 320" aria-hidden="true" />
    </div>
  );
}

const LINES = 24;

/**
 * The learner's terminal: their real recent commands, as Hairline's terminal
 * figure. The history file most recently added to is the one shown, so with
 * two shells open it follows the one in use.
 */
export function TerminalPanel({ locale }: { locale: string }) {
  const t = strings(locale);
  const [active, setActive] = useState<number | null>(null);
  const pick = useRef<{ path: string; tails: Record<string, string> }>({ path: "", tails: {} });

  const file = usePoll<HistoryFile | null>(async () => {
    const files = (await shellHistory()).filter((f) => f.commands.length > 0);
    if (!files.length) return null;
    const seen = pick.current;
    const moved = files.find((f) => seen.tails[f.path] !== undefined && seen.tails[f.path] !== f.commands[f.commands.length - 1]);
    seen.tails = Object.fromEntries(files.map((f) => [f.path, f.commands[f.commands.length - 1] ?? ""]));
    const chosen = moved ?? files.find((f) => f.path === seen.path) ?? [...files].sort((a, b) => b.commands.length - a.commands.length)[0];
    seen.path = chosen.path;
    return { ...chosen, commands: chosen.commands.slice(-LINES) };
  }, []);

  if (!file) return null;
  const lines = file.commands;
  const shown = active ?? lines.length - 1;

  return (
    <Panel icon={<SquareTerminal className="size-4 text-muted-foreground" />} title={t.termTitle} live={t.repoLive} aside={<span title={file.path}>{file.shell}</span>}>
      <div className="mt-2 flex items-center gap-4">
        <Figure className="w-[20rem] shrink-0" deps={[JSON.stringify(lines)]} mount={(st, sv) => mountTerminalFigure(st, sv, lines, setActive)} />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">{active === null ? t.termLast : t.termLine}</p>
          <code className="mt-1 block truncate rounded-md bg-muted px-2 py-1.5 font-mono text-sm [font-variant-ligatures:none]" data-selectable>
            <span className="text-success-foreground">$</span> {lines[shown]}
          </code>
          <p className="mt-3 text-muted-foreground text-xs leading-relaxed">{t.termHint}</p>
        </div>
      </div>
    </Panel>
  );
}

const MAX_ITEMS = 16;

/** The learner's folder, as things on a tray: boxes for folders, sheets for files. */
export function FolderPanel({ dir, locale }: { dir: string; locale: string }) {
  const t = strings(locale);
  const [active, setActive] = useState<number | null>(null);

  const items = usePoll<FolderItem[]>(async () => {
    const entries = (await listDir(dir)).filter((e) => !e.name.startsWith(".")).slice(0, MAX_ITEMS);
    entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
    return Promise.all(
      entries.map(async (e) => ({
        name: e.name,
        isDir: e.isDir,
        count: e.isDir ? (await listDir(`${dir}/${e.name}`).catch(() => [])).filter((c) => !c.name.startsWith(".")).length : 0,
      })),
    );
  }, [dir]);

  if (!items) return null;
  const it = active === null ? null : items[active];

  return (
    <Panel icon={<FolderOpen className="size-4 text-muted-foreground" />} title={t.folderTitle} live={t.repoLive} aside={<span title={dir}>{dir.split(/[\\/]/).filter(Boolean).pop()}</span>}>
      <div className="mt-2 flex items-center gap-4">
        <Figure className="w-[20rem] shrink-0" deps={[JSON.stringify(items)]} mount={(st, sv) => mountFolderFigure(st, sv, items, setActive)} />
        <div className="min-w-0 flex-1">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.folderEmpty}</p>
          ) : it ? (
            <>
              <p className="text-muted-foreground text-xs">{it.isDir ? t.folderIsDir : t.folderIsFile}</p>
              <code className="mt-1 block truncate font-mono text-sm" data-selectable>
                {it.name}
                {it.isDir && "/"}
              </code>
              {it.isDir && <p className="mt-1 text-muted-foreground text-xs">{t.folderHolds.replace("{n}", String(it.count))}</p>}
            </>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t.folderSummary.replace("{d}", String(items.filter((x) => x.isDir).length)).replace("{f}", String(items.filter((x) => !x.isDir).length))}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
