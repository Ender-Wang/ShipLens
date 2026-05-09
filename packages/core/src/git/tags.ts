import { runGit } from './exec.js';
import type { TagInfo } from '../types.js';

/**
 * Names of tags whose tip-or-pointed-commit contains `sha`. One subprocess.
 * Pattern is passed to `git tag` (a fnmatch glob, e.g. `v*`).
 */
export async function tagsContaining(args: {
  repoRoot: string;
  sha: string;
  pattern?: string;
}): Promise<string[]> {
  const { repoRoot, sha, pattern } = args;
  const gitArgs = ['tag', '--contains', sha];
  if (pattern && pattern !== '*') {
    gitArgs.push(pattern);
  }
  const out = await runGit(gitArgs, { cwd: repoRoot });
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

const FIELD_SEP = '\x1f'; // ASCII unit separator — won't appear in any of the fields we read.
const FORMAT = [
  '%(refname:short)',
  '%(*objectname)',
  '%(objectname)',
  '%(*committerdate:iso-strict)',
  '%(committerdate:iso-strict)',
].join(FIELD_SEP);

/**
 * Snapshot of all tag metadata in the repo, optionally filtered by a glob.
 * One subprocess regardless of tag count, so safe to call eagerly.
 *
 * Annotated tags expose `*objectname` / `*committerdate` (the pointed-to
 * commit). Lightweight tags ARE the commit, so `objectname` /
 * `committerdate` already refer to it. We pick whichever is non-empty.
 */
export async function loadAllTagInfo(args: {
  repoRoot: string;
  pattern?: string;
}): Promise<TagInfo[]> {
  const { repoRoot, pattern } = args;
  const refspec = pattern && pattern !== '*' ? `refs/tags/${pattern}` : 'refs/tags/';
  const out = await runGit(['for-each-ref', `--format=${FORMAT}`, refspec], { cwd: repoRoot });

  const tags: TagInfo[] = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    const parts = line.split(FIELD_SEP);
    if (parts.length < 5) continue;
    const [name, starObject, object, starDate, date] = parts;
    const commitSha = (starObject || object || '').trim();
    const committerDate = (starDate || date || '').trim();
    if (!name || !commitSha) continue;
    tags.push({ name, commitSha, committerDate });
  }
  return tags;
}
