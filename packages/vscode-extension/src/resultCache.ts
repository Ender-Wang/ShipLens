import type { LineReleaseResult } from '@shiplens/core';

/**
 * Tiny FIFO-bounded cache keyed by (file, line, document version, config
 * fingerprint). A hit short-circuits the entire git pipeline so back-and-forth
 * cursor movement between recently-visited lines is effectively free.
 *
 * Document version is part of the key so any edit transparently invalidates
 * cached results for that file — we never serve a tag for a line whose blame
 * could have changed.
 */
export class ResultCache {
  private readonly map = new Map<string, LineReleaseResult>();
  private readonly maxEntries: number;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  get(key: string): LineReleaseResult | undefined {
    const hit = this.map.get(key);
    if (hit !== undefined) {
      // Refresh recency by re-inserting (Map preserves insertion order).
      this.map.delete(key);
      this.map.set(key, hit);
    }
    return hit;
  }

  set(key: string, value: LineReleaseResult): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxEntries) {
      // Evict the oldest entry.
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  /**
   * Drop every entry whose key starts with `prefix`. Used to invalidate all
   * cached lines for a file (`<filePath>::`) or for a repo (`<repoRoot>/`).
   */
  deleteByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) {
        this.map.delete(key);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.map.clear();
  }
}
