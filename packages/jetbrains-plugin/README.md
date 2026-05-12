# shiplens-jetbrains

JetBrains Platform plugin for ShipLens. Same algorithm and feature set as the [VSCode/Cursor extension](../vscode-extension/), reimplemented in Kotlin so the plugin ships as a standalone JAR with no Node runtime, no IPC, and no per-platform binaries.

## What it does

When you move the cursor inside a tracked file in any IntelliJ-Platform IDE (IDEA, PyCharm, GoLand, WebStorm, RubyMine, CLion, Rider, DataGrip, PhpStorm, RustRover, DataSpell, Android Studio, MPS), the status bar shows the **first release tag that contains the line under your cursor**:

```
🚢 v1.2.0          ← the line first shipped in v1.2.0
🚢 Unreleased      ← committed, but not in any release tag yet
🚢 Uncommitted     ← working-tree edit
🚢 Limited history ← shallow clone; can't determine reliably
```

Hover the widget for commit SHA, summary, author, tag date.

## Build & run

Requires **JDK 21** and (for `runIde`) any IntelliJ-Platform IDE installed locally. By default the build points at `/Applications/IntelliJ IDEA.app/Contents` (override via `localIdePath` in `gradle.properties`).

```bash
cd packages/jetbrains-plugin

# Build the plugin (output: build/distributions/shiplens-jetbrains-<version>.zip)
./gradlew buildPlugin

# Launch a sandboxed IDE with the plugin loaded
./gradlew runIde
```

`runIde` opens a fresh IDE instance with ShipLens enabled. Open any folder that's a git repo with tags, then move the cursor. The status bar item appears in the bottom-right.

To install the built `.zip` into your real IDE: **Settings → Plugins → ⚙️ → Install Plugin from Disk…**.

## Project layout

```
packages/jetbrains-plugin/
├── build.gradle.kts              # IntelliJ Platform Gradle plugin config
├── gradle.properties             # plugin metadata + platform target
├── settings.gradle.kts
├── CHANGELOG.md                  # mirrors VSCode CHANGELOG (version-aligned)
└── src/main/
    ├── kotlin/com/shiplens/jetbrains/
    │   ├── core/                 # algorithm port (mirror of @shiplens/core)
    │   │   ├── Types.kt
    │   │   ├── Cache.kt
    │   │   ├── Resolve.kt
    │   │   ├── git/              # git wrappers via ProcessBuilder
    │   │   └── semantics/        # glob + pickFirstRelease
    │   ├── editor/               # FileEditorManager listener
    │   ├── settings/             # Settings UI + persistent state
    │   └── statusbar/            # StatusBarWidget + factory + formatter
    └── resources/META-INF/
        ├── plugin.xml            # plugin manifest (drives marketplace + Plugin Manager UI)
        └── pluginIcon.svg        # 40x40 SVG, ASCII-only, < 2 KB (per JetBrains spec)
```

`core/` mirrors the structure of `@shiplens/core` (in `packages/core/`) so changes in one are easy to mirror in the other.

## Publishing

```bash
export JETBRAINS_MARKETPLACE_TOKEN=<your_token>
./gradlew publishPlugin
```

The token comes from <https://plugins.jetbrains.com/author/me/tokens>. First publish requires a verified vendor; subsequent versions auto-update.

## Maintenance contract with `@shiplens/core`

The Kotlin port mirrors `@shiplens/core`'s shape so changes are mechanical:

| TS file | Kotlin equivalent |
|---|---|
| `core/src/types.ts` | `core/Types.kt` |
| `core/src/git/exec.ts` | `core/git/GitExec.kt` |
| `core/src/git/blame.ts` | `core/git/Blame.kt` |
| `core/src/git/tags.ts` | `core/git/Tags.kt` |
| `core/src/git/repo.ts` | `core/git/Repo.kt` |
| `core/src/semantics/glob.ts` | `core/semantics/Glob.kt` |
| `core/src/semantics/pickFirstRelease.ts` | `core/semantics/PickFirstRelease.kt` |
| `core/src/cache.ts` | `core/Cache.kt` |
| `core/src/resolve.ts` | `core/Resolve.kt` |

When the algorithm changes in `@shiplens/core`, mirror the change in the corresponding Kotlin file. The pure-logic surface (~90 lines across `glob` + `pickFirstRelease`) is the only place where syntax differences matter; the git-wrapper layer is mechanical.

## License

MIT — see [`../../LICENSE`](../../LICENSE).
