import * as vscode from 'vscode';
import type { LineReleaseResult } from '@shiplens/core';

export interface StatusDisplay {
  text: string;
  tooltip: vscode.MarkdownString;
}

const SHIP = '🚢';

/**
 * Map a {@link LineReleaseResult} to a status-bar text + Markdown tooltip.
 * The icon is the 🚢 emoji to mirror the product name and the plan's mockups.
 * Emoji renders consistently in the status bar across themes and platforms.
 */
export function formatResult(result: LineReleaseResult): StatusDisplay {
  switch (result.kind) {
    case 'released':
      return {
        text: `${SHIP} ${result.tag}`,
        tooltip: tooltip([
          `**ShipLens** — first release: \`${result.tag}\``,
          '',
          `**Commit**: \`${shortSha(result.sha)}\`${result.summary ? ` — ${escape(result.summary)}` : ''}`,
          result.author ? `**Author**: ${escape(result.author)}` : null,
          result.authorTime ? `**Authored**: ${formatDate(result.authorTime)}` : null,
          '',
          `**Tag points to**: \`${shortSha(result.tagCommitSha)}\``,
          `**Tag dated**: ${formatDate(result.tagDate)}`,
          result.otherTagCount > 0
            ? `_Also contained in ${result.otherTagCount} other tag${result.otherTagCount === 1 ? '' : 's'}._`
            : null,
        ]),
      };

    case 'unreleased':
      return {
        text: `${SHIP} Unreleased`,
        tooltip: tooltip([
          '**ShipLens** — this commit is not part of any release tag yet.',
          '',
          `**Commit**: \`${shortSha(result.sha)}\`${result.summary ? ` — ${escape(result.summary)}` : ''}`,
          result.author ? `**Author**: ${escape(result.author)}` : null,
          result.authorTime ? `**Authored**: ${formatDate(result.authorTime)}` : null,
        ]),
      };

    case 'uncommitted':
      return {
        text: `${SHIP} Uncommitted`,
        tooltip: tooltip([
          '**ShipLens** — this line has uncommitted changes in the working tree.',
        ]),
      };

    case 'limited-history':
      return {
        text: `${SHIP} Limited history`,
        tooltip: tooltip([
          '**ShipLens** — repository has shallow history; cannot reliably determine the first release.',
          '',
          `**Commit**: \`${shortSha(result.sha)}\``,
          '',
          'Run `git fetch --unshallow` to enable full lookups.',
        ]),
      };

    case 'not-tracked':
      return {
        text: `${SHIP} —`,
        tooltip: tooltip([
          '**ShipLens** — file is not tracked by git, or git query failed.',
          '',
          `_${escape(result.reason)}_`,
        ]),
      };
  }
}

function tooltip(lines: Array<string | null>): vscode.MarkdownString {
  const md = new vscode.MarkdownString(lines.filter((l): l is string => l !== null).join('\n\n'), true);
  md.isTrusted = false;
  md.supportThemeIcons = true;
  return md;
}

function shortSha(sha: string): string {
  return sha.slice(0, 8);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function escape(s: string): string {
  return s.replace(/[\\`*_{}\[\]()#+\-.!|<>]/g, (c) => `\\${c}`);
}
