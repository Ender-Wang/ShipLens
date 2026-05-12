# Changelog

## 0.1.2 — initial CLI release

First release of the standalone CLI. Brings feature parity with the [VSCode/Cursor edition](https://marketplace.visualstudio.com/items?itemName=Ender-Wang.shiplens) and [JetBrains plugin](https://plugins.jetbrains.com/plugin/31705-shiplens) at the same version line. The CLI starts at `0.1.2` to keep cross-platform version numbering in sync going forward — all three editions advance together.

### What ships

- `shiplens line <file>:<line>` — the workhorse command. Runs blame → tag scan → first-release pick and emits a multi-line human-readable summary or a stable JSON object.
- `shiplens commit <sha>` — same algorithm without the blame step, for CI scripts and agents that already know the commit they care about.
- `shiplens version` and `shiplens help`.
- Five result kinds, identical to the editor extensions: `released`, `unreleased`, `uncommitted`, `limited-history`, `not-tracked`.
- Tag include/exclude globs (`--include`, repeatable `--exclude`). Defaults match the editor extensions: `*-rc*`, `*-beta*`, `*-alpha*`, `*-pre*`, `*-dev*`, `*-snapshot*`, `rescue/*`.
- `--follow` flag passes through to `git blame --follow` for renamed-file resolution.
- Stable `--json` schema with `omitempty` semantics.
- Flag-after-positional ordering supported (`shiplens line file:42 --json` works the same as `shiplens line --json file:42`).
- ~3.5 MB single static binary. Cold-start ~50 ms on a small repo (git ops dominate).
- `git` is the only runtime dependency.

### Mapping to VSCode / JetBrains versions

The CLI 0.1.2 release folds in everything from the editor extensions at the same version line:

- **First-release algorithm** identical to `@shiplens/core` (TypeScript) and the Kotlin port. Pure logic (`glob.go` + `pickfirst.go`, ~110 lines combined) is the only place where syntax differences matter; the git-wrapper layer is mechanical.
- **Default `tagExclude`** matches both editor extensions, including the `rescue/*` addition from VSCode 0.1.2.
- **Result variants** are 1:1 with `LineReleaseResult` in `@shiplens/core`. JSON field names are stable.

### Distribution

- Homebrew formula and prebuilt release archives land alongside the first tagged CLI release.
- Until then, install from source with `go install github.com/Ender-Wang/ShipLens/packages/cli/cmd/shiplens@latest`.

Future releases will be lockstep — when any edition bumps for an algorithm fix, the others advance on the same day.
