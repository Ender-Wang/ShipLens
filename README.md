# ShipLens

> A lens from `git blame` to release version. See which release first shipped any line of code, right in your editor.

```
🚢 v1.2.0          ← the line under your cursor first shipped in v1.2.0
🚢 Unreleased      ← committed, but not in any release tag yet
🚢 Uncommitted     ← working-tree edit
🚢 Limited history ← shallow clone; can't determine reliably
```

A single status-bar item, updated as you move the cursor. No new panels, no
hover popups, no editor decorations. Just one quiet line that answers the
question: _"in which release did this line first reach users?"_

## Why this exists

`git blame` answers _who_ last touched a line. Tools like GitLens make that
information beautifully accessible. But none of them answer the equally
important question — **which release first shipped that change to users?**

You can piece it together with `git tag --contains`, `git describe`, or a
trip to the Changelog, but each of those means leaving the editor and
breaking your reading flow. ShipLens collapses that lookup into a glance at
the status bar.

## How ShipLens differs from GitLens

| Dimension | GitLens | ShipLens |
|---|---|---|
| Core question | **Who** changed this line, **when** | **Which release** shipped this line |
| Primary UI | Inline blame, hover, side panels | A single line in the status bar |
| Performance focus | Whole-file blame, rich UI | Single-line query, minimal noise |
| Configuration surface | High | Minimal |
| Coexistence | — | Fully compatible; runs alongside GitLens |

ShipLens is intentionally narrow. If GitLens is the microscope, ShipLens is
the timestamp on the slide.

## Use cases

- **Code archaeology** — spot a critical line and immediately know which
  release it first appeared in. No editor switch, no Changelog hunting.
- **Bug triage** — a user reports "it broke in v1.3.0"; jump to the suspect
  line and verify whether it was indeed introduced there.
- **Regression test scoping** — use the first-release tag to decide which
  versions need re-testing for a given change.
- **Documentation and review** — cite a release version directly from the
  status bar when explaining a change to teammates.
- **Multi-repo workflows** — in microservice or multi-repo setups, quickly
  correlate a change in the current repo with its release graph.

## Roadmap

### v0.1 — POC (current)

- [x] First-release tag for the current line, displayed in the status bar.
- [x] Tooltip with commit SHA, summary, author, and tag date.
- [x] Tag include/exclude glob configuration (pre-releases filtered by default).
- [x] Multi-root workspace isolation.
- [x] Graceful degradation for `Uncommitted`, `Unreleased`, and `Limited history`.

### v0.2 — planned

- [ ] Click status bar to open the corresponding GitHub / GitLab tag page.
- [ ] Multi-line selection: show the earliest and latest release across the range.
- [ ] Monorepo tag-prefix routing (e.g., `frontend-v*` vs. `backend-v*`).
- [ ] Background tag-DAG index for instant lookups on large repos.

### v0.3 and beyond

- [ ] Issue / PR linking through commit message references (`Fixes #123` → release).
- [ ] File-level release timeline view (every release in which the file changed).
- [ ] CI/CD signal hookup — tag → pipeline status alongside the version.
- [ ] JetBrains plugin reusing the same core.
- [ ] Optional integration with GitLens' blame data source.

## Configuration

The defaults work for most repos. The full set of v0.1 settings:

| Setting | Default | Description |
|---|---|---|
| `shiplens.tagInclude` | `*` | Glob passed to `git tag --contains`. |
| `shiplens.tagExclude` | `["*-rc*", "*-beta*", "*-alpha*", "*-pre*", "*-dev*", "*-snapshot*"]` | Patterns dropped after the include filter. |
| `shiplens.sortBy` | `committerDate` | How candidate tags are ordered. |
| `shiplens.debounceMs` | `150` | Delay between cursor movement and the next query. |
| `shiplens.followRenames` | `false` | Pass `--follow` to `git blame`. |
| `shiplens.statusBar.alignment` | `right` | Status bar position. |

## Project structure

This is an npm-workspaces monorepo:

- **`packages/core`** — `@shiplens/core`, the editor-agnostic library that
  does the git work. Pure TypeScript, no editor dependencies.
- **`packages/vscode-extension`** — `shiplens`, the VSCode extension shell.
  UI, configuration, and event wiring; no git logic of its own.

The split keeps the door open for a future JetBrains plugin to reuse the
same core.

## Development

```bash
nvm use            # picks up Node 22 from .nvmrc
npm install
npm run build
```

### Debug in an Extension Development Host

Open this folder in VSCode and press **F5** ("Run Extension"). A new window
opens with ShipLens loaded. `npm run watch` keeps the bundle fresh while you
iterate; reload the host window (`Cmd+R`) after a change.

### Build a `.vsix` and install manually

```bash
npm run package        # produces packages/vscode-extension/shiplens-<version>.vsix
npm run install:vsix   # runs `code --install-extension ... --force`
```

Or install from the VSCode UI: **Extensions** panel → `…` menu → **Install
from VSIX…** → pick `packages/vscode-extension/shiplens-0.1.0.vsix`.

To uninstall: `code --uninstall-extension ender-wang.shiplens` (or via the
Extensions panel).

## License

MIT — see [`LICENSE`](./LICENSE).
