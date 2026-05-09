import * as vscode from 'vscode';
import type { SortKey } from '@shiplens/core';

export interface ShipLensConfig {
  tagInclude: string;
  tagExclude: string[];
  sortBy: SortKey;
  debounceMs: number;
  followRenames: boolean;
  statusBarAlignment: 'left' | 'right';
}

export function readConfig(): ShipLensConfig {
  const cfg = vscode.workspace.getConfiguration('shiplens');
  return {
    tagInclude: cfg.get<string>('tagInclude', '*'),
    tagExclude: cfg.get<string[]>('tagExclude', []),
    sortBy: cfg.get<SortKey>('sortBy', 'committerDate'),
    debounceMs: cfg.get<number>('debounceMs', 150),
    followRenames: cfg.get<boolean>('followRenames', false),
    statusBarAlignment: cfg.get<'left' | 'right'>('statusBar.alignment', 'right'),
  };
}
