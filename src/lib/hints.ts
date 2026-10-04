import { invocations } from "~/lib/verify/shell";
import type { HistoryFile } from "~/lib/shell";

/**
 * Stepped hints for each challenge, revealed one at a time after a failed
 * check: a nudge in the right direction, then the commands, then the whole
 * walk-through. The failure messages already name the command for the one
 * check that failed; these cover the challenge as a whole.
 *
 * English only for now — the per-key English fallback in `strings.ts` is the
 * same arrangement the chrome uses for untranslated keys.
 */
export const HINTS: Record<string, [nudge: string, command: string, solution: string]> = {
  meet_the_terminal: [
    "Open a terminal and ask it two questions: who you are, and what day it is.",
    "`whoami` and `date`, each on its own line, then `exit`.",
    "Open Git Bash (Windows) or Terminal (macOS/Linux). Type `whoami`, press Enter. Type `date`, press Enter. Type `exit` so your shell saves its history, then press Check.",
  ],
  command_performance: [
    "Three things: make the terminal say something, list a folder with an option, and ask a command for help.",
    "`echo hello`, `ls -a`, and `ls --help`.",
    "Run `echo hello`, then `ls -a`, then `ls --help`. Optionally `clear`. Close the terminal with `exit` and open a new one before checking, so the history is written.",
  ],
  you_are_here: [
    "A fresh terminal always starts in your home folder. Ask it where that is.",
    "`pwd` prints where you are; `ls` lists what is there.",
    "Open a new terminal, run `pwd` and `ls`, then click Select Folder above and pick exactly the folder `pwd` printed.",
  ],
  there_and_back_again: [
    "Move around four ways: into a folder by name, up one level, straight home, and by a full path.",
    "`cd Documents`, `cd ..`, `cd ~`, and `cd /` (or `cd C:/` on Windows).",
    "Run `cd Documents` (any folder `ls` shows), then `cd ..`, then `cd ~`, then `cd` followed by a full path such as `/tmp` or `C:/Users`. `pwd` after each one shows where you landed.",
  ],
  make_it_so: [
    "Make a practice folder in your home directory, then build files and folders inside it.",
    "`mkdir`, `cd`, `touch`, and `mkdir -p` for nested folders.",
    "From home: `mkdir gitgud-practice`, `cd gitgud-practice`, `touch hello.txt`, `mkdir notes`, `touch notes/day-one.txt`, `mkdir -p notes/archive/2026`. Then pick the `gitgud-practice` folder above.",
  ],
  get_git: [
    "Git needs to be installed, and it needs to know your name and email.",
    '`git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.',
    'Install Git from git-scm.com if `git --version` fails. Then run `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`, and check again.',
  ],
  repository: [
    "A folder becomes a repository when you tell Git to start watching it.",
    "`git init` inside the folder.",
    "`mkdir hello-world`, `cd hello-world`, `git init`. Then click Select Folder above and pick `hello-world`.",
  ],
  commit_to_it: [
    "Make a file, tell Git to include it, then save that moment as a commit.",
    '`git add <file>` then `git commit -m "message"`.',
    'In your repository: create `readme.txt` with any text, run `git status` to see it, `git add readme.txt`, then `git commit -m "Add readme"`. `git status` should now say the tree is clean.',
  ],
  githubbin: [
    "Git needs to know your GitHub username, spelled exactly as GitHub spells it.",
    '`git config --global user.username "YourGitHubName"`.',
    'Sign up at github.com if you have not. Then run `git config --global user.username "YourGitHubName"` — capital letters exactly as on your profile page.',
  ],
  remote_control: [
    "Your local repository needs to know where its GitHub copy lives, then send your commits there.",
    "`git remote add origin <url>` then `git push -u origin <branch>`.",
    "Create an empty repository on GitHub named `hello-world`. Copy its URL. In your local repo run `git remote add origin <url>`, then `git branch --show-current` to see your branch name, then `git push -u origin <that-branch>`.",
  ],
  forks_and_clones: [
    "Fork the practice repo on GitHub, download your fork, then point a second remote at the original.",
    "`git clone <your-fork-url>` then `git remote add upstream <original-url>`.",
    "Fork JyotirmoyDas05/git-gud-verifywork on GitHub. `git clone https://github.com/<you>/git-gud-verifywork.git`, `cd git-gud-verifywork`, `git remote add upstream https://github.com/JyotirmoyDas05/git-gud-verifywork.git`. Pick that folder above.",
  ],
  branches_arent_just_for_birds: [
    "Work on a branch of your own, named after you, add one file, and push the branch.",
    "`git checkout -b add-<username>`, then add, commit, and `git push origin add-<username>`.",
    'In git-gud-verifywork: `git checkout -b add-<username>`. Create `contributors/add-<username>.txt` containing your username. `git add contributors/add-<username>.txt`, `git commit -m "Add <username>"`, `git push origin add-<username>`.',
  ],
  its_a_small_world: [
    "Invite the bot as a collaborator on your fork so it can push to it.",
    "github.com/<you>/git-gud-verifywork/settings/access → Add people → gitgud-verifybot.",
    "Open your fork's Settings → Collaborators (Access) → Add people, enter `gitgud-verifybot`, send the invite. The bot accepts within about 10 minutes — then check again.",
  ],
  pull_never_out_of_date: [
    "The bot pushed a commit to your branch on GitHub. Bring it down to your computer.",
    "`git pull origin add-<username>`.",
    "In git-gud-verifywork, on your `add-<username>` branch, run `git pull origin add-<username>`. `git log` should show the bot's commit.",
  ],
  requesting_you_pull_please: [
    "Ask the original repository to take your branch, from GitHub's website.",
    "Your fork on GitHub → Compare & pull request.",
    "Open your fork on GitHub, click Compare & pull request for `add-<username>`, base: JyotirmoyDas05/git-gud-verifywork `gh-pages`, then Create pull request. The bot reviews and merges it.",
  ],
  merge_tada: [
    "Your work is merged on GitHub. Merge it locally too, delete the old branch, and pull the latest.",
    "`git checkout gh-pages`, `git merge add-<username>`, `git branch -d add-<username>`, `git pull upstream gh-pages`.",
    "In git-gud-verifywork: `git checkout gh-pages`, `git merge add-<username>`, `git branch -d add-<username>`, then `git pull upstream gh-pages`. Optionally `git push origin --delete add-<username>`.",
  ],
};

/** What the course teaches — the targets a typo is matched against. */
const GIT_TAUGHT = [
  "add", "branch", "checkout", "clone", "commit", "config", "diff", "fetch", "init",
  "log", "merge", "pull", "push", "rebase", "remote", "reset", "restore", "rm",
  "stash", "status", "switch", "tag",
];
const SHELL_TAUGHT = ["cd", "clear", "date", "echo", "exit", "git", "ls", "mkdir", "pwd", "touch", "whoami"];

/** Real commands one edit away from a taught one. `cp` is not a typo of `cd`. */
const GIT_REAL = ["am", "mv", "show", "help", "gc", "grep", "notes", "blame", "clean", "reflog", "revert"];
const SHELL_REAL = ["cp", "cls", "ps", "ln", "cat", "dir", "mv", "rm", "man", "vi", "vim", "nano", "code", "less", "set", "cd..", "type", "echo.", "ssh", "sh"];

/** One substitution, insertion, deletion or adjacent swap — `mkdri` is one slip, not two. */
function oneSlip(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].flatMap((c, i) => (c === b[i] ? [] : [i]));
    return (
      diff.length === 1 ||
      (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
}

function closest(word: string, taught: string[], real: string[]): string | null {
  if (word.length < 2 || taught.includes(word) || real.includes(word)) return null;
  return taught.find((k) => oneSlip(word, k)) ?? null;
}

export interface Typo {
  typed: string;
  meant: string;
}

/**
 * The most recent near-miss in the learner's history: `git comit`, `mkdri`,
 * `cd..` stays out (it is valid in cmd and PowerShell). Only the last 15
 * commands, so a typo from last week doesn't get brought up today.
 */
export function recentTypo(files: HistoryFile[]): Typo | null {
  const lines = files.flatMap((f) => f.commands.slice(-15));
  for (const line of lines.reverse()) {
    for (const inv of invocations(line)) {
      if (inv.name === "git" && inv.args[0] && !inv.args[0].startsWith("-")) {
        const meant = closest(inv.args[0], GIT_TAUGHT, GIT_REAL);
        if (meant) return { typed: `git ${inv.args[0]}`, meant: `git ${meant}` };
        continue;
      }
      const meant = closest(inv.name, SHELL_TAUGHT, SHELL_REAL);
      if (meant) return { typed: inv.name, meant };
    }
  }
  return null;
}
