<p align="center">
  <img src="./packages/vscode-extension/icons/shiplens.png" alt="ShipLens" width="128" />
</p>

# ShipLens

> A lens from `git blame` to release version. See which release first shipped any line of code, right in your editor.

<div align="center">

[![VS Marketplace](https://img.shields.io/github/package-json/v/Ender-Wang/ShipLens?filename=packages%2Fvscode-extension%2Fpackage.json&label=VS%20Marketplace&color=007ACC&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=Ender-Wang.shiplens)
[![Open VSX](https://img.shields.io/open-vsx/v/Ender-Wang/shiplens?label=Open%20VSX&color=A60EE5)](https://open-vsx.org/extension/Ender-Wang/shiplens)
[![JetBrains](https://img.shields.io/jetbrains/plugin/v/31705?label=JetBrains&color=FE2857)](https://plugins.jetbrains.com/plugin/31705-shiplens)
[![Homebrew](https://img.shields.io/github/v/release/Ender-Wang/ShipLens?label=Homebrew&color=FBB040&logo=homebrew&logoColor=white)](https://github.com/Ender-Wang/homebrew-tap)
[![License: MIT](https://img.shields.io/github/license/Ender-Wang/ShipLens)](./LICENSE)

</div>

```
🚢 v1.2.0          ← the line under your cursor first shipped in v1.2.0
🚢 Unreleased      ← committed, but not in any release tag yet
🚢 Uncommitted     ← working-tree edit
🚢 Limited history ← shallow clone; can't determine reliably
```

A single status-bar item, updated as you move the cursor. No new panels, no
hover popups, no editor decorations. Just one quiet line that answers the
question: _"in which release did this line first reach users?"_

## Install

ShipLens runs in three places: VSCode-compatible editors, JetBrains-Platform IDEs, and your terminal.

| Surface | Where to get it |
|---|---|
| VSCode | [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=Ender-Wang.shiplens) |
| Cursor / VSCodium / Theia / Gitpod | [Open VSX Registry](https://open-vsx.org/extension/Ender-Wang/shiplens) |
| Any JetBrains-Platform IDE (2025.1+) | [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/31705-shiplens) |
| Terminal (macOS / Linux) | [`brew install ender-wang/tap/shiplens`](https://github.com/Ender-Wang/homebrew-tap) |
| Terminal (any OS, manual) | [GitHub Releases](https://github.com/Ender-Wang/ShipLens/releases) — `shiplens-cli-*.tar.gz` / `.zip` |

**JetBrains IDE coverage** — verified compatible: IntelliJ IDEA (Ultimate + Community), PyCharm (Pro + Community), GoLand, WebStorm, RubyMine, CLion, Rider, DataGrip, PhpStorm, RustRover, DataSpell, Android Studio, MPS. Not supported: AppCode (deprecated upstream), JetBrains Gateway, JetBrains Client, Code With Me Guest.

In an editor, open the Extensions panel (`Cmd+Shift+X` / `Ctrl+Shift+X`), search **ShipLens**, click **Install**. All editor builds ship the same algorithm, byte-for-byte.

To install an editor extension from the command line:

```bash
code --install-extension Ender-Wang.shiplens     # VSCode
cursor --install-extension Ender-Wang.shiplens   # Cursor
```

To install the CLI:

```bash
brew install ender-wang/tap/shiplens             # macOS / Linux (Homebrew)
shiplens line src/auth.ts:42                     # → 🚢 v1.2.0
shiplens commit abc1234 --json                   # stable JSON for scripts / CI
```

Requires VSCode `1.85+` (or any compatible fork) for the editor extension; the CLI has no runtime dependencies beyond `git` on `PATH`. Works alongside GitLens.

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

## How it knows (and when it doesn't)

ShipLens shows a tag only when three things are true:

1. `git blame -L N,N -- file` reports commit `C` as the line's last author.
2. `git tag --contains C` includes tag `T`.
3. `T` is the earliest non-pre-release tag in that set, ordered by the **committer date of the commit each tag points to**.

Steps 1 and 2 are pure git — the same machinery that powers GitLens, GitHub blame, and `git rev-list`. We don't reinterpret them. Step 3 is the only judgment call: we sort by committer date because tag _creation_ date can lag the actual release (retroactive tagging), _author_ date can predate the merge by months, and _topological_ order isn't well-defined when commits are cherry-picked across release branches. Pre-releases are filtered before the pick via `shiplens.tagInclude` / `shiplens.tagExclude` (defaults exclude `*-rc*`, `*-beta*`, `*-alpha*`, `*-pre*`, `*-dev*`, `*-snapshot*`).

When any of those assumptions doesn't hold, ShipLens says so explicitly rather than guess: `Uncommitted` (working-tree edit), `Unreleased` (no containing tag yet), `Limited history` (shallow clone, ancestry can't be traversed reliably).

You can reproduce the algorithm by hand in any repo:

```bash
git blame -L N,N -- file                            # → commit SHA
git tag --contains <sha>                            # → candidate tags
for t in <candidates>; do                           # → committer dates
  echo -n "$t  "; git log -1 --format='%cI' "$t"
done | sort -k2
```

The first non-pre-release line in that sorted output is what the status bar shows. If they ever disagree, that's a bug — please [open an issue](https://github.com/Ender-Wang/ShipLens/issues).

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

## Use it from an agent

The `shiplens` CLI (see [Install](#install)) covers scripts, CI jobs, and any agent that can shell out. For Cursor specifically, ShipLens also ships a [Cursor Agent Skill](https://docs.cursor.com/) that teaches the agent the same algorithm without needing the binary on `PATH`. Install it once:

```bash
mkdir -p ~/.cursor/skills
cp -r skills/shiplens ~/.cursor/skills/
```

Then ask your agent things like:

- _"Which release first shipped line 42 of `src/auth.ts`?"_
- _"In which version did the regression on line 88 of this file land?"_
- _"What tag contains commit abc1234?"_

The skill auto-activates on those phrasings — no need to mention "ShipLens" by name. It runs the exact same `git blame → git tag --contains → first by committer date` pipeline as the editor extension, with the same default filters.

The canonical skill source lives at [`skills/shiplens/SKILL.md`](./skills/shiplens/SKILL.md) in this repo. It's updated alongside extension releases when defaults change.

## Roadmap

### v0.1 — shipped

Available on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=Ender-Wang.shiplens), [Open VSX Registry](https://open-vsx.org/extension/Ender-Wang/shiplens), and [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/31705-shiplens).

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
| `shiplens.tagExclude` | `["*-rc*", "*-beta*", "*-alpha*", "*-pre*", "*-dev*", "*-snapshot*", "rescue/*"]` | Patterns dropped after the include filter. Covers common pre-release suffixes and the `rescue/*` namespace some teams use for internal hotfixes. |
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
- **`packages/jetbrains-plugin`** — `shiplens-jetbrains`, a Kotlin port of the
  algorithm + IntelliJ-Platform integration (status bar, settings,
  listeners). Single-JAR, no Node runtime, no IPC. Mirrors `@shiplens/core`'s
  structure file-for-file for easy lockstep maintenance.

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
npm run package        # produces packages/vscode-extension/shiplens.vsix
npm run install:vsix   # runs `code --install-extension ... --force`
```

Or install from the VSCode UI: **Extensions** panel → `…` menu → **Install
from VSIX…** → pick `packages/vscode-extension/shiplens.vsix`.

To uninstall: `code --uninstall-extension Ender-Wang.shiplens` (or via the
Extensions panel).

## License

MIT — see [`LICENSE`](./LICENSE).
