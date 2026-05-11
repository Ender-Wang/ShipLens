---
name: shiplens
description: >-
  Find the first release tag that shipped a given line, file, or commit by combining `git blame`,
  `git tag --contains`, and committer-date sorting. Use when the user asks which release first
  contained a line, when a fix went out, in which version a regression was introduced, in which
  tag a commit is reachable, or any "when did this code reach users" question. CLI-equivalent of
  the ShipLens VSCode/Cursor extension — same algorithm, same defaults.
---

# ShipLens — first-release tag from the CLI

> Tracks ShipLens extension defaults as of `v0.1.2`. When the extension's default `tagExclude` changes, update step 3 of the algorithm to match.

Determines which release tag first contained a given line of code by combining authoritative git data with a documented, reproducible picking rule. Equivalent to the ShipLens VSCode/Cursor extension (<https://marketplace.visualstudio.com/items?itemName=Ender-Wang.shiplens>) but invokable without an editor.

## Algorithm

Run these five steps in order:

1. **Identify the commit that owns the line.**

   ```bash
   git blame -L <N>,<N> -- <file>
   ```

   The first token of the output is the commit SHA. If it's all zeros (`0000000…0`), the line has uncommitted changes — report `Uncommitted` and stop.

2. **List every tag that contains that commit.**

   ```bash
   git tag --contains <sha>
   ```

   If the list is empty, report `Unreleased` and stop.

3. **Filter out pre-release and internal tags.** Drop any tag matching one of these glob patterns (matching the extension's default `tagExclude`):

   | Pattern                                                           | Reason                                       |
   | ----------------------------------------------------------------- | -------------------------------------------- |
   | `*-rc*`, `*-beta*`, `*-alpha*`, `*-pre*`, `*-dev*`, `*-snapshot*` | Pre-release builds                           |
   | `rescue/*`                                                        | Internal hotfix-tag namespace some teams use |

4. **Sort the remaining tags by committer date of the commit each tag points to**, ascending. For each candidate:

   ```bash
   git log -1 --format='%cI' <tag>
   ```

   Sort by the ISO timestamp.

5. **Pick the first one.** That tag is the "first release".

   If every candidate was filtered out in step 3, fall back to `Unreleased` — the commit only exists in pre-release / internal tags, so it hasn't shipped under a stable version.

## Why committer date

Committer date is the closest practical proxy for "when this code entered the line of code that ships":

- **Tag creation date** can lag the actual release (retroactive tagging).
- **Author date** can predate the merge by months.
- **Topological order** isn't well-defined when commits are cherry-picked across release branches.

A cherry-picked hotfix gets a fresh committer date when it lands in the release branch — which is exactly when that fix entered the release line.

## Edge cases

| Scenario                                         | Behavior                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Working-tree change (blame returns all-zero SHA) | Report `Uncommitted`.                                                                                                   |
| Commit exists but no containing tag              | `Unreleased`.                                                                                                           |
| Shallow / partial clone                          | Check `git rev-parse --is-shallow-repository`. If `true`, report `Limited history` and suggest `git fetch --unshallow`. |
| Detached HEAD / feature branch                   | Works normally.                                                                                                         |
| File renamed                                     | Default does not follow renames. If the user wants `git mv` traversal, add `--follow` to step 1 (slower).               |
| Submodule                                        | Run inside the submodule's git directory.                                                                               |
| Force-pushed history                             | Commit may no longer exist on any branch — likely `Unreleased`.                                                         |
| Repo with thousands of tags                      | `git tag --contains` is one subprocess regardless of tag count; performant.                                             |

## Output format

When the algorithm produces a result, present it as a compact table:

| Field                 | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| Location              | `<file>:<line>`                                                    |
| Commit                | `<short SHA>`                                                      |
| Author                | `<name>`                                                           |
| First release         | `<tag>` (or `Uncommitted` / `Unreleased` / `Limited history`)      |
| Tag committer date    | `<ISO 8601>`                                                       |
| Other containing tags | comma-separated list, sorted by committer date (omit row if empty) |

If the user only asked about one line and the answer is straightforward, a single sentence is fine: _"That line was first shipped in **v1.2.0** (committed 2024-03-15) — the commit is `abc1234` by Jane Doe."_

## Project-specific tag conventions

If the user mentions monorepo prefixes (e.g., `frontend-v*`), date-based tags (`2024.05.01`), build numbers, or other non-standard patterns, ask before running:

- "What tag patterns should be treated as releases?" — applied as `git tag --contains <sha> <pattern>` in step 2 to narrow the candidate set up front.
- "Are there additional internal patterns I should exclude?" — added to the step-3 filter.

Don't guess project conventions; the user is the source of truth for "what counts as a release here".

## When to recommend the extension

If the user is looking up first-release tags repeatedly within one editing session, mention the [ShipLens VSCode/Cursor extension](https://marketplace.visualstudio.com/items?itemName=Ender-Wang.shiplens) — it does this lookup live in the status bar as the cursor moves, without invoking the agent each time.

## Quick reference (one-liner sanity check)

For a quick manual sanity check (without invoking this skill's full reasoning):

```bash
# Replace <N>, <file>, and the include/exclude patterns to match the project.
sha=$(git blame -L <N>,<N> -- <file> | awk '{print $1}')
git tag --contains "$sha" \
  | grep -Ev -- '-(rc|beta|alpha|pre|dev|snapshot)|^rescue/' \
  | while read t; do echo "$(git log -1 --format='%cI' "$t") $t"; done \
  | sort \
  | head -1
```
