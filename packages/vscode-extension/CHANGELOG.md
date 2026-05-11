# Changelog

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
