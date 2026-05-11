# Changelog

## 0.1.2 — initial JetBrains release

First release on the JetBrains Marketplace. Brings feature parity with the [VSCode/Cursor edition](https://marketplace.visualstudio.com/items?itemName=Ender-Wang.shiplens) at the same version line. The JetBrains edition starts at `0.1.2` to keep cross-platform version numbering in sync going forward — both editions advance together.

### What ships

- Status-bar widget showing the first release tag containing the line under the cursor.
- Tooltip with commit SHA, summary, author, and tag date.
- Tag include/exclude glob configuration. Defaults exclude common pre-release patterns (`*-rc*`, `*-beta*`, `*-alpha*`, `*-pre*`, `*-dev*`, `*-snapshot*`) plus `rescue/*` for internal hotfix namespaces.
- Graceful degradation for `Uncommitted`, `Unreleased`, and `Limited history` states.
- Settings UI under **Settings → Tools → ShipLens**.
- Plugin icon mirroring the VSCode edition's ship-with-magnifying-glass design.

### Mapping to VSCode versions

The JetBrains 0.1.2 release folds in everything from VSCode 0.1.0, 0.1.1, and 0.1.2:

- **From VSCode 0.1.0**: status bar, tooltip, glob filters, degradation states, multi-root awareness.
- **From VSCode 0.1.1**: extension icon. Per-line result cache and the loading-state flicker fix don't apply directly — the JetBrains widget never had a transient loading state, so there was no flicker to fix; the per-line cache is a future optimization on top of the existing per-repo tag-metadata cache.
- **From VSCode 0.1.2**: `rescue/*` in default `tagExclude`.

Future releases will be lockstep — when the VSCode edition bumps to `0.1.3` for a fix, this edition does too on the same day.
