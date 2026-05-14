import * as vscode from 'vscode';
import {
  invalidateRepo,
  resolveLineRelease,
  type LineReleaseResult,
} from '@shiplens/core';
import { ShipLensStatusBar } from './statusBar.js';
import { readConfig, type ShipLensConfig } from './config.js';
import { RepoLookup } from './repoCache.js';
import { ResultCache } from './resultCache.js';

/**
 * Coordinates VSCode events with the core resolver and the status bar.
 *
 * Responsibilities:
 *  - Watch active editor + selection changes.
 *  - Debounce (config-driven) and skip work when the relevant inputs haven't changed.
 *  - Map untracked / uri-scheme-not-file states to a hidden status bar.
 *  - Recreate the status bar when the alignment config changes.
 */
export class ShipLensController implements vscode.Disposable {
  private statusBar: ShipLensStatusBar;
  private config: ShipLensConfig;
  private configFingerprint: string;
  private readonly repoLookup = new RepoLookup();
  private readonly resultCache = new ResultCache();
  private readonly disposables: vscode.Disposable[] = [];
  /**
   * One watcher per repo root. We arm a fs-watcher on `<repo>/.git/HEAD` and
   * `<repo>/.git/refs/**` so that an out-of-band commit, branch switch, fetch,
   * or tag push (none of which bump the editor's `doc.version`) busts our
   * caches and the very next cursor event re-runs git instead of serving a
   * stale verdict.
   */
  private readonly refWatchers = new Map<string, vscode.FileSystemWatcher>();

  private debounceTimer: NodeJS.Timeout | undefined;
  private lastQueryKey: string | undefined;
  /** Monotonic id used to drop stale async results that finish out of order. */
  private currentRequestId = 0;

  constructor(private readonly logger: vscode.OutputChannel) {
    this.config = readConfig();
    this.configFingerprint = fingerprintConfig(this.config);
    this.statusBar = new ShipLensStatusBar(this.config.statusBarAlignment);

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.scheduleRefresh()),
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor !== vscode.window.activeTextEditor) return;
        this.scheduleRefresh();
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('shiplens')) return;
        const previousAlignment = this.config.statusBarAlignment;
        this.config = readConfig();
        this.configFingerprint = fingerprintConfig(this.config);
        if (this.config.statusBarAlignment !== previousAlignment) {
          this.statusBar.dispose();
          this.statusBar = new ShipLensStatusBar(this.config.statusBarAlignment);
        }
        this.lastQueryKey = undefined;
        this.resultCache.clear(); // settings affect picking; cached results may now be wrong.
        this.scheduleRefresh(0);
      }),
    );

    this.scheduleRefresh(0);
  }

  private scheduleRefresh(delayOverrideMs?: number): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    const delay = delayOverrideMs ?? this.config.debounceMs;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.refreshNow();
    }, delay);
  }

  private async refreshNow(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.statusBar.hide();
      this.lastQueryKey = undefined;
      return;
    }

    const doc = editor.document;
    if (doc.uri.scheme !== 'file') {
      // Output panels, untitled docs, settings — nothing for us to resolve.
      this.statusBar.hide();
      this.lastQueryKey = undefined;
      return;
    }

    const line = editor.selection.active.line + 1; // VSCode is 0-based; git is 1-based.
    const filePath = doc.uri.fsPath;
    const queryKey = `${filePath}::${line}::${doc.version}`;
    if (queryKey === this.lastQueryKey) return;
    this.lastQueryKey = queryKey;

    const cacheKey = `${queryKey}::${this.configFingerprint}`;
    const cached = this.resultCache.get(cacheKey);
    if (cached) {
      this.statusBar.showResult(cached);
      return;
    }

    const repoRoot = await this.repoLookup.forFile(filePath);
    if (!repoRoot) {
      this.statusBar.hide();
      return;
    }
    this.ensureRefWatcher(repoRoot);

    const requestId = ++this.currentRequestId;

    // Stale-while-revalidate: keep the previous status-bar text on screen
    // while the new query runs. Showing a loading state here would cause two
    // width-changes per cursor move (loading → result), which other status
    // bar items pick up as a visible reflow / "glitch".

    let result: LineReleaseResult;
    try {
      result = await resolveLineRelease({
        repoRoot,
        filePath,
        line,
        tagInclude: this.config.tagInclude,
        tagExclude: this.config.tagExclude,
        sortBy: this.config.sortBy,
        followRenames: this.config.followRenames,
      });
    } catch (err) {
      this.logger.appendLine(`[shiplens] resolve failed: ${(err as Error).message}`);
      if (requestId === this.currentRequestId) {
        this.statusBar.showResult({ kind: 'not-tracked', reason: (err as Error).message });
      }
      return;
    }

    if (requestId !== this.currentRequestId) return; // stale
    // Only memoize stable verdicts. `uncommitted` flips the moment the user
    // commits; `unreleased` flips the moment a release tag is pushed; neither
    // event bumps `doc.version`, so caching them risks the bug where the
    // status bar keeps showing the pre-commit verdict until the user reloads.
    if (isStableResult(result)) {
      this.resultCache.set(cacheKey, result);
    }
    this.statusBar.showResult(result);
  }

  /**
   * Arm a watcher on `<repo>/.git/HEAD` and `<repo>/.git/refs/**` if we don't
   * already have one. Refs change on commit, branch switch, fetch, pull, tag,
   * push — every operation that can flip a previously-cached verdict.
   */
  private ensureRefWatcher(repoRoot: string): void {
    if (this.refWatchers.has(repoRoot)) return;

    // Glob captures HEAD (commits + branch switches) and any ref under refs/
    // (tags, branches, stashes). We don't care which file changed; any change
    // is enough to bust the per-line cache and the core's per-repo state.
    const pattern = new vscode.RelativePattern(repoRoot, '.git/{HEAD,refs/**}');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const onRefChange = (): void => {
      this.invalidateForRepo(repoRoot);
      // Force the very next refresh, even if the cursor hasn't moved, by
      // wiping `lastQueryKey`. Schedule with no delay so the user sees the
      // new verdict as soon as their commit lands.
      this.lastQueryKey = undefined;
      this.scheduleRefresh(0);
    };

    watcher.onDidChange(onRefChange);
    watcher.onDidCreate(onRefChange);
    watcher.onDidDelete(onRefChange);

    this.refWatchers.set(repoRoot, watcher);
    this.disposables.push(watcher);
  }

  /** Drop every cached result for files under this repo + bust the core's tag index. */
  private invalidateForRepo(repoRoot: string): void {
    invalidateRepo(repoRoot);
    // Result cache is keyed on absolute paths; clear everything under repoRoot.
    // Cheap brute force — the cache caps at 200 entries.
    this.resultCache.deleteByPrefix(`${repoRoot}/`);
  }

  dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    for (const d of this.disposables) d.dispose();
    this.refWatchers.clear();
    this.statusBar.dispose();
    this.resultCache.clear();
  }
}

function isStableResult(r: LineReleaseResult): boolean {
  // `released` and `limited-history` have no failure mode that flips them
  // without a ref change (which our watcher already busts). `not-tracked`
  // also relies on the ref watcher (e.g. user runs `git add` on the file).
  // `uncommitted` and `unreleased` are the volatile pair — see comment above.
  return r.kind === 'released' || r.kind === 'limited-history' || r.kind === 'not-tracked';
}

function fingerprintConfig(config: ShipLensConfig): string {
  // Only the fields that affect the resolved result need to be in the key —
  // statusBar.alignment and debounceMs do not.
  return [
    config.tagInclude,
    config.tagExclude.join(','),
    config.sortBy,
    config.followRenames ? '1' : '0',
  ].join('|');
}
