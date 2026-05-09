import type { RepoMeta, TagInfo } from './types.js';
import { loadRepoMeta } from './git/repo.js';
import { loadAllTagInfo } from './git/tags.js';

interface RepoCacheEntry {
  meta: RepoMeta;
  tagIndex: Map<string, TagInfo>;
  loadedAt: number;
}

const TTL_MS = 60_000;
const cache = new Map<string, RepoCacheEntry>();

/**
 * Cached per-repo state: shallow flag + tag metadata index. Tag listings are
 * relatively cheap but happen on every line query, so caching is worthwhile.
 * The TTL guards against stale data after the user pulls or fetches.
 */
export async function getRepoState(repoRoot: string, tagInclude?: string): Promise<RepoCacheEntry> {
  const cached = cache.get(repoRoot);
  const now = Date.now();
  if (cached && now - cached.loadedAt < TTL_MS) {
    return cached;
  }

  const [meta, tags] = await Promise.all([
    loadRepoMeta(repoRoot),
    loadAllTagInfo({ repoRoot, ...(tagInclude ? { pattern: tagInclude } : {}) }),
  ]);
  const tagIndex = new Map(tags.map((t) => [t.name, t] as const));
  const entry: RepoCacheEntry = { meta, tagIndex, loadedAt: now };
  cache.set(repoRoot, entry);
  return entry;
}

export function invalidateRepo(repoRoot?: string): void {
  if (repoRoot) {
    cache.delete(repoRoot);
  } else {
    cache.clear();
  }
}
