# ShipLens

> See the first release version of every line of code, inline in your editor.

`git blame` tells you *who* last touched a line. **ShipLens** tells you **which release first shipped that line to users**.

The status bar quietly answers the question:

> "I'm looking at this line — when did it actually go out the door?"

## Features (v0.1)

- A single status-bar item that updates as you move the cursor: `🚢 v1.2.0`.
- Tooltip with commit SHA, message, author, and the tag's date.
- Configurable tag include/exclude globs (defaults skip `*-rc*`, `*-beta*`, etc.).
- Multi-root workspace aware; each file is resolved against its own repo.
- Graceful degradation:
  - **Uncommitted** — the line has working-tree changes.
  - **Unreleased** — the commit exists but no release tag contains it.
  - **Limited history** — the repo is a shallow clone; we won't guess.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `shiplens.tagInclude` | `*` | Glob passed to `git tag --contains`. |
| `shiplens.tagExclude` | `["*-rc*", "*-beta*", "*-alpha*", "*-pre*", "*-dev*", "*-snapshot*"]` | Patterns dropped after the include filter. |
| `shiplens.sortBy` | `committerDate` | How candidate tags are ordered. v0.1 only implements `committerDate`. |
| `shiplens.debounceMs` | `150` | Delay between cursor movement and the next query. |
| `shiplens.followRenames` | `false` | Pass `--follow` to `git blame`. |
| `shiplens.statusBar.alignment` | `right` | Status bar position. |

## Roadmap

Near-term (v0.2): click status-bar to open the tag page on GitHub/GitLab,
multi-line selection (earliest/latest tag across the range), monorepo
tag-prefix routing, and a background tag-DAG index for instant lookups on
large repos.

Longer-term: Issue/PR linking via commit message references, a file-level
release timeline view, CI/CD signal hookup, JetBrains plugin reusing the
same core, and optional GitLens data-source integration.

Track progress at <https://github.com/Ender-Wang/ShipLens>.

## License

MIT.
