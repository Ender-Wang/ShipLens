import * as path from 'node:path';
import { runGit } from './exec.js';
import type { BlameLineInfo } from '../types.js';

const ZERO_SHA = /^0+$/;

/**
 * Blame a single line. Returns `null` if the line is uncommitted (working-tree
 * edit, blame returns the all-zero sentinel SHA) so callers can map that to
 * the `Uncommitted` UI state without inspecting the SHA themselves.
 */
export async function blameLine(args: {
  repoRoot: string;
  filePath: string;
  /** 1-based line number. */
  line: number;
  followRenames?: boolean;
}): Promise<BlameLineInfo | null> {
  const { repoRoot, filePath, line, followRenames } = args;
  if (!Number.isInteger(line) || line < 1) {
    throw new RangeError(`blameLine: line must be a positive integer, got ${line}`);
  }

  // git wants the file argument relative to the repo root for unambiguous lookup.
  const rel = path.relative(repoRoot, filePath);

  const gitArgs: string[] = [
    'blame',
    '--porcelain',
    '-L',
    `${line},${line}`,
  ];
  if (followRenames) {
    gitArgs.push('--follow');
  }
  // No explicit ref — we want the working-tree version of the file, so that
  // uncommitted edits surface as the all-zero sentinel SHA (→ Uncommitted UI).
  // `--` disambiguates the path from a possible ref of the same name.
  gitArgs.push('--', rel);

  const stdout = await runGit(gitArgs, { cwd: repoRoot });
  return parsePorcelainBlame(stdout);
}

/**
 * Parse the porcelain output of a single-line blame. The format is documented
 * at https://git-scm.com/docs/git-blame#_the_porcelain_format. We only need a
 * handful of headers, so we parse line-by-line rather than pulling in a lib.
 */
function parsePorcelainBlame(stdout: string): BlameLineInfo | null {
  const lines = stdout.split('\n');
  if (lines.length === 0 || lines[0]!.length === 0) return null;

  // First line: "<sha> <orig-line> <final-line> <num-lines-in-group>"
  const header = lines[0]!.split(' ');
  const sha = header[0] ?? '';
  if (!sha || ZERO_SHA.test(sha)) {
    return null;
  }

  let summary: string | undefined;
  let author: string | undefined;
  let authorTime: string | undefined;

  for (let i = 1; i < lines.length; i++) {
    const ln = lines[i]!;
    if (ln.startsWith('\t')) break; // body line — end of headers
    if (ln.startsWith('summary ')) {
      summary = ln.slice('summary '.length);
    } else if (ln.startsWith('author ')) {
      author = ln.slice('author '.length);
    } else if (ln.startsWith('author-time ')) {
      const epoch = Number.parseInt(ln.slice('author-time '.length), 10);
      if (Number.isFinite(epoch)) {
        authorTime = new Date(epoch * 1000).toISOString();
      }
    }
  }

  return { sha, summary, author, authorTime };
}
