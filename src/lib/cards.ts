import {
  Calendar,
  CloudDownload,
  CloudUpload,
  CornerLeftUp,
  Download,
  Eraser,
  FilePlus,
  FileSearch,
  FolderOpen,
  FolderPlus,
  GitBranch,
  GitBranchPlus,
  GitCommitHorizontal,
  GitCompare,
  GitFork,
  GitMerge,
  History,
  List,
  LogOut,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Plug,
  Plus,
  Settings2,
  Sprout,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { invocations, type Invocation } from "~/lib/verify/shell";
import type { HistoryFile } from "~/lib/shell";

/**
 * Command cards, after Oh My Git!'s deck: every command the course teaches is
 * a card with an icon and one line on what it does. A card is collected the
 * first time the learner really runs the command — read from the same shell
 * history the terminal checks use — so the deck is a record of what they
 * have done, not what they have read.
 */
export interface Card {
  id: string;
  /** As typed. */
  cmd: string;
  /** One line, in the voice of the lessons. */
  does: string;
  icon: LucideIcon;
  module: "terminal" | "files" | "git";
  /** The challenge that teaches it, for the face-down hint. */
  taught: string;
  match: (inv: Invocation) => boolean;
}

const sh = (name: string) => (inv: Invocation) => inv.name === name;
const git = (sub: string, flag?: (args: string[]) => boolean) => (inv: Invocation) =>
  inv.name === "git" && inv.args[0] === sub && (!flag || flag(inv.args));

export const CARDS: Card[] = [
  { id: "whoami", cmd: "whoami", does: "Asks the computer who you are.", icon: UserRound, module: "terminal", taught: "meet_the_terminal", match: sh("whoami") },
  { id: "date", cmd: "date", does: "Prints today's date and time.", icon: Calendar, module: "terminal", taught: "meet_the_terminal", match: sh("date") },
  { id: "echo", cmd: "echo", does: "Says back whatever you give it.", icon: MessageSquareText, module: "terminal", taught: "command_performance", match: sh("echo") },
  { id: "ls", cmd: "ls", does: "Lists what is in this folder.", icon: List, module: "terminal", taught: "command_performance", match: sh("ls") },
  { id: "clear", cmd: "clear", does: "Wipes the screen clean.", icon: Eraser, module: "terminal", taught: "command_performance", match: (i) => i.name === "clear" || i.name === "cls" },
  { id: "exit", cmd: "exit", does: "Closes the terminal.", icon: LogOut, module: "terminal", taught: "meet_the_terminal", match: sh("exit") },

  { id: "pwd", cmd: "pwd", does: "Shows the folder you are standing in.", icon: MapPin, module: "files", taught: "you_are_here", match: sh("pwd") },
  { id: "cd", cmd: "cd", does: "Walks into another folder.", icon: FolderOpen, module: "files", taught: "there_and_back_again", match: (i) => i.name === "cd" && !i.args[0]?.startsWith("..") },
  { id: "cd-up", cmd: "cd ..", does: "Steps back out to the parent folder.", icon: CornerLeftUp, module: "files", taught: "there_and_back_again", match: (i) => i.name === "cd" && Boolean(i.args[0]?.startsWith("..")) },
  { id: "mkdir", cmd: "mkdir", does: "Makes a new folder.", icon: FolderPlus, module: "files", taught: "make_it_so", match: sh("mkdir") },
  { id: "touch", cmd: "touch", does: "Makes a new, empty file.", icon: FilePlus, module: "files", taught: "make_it_so", match: (i) => i.name === "touch" || i.name === "ni" || i.name === "New-Item" },

  { id: "git-version", cmd: "git --version", does: "Proves Git is installed.", icon: PackageCheck, module: "git", taught: "get_git", match: (i) => i.name === "git" && i.args.includes("--version") },
  { id: "git-config", cmd: "git config", does: "Tells Git who you are.", icon: Settings2, module: "git", taught: "get_git", match: git("config") },
  { id: "git-init", cmd: "git init", does: "Turns a folder into a repository.", icon: Sprout, module: "git", taught: "repository", match: git("init") },
  { id: "git-status", cmd: "git status", does: "Shows what changed and what is staged.", icon: FileSearch, module: "git", taught: "commit_to_it", match: git("status") },
  { id: "git-add", cmd: "git add", does: "Stages changes for the next commit.", icon: Plus, module: "git", taught: "commit_to_it", match: git("add") },
  { id: "git-commit", cmd: "git commit", does: "Saves a snapshot, with a message.", icon: GitCommitHorizontal, module: "git", taught: "commit_to_it", match: git("commit") },
  { id: "git-diff", cmd: "git diff", does: "Shows exactly what changed, line by line.", icon: GitCompare, module: "git", taught: "commit_to_it", match: git("diff") },
  { id: "git-log", cmd: "git log", does: "Reads the history, newest first.", icon: History, module: "git", taught: "commit_to_it", match: git("log") },
  { id: "git-remote", cmd: "git remote", does: "Links your repository to one online.", icon: Plug, module: "git", taught: "remote_control", match: git("remote") },
  { id: "git-push", cmd: "git push", does: "Sends your commits up to GitHub.", icon: CloudUpload, module: "git", taught: "remote_control", match: git("push") },
  { id: "git-clone", cmd: "git clone", does: "Copies a repository down to your computer.", icon: Download, module: "git", taught: "forks_and_clones", match: git("clone") },
  { id: "git-branch-new", cmd: "git checkout -b", does: "Starts a new branch and moves onto it.", icon: GitBranchPlus, module: "git", taught: "branches_arent_just_for_birds", match: (i) => i.name === "git" && ((i.args[0] === "checkout" && i.args.includes("-b")) || (i.args[0] === "switch" && i.args.includes("-c"))) },
  { id: "git-branch", cmd: "git branch", does: "Lists, names or deletes branches.", icon: GitBranch, module: "git", taught: "branches_arent_just_for_birds", match: git("branch") },
  { id: "git-pull", cmd: "git pull", does: "Brings new commits down and merges them in.", icon: CloudDownload, module: "git", taught: "pull_never_out_of_date", match: git("pull") },
  { id: "git-fetch", cmd: "git fetch", does: "Checks GitHub for news without merging it.", icon: GitFork, module: "git", taught: "merge_tada", match: git("fetch") },
  { id: "git-merge", cmd: "git merge", does: "Joins one branch's work into another.", icon: GitMerge, module: "git", taught: "merge_tada", match: git("merge") },
];

export const cardById = (id: string) => CARDS.find((c) => c.id === id);

/** Which cards the history shows the learner has played. */
export function playedCards(files: HistoryFile[]): string[] {
  const all = files.flatMap((f) => f.commands.flatMap(invocations));
  return CARDS.filter((c) => all.some(c.match)).map((c) => c.id);
}
