import * as vscode from 'vscode';
import { resolveLineRelease, type LineReleaseResult } from '@shiplens/core';
import { ShipLensStatusBar } from './statusBar.js';
import { readConfig, type ShipLensConfig } from './config.js';
import { RepoLookup } from './repoCache.js';

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
  private readonly repoLookup = new RepoLookup();
  private readonly disposables: vscode.Disposable[] = [];

  private debounceTimer: NodeJS.Timeout | undefined;
  private lastQueryKey: string | undefined;
  /** Monotonic id used to drop stale async results that finish out of order. */
  private currentRequestId = 0;

  constructor(private readonly logger: vscode.OutputChannel) {
    this.config = readConfig();
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
        if (this.config.statusBarAlignment !== previousAlignment) {
          this.statusBar.dispose();
          this.statusBar = new ShipLensStatusBar(this.config.statusBarAlignment);
        }
        this.lastQueryKey = undefined; // force re-evaluation under new settings
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

    const repoRoot = await this.repoLookup.forFile(filePath);
    if (!repoRoot) {
      this.statusBar.hide();
      return;
    }

    const requestId = ++this.currentRequestId;
    this.statusBar.showLoading();

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
    this.statusBar.showResult(result);
  }

  dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    for (const d of this.disposables) d.dispose();
    this.statusBar.dispose();
  }
}
