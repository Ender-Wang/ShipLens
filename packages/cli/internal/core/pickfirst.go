package core

import (
	"sort"

	"github.com/Ender-Wang/ShipLens/packages/cli/internal/core/git"
)

// PickFirstReleaseResult is the output of PickFirstRelease.
type PickFirstReleaseResult struct {
	// Picked is the chosen first release, or nil if no candidates remain.
	Picked *git.TagInfo
	// Candidates is every tag that survived filtering, sorted ascending by
	// committerDate. Useful for diagnostics ("released in vX, also in...").
	Candidates []git.TagInfo
}

// PickFirstRelease applies ShipLens' "first release" rules to the set of
// containing tags. Pure logic, no git access.
//
// Mirrors packages/core/src/semantics/pickFirstRelease.ts and the Kotlin port.
func PickFirstRelease(
	containingTagNames []string,
	tagIndex map[string]git.TagInfo,
	exclude []string,
	sortBy string,
) PickFirstReleaseResult {
	candidates := make([]git.TagInfo, 0, len(containingTagNames))
	for _, name := range containingTagNames {
		meta, ok := tagIndex[name]
		if !ok {
			continue
		}
		if MatchAnyGlob(name, exclude) {
			continue
		}
		candidates = append(candidates, meta)
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		return compareTags(candidates[i], candidates[j], sortBy) < 0
	})

	var picked *git.TagInfo
	if len(candidates) > 0 {
		picked = &candidates[0]
	}
	return PickFirstReleaseResult{Picked: picked, Candidates: candidates}
}

// compareTags returns <0 if a should come before b. v0.1 only implements
// committerDate; tagDate/topological/semver fall through to the same
// comparison (scheduled for v0.2).
func compareTags(a, b git.TagInfo, _ string) int {
	switch {
	case a.CommitterDate < b.CommitterDate:
		return -1
	case a.CommitterDate > b.CommitterDate:
		return 1
	default:
		return 0
	}
}
