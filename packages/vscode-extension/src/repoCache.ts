import { findRepoRoot } from '@shiplens/core';

/**
 * Maps absolute file paths to their containing repo root, with a small
 * negative-result cache so we don't re-shell-out for every untracked file.
 *
 * VSCode itself can fire selection events at high frequency for non-git
 * files (output panes, settings, walkthroughs); this keeps that path cheap.
 */
export class RepoLookup {
  private readonly hits = new Map<string, string>();
  private readonly misses = new Set<string>();

  async forFile(filePath: string): Promise<string | null> {
    if (this.misses.has(filePath)) return null;
    const cached = this.hits.get(filePath);
    if (cached) return cached;

    const root = await findRepoRoot(filePath);
    if (root) {
      this.hits.set(filePath, root);
      return root;
    }
    this.misses.add(filePath);
    return null;
  }

  clear(): void {
    this.hits.clear();
    this.misses.clear();
  }
}
