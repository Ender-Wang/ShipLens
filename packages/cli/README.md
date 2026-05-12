# shiplens (CLI)

Standalone CLI for ShipLens, written in Go. Same algorithm and feature set as the [VSCode/Cursor extension](../vscode-extension/) and the [JetBrains plugin](../jetbrains-plugin/), packaged as a single static binary so it can drop into shells, CI runs, pre-commit hooks, and agent loops with zero runtime dependencies beyond `git`.

## What it does

```
$ shiplens line src/auth.ts:42
🚢 v1.2.0
  commit:   a1b2c3d4 — fix: tighten session expiry
  author:   Ender Wang
  authored: 2025-08-12 09:14:33 CST
  tag:      v1.2.0 (commit 9e7f1abc, 2025-08-15 11:00:00 CST)
  also in:  3 other tags
```

Returns one of five **kinds**, mirroring the editor extensions:

| Kind | Meaning |
|---|---|
| `released` | The line's commit is contained in at least one non-pre-release tag. The earliest such tag is reported. |
| `unreleased` | The commit exists in history but no matching tag points to it (or its descendants) yet. |
| `uncommitted` | The line was modified in the working tree and hasn't been committed. |
| `limited-history` | The repo is a shallow clone; tag membership can't be determined reliably. |
| `not-tracked` | File is outside any git work tree, or `git` failed. `reason` carries the raw error. |

## Install

> Homebrew formula and prebuilt release archives land with the first published tag — see the project root [`README.md`](../../README.md) for status. Until then, build from source.

```bash
# Build from source (requires Go 1.23+)
go install github.com/Ender-Wang/ShipLens/packages/cli/cmd/shiplens@latest

# Or build locally
cd packages/cli
go build -o bin/shiplens ./cmd/shiplens
./bin/shiplens version
```

## Usage

```
shiplens line   <file>:<line>   [--json] [--include GLOB] [--exclude GLOB]... [--follow]
shiplens commit <sha>           [--json] [--cwd DIR]    [--include GLOB] [--exclude GLOB]...
shiplens version
shiplens help
```

Examples:

```bash
# Line-mode, the workhorse
shiplens line packages/core/src/resolve.ts:42

# Same, machine-readable
shiplens line packages/core/src/resolve.ts:42 --json | jq '.tag'

# Skip blame, just look up an arbitrary commit
shiplens commit a1b2c3d --cwd ~/code/myrepo

# Override default tag filters (specifying any --exclude REPLACES the defaults)
shiplens line src/auth.ts:42 --include 'v*' --exclude '*-rc*' --exclude 'rescue/*'
```

Default `tagExclude` (used when `--exclude` is not given) matches the editor extensions: `*-rc* *-beta* *-alpha* *-pre* *-dev* *-snapshot* rescue/*`.

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. Any LineReleaseResult kind, including `unreleased`/`not-tracked`. |
| `1` | Unexpected error (git failed unexpectedly, IO error). |
| `2` | Bad usage (parse error, missing positional). |

`shiplens` deliberately returns `0` for any *finding* — only failures of the tool itself are non-zero. Scripts that want to fail on `unreleased` should pipe through `jq -e '.kind == "released"'`.

## JSON schema (stable)

```jsonc
{
  "kind": "released" | "unreleased" | "uncommitted" | "limited-history" | "not-tracked",
  "sha": "<commit sha>",
  "summary": "<commit subject>",
  "author": "<author name>",
  "authorTime": "2025-08-12T01:14:33Z",  // ISO-8601 UTC
  "tag": "<tag name>",
  "tagCommitSha": "<sha the tag points at>",
  "tagDate": "2025-08-15T11:00:00+08:00", // iso-strict (with offset)
  "otherTagCount": 3,                     // tags after the picked one
  "reason": "<git stderr>"                // present on not-tracked
}
```

Fields not relevant to a given `kind` are omitted. Shape is stable across patch and minor releases.

## Project layout

```
packages/cli/
├── go.mod
├── README.md                   # this file
├── CHANGELOG.md                # mirrors VSCode/JetBrains CHANGELOG (version-aligned)
├── cmd/shiplens/main.go        # entrypoint: subcommand dispatch + flag parsing
└── internal/
    ├── core/                   # algorithm port (mirror of @shiplens/core)
    │   ├── types.go            # LineReleaseResult, ResolveOptions, defaults
    │   ├── glob.go             # fnmatch-style glob matcher
    │   ├── pickfirst.go        # filter + sort + pick logic
    │   ├── resolve.go          # blame -> tags -> pick orchestration
    │   └── git/                # git wrappers (one subprocess each)
    │       ├── exec.go
    │       ├── repo.go
    │       ├── blame.go
    │       └── tags.go
    └── output/
        ├── human.go            # terminal-friendly multi-line text
        └── json.go             # stable JSON schema
```

## Maintenance contract with `@shiplens/core`

The Go port mirrors the TypeScript core's shape so algorithmic changes propagate mechanically.

| TS file | Go equivalent |
|---|---|
| `core/src/types.ts` | `internal/core/types.go` + `internal/core/git/*.go` |
| `core/src/git/exec.ts` | `internal/core/git/exec.go` |
| `core/src/git/blame.ts` | `internal/core/git/blame.go` |
| `core/src/git/tags.ts` | `internal/core/git/tags.go` |
| `core/src/git/repo.ts` | `internal/core/git/repo.go` |
| `core/src/semantics/glob.ts` | `internal/core/glob.go` |
| `core/src/semantics/pickFirstRelease.ts` | `internal/core/pickfirst.go` |
| `core/src/resolve.ts` | `internal/core/resolve.go` |

When the algorithm changes in `@shiplens/core`, mirror the change in the corresponding Go file. The pure-logic surface (`glob.go` + `pickfirst.go`, ~110 lines combined) is the only place where syntax differences matter; the git-wrapper layer is mechanical.

## Build & release

```bash
# Build with version stamped in
go build -ldflags "-X main.Version=$(git describe --tags --always)" -o bin/shiplens ./cmd/shiplens

# Cross-compile for release (planned)
GOOS=darwin  GOARCH=arm64 go build -o dist/shiplens-darwin-arm64  ./cmd/shiplens
GOOS=darwin  GOARCH=amd64 go build -o dist/shiplens-darwin-amd64  ./cmd/shiplens
GOOS=linux   GOARCH=arm64 go build -o dist/shiplens-linux-arm64   ./cmd/shiplens
GOOS=linux   GOARCH=amd64 go build -o dist/shiplens-linux-amd64   ./cmd/shiplens
GOOS=windows GOARCH=amd64 go build -o dist/shiplens-windows-amd64.exe ./cmd/shiplens
```

Homebrew tap and a Goreleaser config land alongside the first tagged CLI release.

## License

MIT — see [`../../LICENSE`](../../LICENSE).
