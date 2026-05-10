import * as fs from 'node:fs/promises';
import { blameLine } from './git/blame.js';
import { tagsContaining } from './git/tags.js';
import { GitExecError } from './git/exec.js';
import { getRepoState } from './cache.js';
import { pickFirstRelease } from './semantics/pickFirstRelease.js';
import type { LineReleaseResult, ResolveRequest } from './types.js';

/**
 * The single function the editor shell calls per cursor change. It composes
 * blame → containing-tags → first-release picking, mapping every failure mode
 * onto a {@link LineReleaseResult} variant rather than throwing, so the UI
 * never has to translate exceptions.
 */
export async function resolveLineRelease(req: ResolveRequest): Promise<LineReleaseResult> {
  const tagInclude = req.tagInclude ?? '*';

  // VSCode hands us the path the user opened, which may go through a symlink
  // (notably macOS' /var → /private/var). `git rev-parse --show-toplevel`
  // returns the realpathed root, so without this normalization the relative
  // path passed to `git blame` lands "outside repository". The repoRoot
  // already comes from `findRepoRoot` and is canonical; only the file needs it.
  const filePath = await safeRealpath(req.filePath);
  const repoRoot = req.repoRoot;

  let blame;
  try {
    const opts: Parameters<typeof blameLine>[0] = {
      repoRoot,
      filePath,
      line: req.line,
    };
    if (req.followRenames !== undefined) opts.followRenames = req.followRenames;
    blame = await blameLine(opts);
  } catch (err) {
    if (err instanceof GitExecError) {
      return { kind: 'not-tracked', reason: shortReason(err) };
    }
    throw err;
  }

  if (!blame) {
    return { kind: 'uncommitted' };
  }

  const repoState = await getRepoState(repoRoot, tagInclude);

  let containing: string[];
  try {
    containing = await tagsContaining({
      repoRoot,
      sha: blame.sha,
      ...(tagInclude && tagInclude !== '*' ? { pattern: tagInclude } : {}),
    });
  } catch (err) {
    if (err instanceof GitExecError) {
      return repoState.meta.isShallow
        ? { kind: 'limited-history', sha: blame.sha }
        : { kind: 'not-tracked', reason: shortReason(err) };
    }
    throw err;
  }

  if (containing.length === 0) {
    if (repoState.meta.isShallow) {
      return { kind: 'limited-history', sha: blame.sha };
    }
    return {
      kind: 'unreleased',
      sha: blame.sha,
      ...(blame.summary !== undefined ? { summary: blame.summary } : {}),
      ...(blame.author !== undefined ? { author: blame.author } : {}),
      ...(blame.authorTime !== undefined ? { authorTime: blame.authorTime } : {}),
    };
  }

  const pick = pickFirstRelease({
    containingTagNames: containing,
    tagIndex: repoState.tagIndex,
    ...(req.tagExclude ? { exclude: req.tagExclude } : {}),
    ...(req.sortBy ? { sortBy: req.sortBy } : {}),
  });

  if (!pick.picked) {
    // Every candidate was filtered out (e.g., only pre-release tags contain it).
    return {
      kind: 'unreleased',
      sha: blame.sha,
      ...(blame.summary !== undefined ? { summary: blame.summary } : {}),
      ...(blame.author !== undefined ? { author: blame.author } : {}),
      ...(blame.authorTime !== undefined ? { authorTime: blame.authorTime } : {}),
    };
  }

  return {
    kind: 'released',
    sha: blame.sha,
    ...(blame.summary !== undefined ? { summary: blame.summary } : {}),
    ...(blame.author !== undefined ? { author: blame.author } : {}),
    ...(blame.authorTime !== undefined ? { authorTime: blame.authorTime } : {}),
    tag: pick.picked.name,
    tagCommitSha: pick.picked.commitSha,
    tagDate: pick.picked.committerDate,
    otherTagCount: Math.max(0, pick.candidates.length - 1),
  };
}

function shortReason(err: GitExecError): string {
  const text = err.stderr.trim() || err.message;
  return text.length > 200 ? text.slice(0, 200) + '…' : text;
}

async function safeRealpath(p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    // If the path doesn't exist (e.g., a freshly typed file VSCode hasn't
    // saved yet), fall back to the raw input. Git will surface the right
    // error and we'll degrade to "not-tracked".
    return p;
  }
}
