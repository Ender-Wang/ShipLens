# Changelog

## 0.1.3 — bust the cache when refs move

- **Fix**: status bar could keep showing `Uncommitted` (or `Unreleased`) for a line that the user had since committed and tagged. The per-line `ResultCache` was keyed on the editor's `doc.version`, which doesn't change for out-of-band repo events (commits, branch switches, fetches, pulls, tag pushes), so a stale verdict could outlive the conditions that produced it.
- **Fix**: stop memoizing the two volatile result kinds — `uncommitted` and `unreleased`. Both flip the moment the user commits or pushes a tag; the rerun cost is one `git blame` on a single line, which is cheap.
- **New**: per-repo file watcher on `.git/HEAD` and `.git/refs/**`. Any ref change busts both the per-line cache and the core's tag index, and forces an immediate refresh so the status bar reflects the new state without needing a window reload.

## 0.1.2 — quieter `rescue/*` tags by default

- **Default change**: `rescue/*` is now in the default `tagExclude`. Some projects use namespaced tags like `rescue/<id>` for internal hotfix or recovery releases; without filtering, those land as the "first release" because they tend to predate the next official `v*` tag — technically correct per the documented algorithm, but often surprising. Users who *do* want rescue tags surfaced can override `shiplens.tagExclude` to remove the pattern.

## 0.1.1 — polish

- **Fix**: status-bar no longer flickers on cursor changes — removed the
  loading state that caused two width-shifts per cursor move.
- **Perf**: per-line result cache (200 entries, doc-version-keyed) so
  back-and-forth navigation between recently-visited lines is instant.
- **Perf**: drop redundant `realpath` on the repo root (already canonical
  from `git rev-parse --show-toplevel`).
- **Build**: produce a fixed-name `shiplens.vsix` so install scripts don't
  break on every version bump.
- Extension icon (256×256 PNG).

## 0.1.0 — initial POC

- Status-bar display of the first release tag containing the current line.
- Tooltip with commit SHA, summary, author, and tag date.
- Tag include/exclude glob configuration.
- Degradation for uncommitted lines, unreleased commits, and shallow clones.
- Multi-root workspace support.
