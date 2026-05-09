import * as path from 'node:path';
import { GitExecError, runGit } from './exec.js';
import type { RepoMeta } from '../types.js';

/**
 * Locate the repo containing `filePath`, or `null` if it isn't tracked by git.
 * Resolves symlinks via `--show-toplevel`, which returns a normalized path.
 */
export async function findRepoRoot(filePath: string): Promise<string | null> {
  const dir = path.dirname(filePath);
  try {
    const out = await runGit(['rev-parse', '--show-toplevel'], { cwd: dir });
    const root = out.trim();
    return root.length > 0 ? root : null;
  } catch (err) {
    if (err instanceof GitExecError) {
      // Not inside a git work tree, or git binary missing — treat as untracked.
      return null;
    }
    throw err;
  }
}

export async function isShallowRepo(repoRoot: string): Promise<boolean> {
  try {
    const out = await runGit(['rev-parse', '--is-shallow-repository'], { cwd: repoRoot });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

export async function loadRepoMeta(repoRoot: string): Promise<RepoMeta> {
  const isShallow = await isShallowRepo(repoRoot);
  return { root: repoRoot, isShallow };
}
