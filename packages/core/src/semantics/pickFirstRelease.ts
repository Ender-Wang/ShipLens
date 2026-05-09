import type { SortKey, TagInfo } from '../types.js';
import { matchesGlob } from './glob.js';

export interface PickFirstReleaseArgs {
  /** Tag names returned by `git tag --contains`. */
  containingTagNames: readonly string[];
  /** Metadata index for every tag we care about (typically all repo tags). */
  tagIndex: ReadonlyMap<string, TagInfo>;
  /** Glob patterns to drop (e.g. `*-rc*`). */
  exclude?: readonly string[];
  /** Order key. v0.1 only implements `committerDate`; others fall back to it. */
  sortBy?: SortKey;
}

export interface PickFirstReleaseResult {
  picked: TagInfo | null;
  /** All candidates left after filtering, sorted ascending by the chosen key. */
  candidates: TagInfo[];
}

/**
 * Apply ShipLens' "first release" rules to the set of containing tags. The
 * picking logic is pure and isolated so it can be unit-tested without touching
 * git.
 */
export function pickFirstRelease(args: PickFirstReleaseArgs): PickFirstReleaseResult {
  const { containingTagNames, tagIndex, exclude = [], sortBy = 'committerDate' } = args;

  const candidates: TagInfo[] = [];
  for (const name of containingTagNames) {
    const meta = tagIndex.get(name);
    if (!meta) continue;
    if (exclude.some((pat) => matchesGlob(name, pat))) continue;
    candidates.push(meta);
  }

  candidates.sort((a, b) => compare(a, b, sortBy));
  return { picked: candidates[0] ?? null, candidates };
}

function compare(a: TagInfo, b: TagInfo, key: SortKey): number {
  switch (key) {
    case 'committerDate':
    case 'tagDate':
    case 'topological':
    case 'semver':
    default:
      // v0.1: only committerDate is implemented. tagDate / topological /
      // semver fall through to the same comparison and are scheduled for
      // a later iteration.
      return a.committerDate.localeCompare(b.committerDate);
  }
}
