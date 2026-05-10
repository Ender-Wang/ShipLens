import * as vscode from 'vscode';
import type { LineReleaseResult } from '@shiplens/core';
import { formatResult } from './format.js';

export class ShipLensStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(alignment: 'left' | 'right') {
    this.item = vscode.window.createStatusBarItem(
      alignment === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right,
      // Negative-ish priority keeps us out of the way of language status / errors.
      alignment === 'left' ? 100 : -100,
    );
    this.item.name = 'ShipLens';
  }

  showResult(result: LineReleaseResult): void {
    const { text, tooltip } = formatResult(result);
    this.item.text = text;
    this.item.tooltip = tooltip;
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  dispose(): void {
    this.item.dispose();
  }
}
