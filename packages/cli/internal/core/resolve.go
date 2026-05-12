package core

import (
	"errors"
	"path/filepath"

	"github.com/Ender-Wang/ShipLens/packages/cli/internal/core/git"
)

// ResolveLineRelease composes blame -> containing-tags -> first-release picking
// for a single line. Errors are mapped to LineReleaseResult variants instead
// of propagated, so callers (CLI formatters) never have to translate
// exceptions.
//
// Mirrors packages/core/src/resolve.ts and the Kotlin Resolve.kt.
func ResolveLineRelease(req ResolveLineRequest) (LineReleaseResult, error) {
	opts := req.Options.applyDefaults()

	// macOS may hand us a symlinked path (e.g. /var -> /private/var). git
	// rev-parse --show-toplevel returns the realpathed root, so without
	// canonicalising the file path the relative-to-root computation lands
	// "outside repository".
	filePath := safeRealpath(req.FilePath)
	repoRoot := req.RepoRoot

	blame, err := git.BlameLine(git.BlameLineOptions{
		RepoRoot:      repoRoot,
		FilePath:      filePath,
		Line:          req.Line,
		FollowRenames: opts.FollowRenames,
	})
	if err != nil {
		var execErr *git.ExecError
		if errors.As(err, &execErr) {
			return LineReleaseResult{
				Kind:   KindNotTracked,
				Reason: shortReason(execErr),
			}, nil
		}
		return LineReleaseResult{}, err
	}

	if blame == nil {
		return LineReleaseResult{Kind: KindUncommitted}, nil
	}

	meta := git.LoadRepoMeta(repoRoot)

	allTags, err := git.LoadAllTagInfo(repoRoot, opts.TagInclude)
	if err != nil {
		// If we can't even list tags, treat as not-tracked rather than crash.
		var execErr *git.ExecError
		if errors.As(err, &execErr) {
			return LineReleaseResult{
				Kind:   KindNotTracked,
				Reason: shortReason(execErr),
			}, nil
		}
		return LineReleaseResult{}, err
	}
	tagIndex := git.IndexByName(allTags)

	containing, err := git.TagsContaining(repoRoot, blame.Sha, opts.TagInclude)
	if err != nil {
		var execErr *git.ExecError
		if errors.As(err, &execErr) {
			if meta.IsShallow {
				return LineReleaseResult{Kind: KindLimitedHistory, Sha: blame.Sha}, nil
			}
			return LineReleaseResult{
				Kind:   KindNotTracked,
				Sha:    blame.Sha,
				Reason: shortReason(execErr),
			}, nil
		}
		return LineReleaseResult{}, err
	}

	if len(containing) == 0 {
		if meta.IsShallow {
			return LineReleaseResult{Kind: KindLimitedHistory, Sha: blame.Sha}, nil
		}
		return unreleasedFromBlame(blame), nil
	}

	pick := PickFirstRelease(containing, tagIndex, opts.TagExclude, opts.SortBy)
	if pick.Picked == nil {
		// Every candidate was filtered out (e.g., only pre-release tags contained it).
		return unreleasedFromBlame(blame), nil
	}

	other := len(pick.Candidates) - 1
	if other < 0 {
		other = 0
	}
	return LineReleaseResult{
		Kind:          KindReleased,
		Sha:           blame.Sha,
		Summary:       blame.Summary,
		Author:        blame.Author,
		AuthorTime:    blame.AuthorTime,
		Tag:           pick.Picked.Name,
		TagCommitSha:  pick.Picked.CommitSha,
		TagDate:       pick.Picked.CommitterDate,
		OtherTagCount: other,
	}, nil
}

// ResolveCommitRelease answers the same question as ResolveLineRelease but
// for an arbitrary commit SHA — useful for CI scripts and agents that already
// know which commit they care about. Skips blame.
func ResolveCommitRelease(req ResolveCommitRequest) (LineReleaseResult, error) {
	opts := req.Options.applyDefaults()
	repoRoot := req.RepoRoot

	if req.Sha == "" {
		return LineReleaseResult{}, errors.New("ResolveCommitRelease: empty sha")
	}

	meta := git.LoadRepoMeta(repoRoot)

	allTags, err := git.LoadAllTagInfo(repoRoot, opts.TagInclude)
	if err != nil {
		var execErr *git.ExecError
		if errors.As(err, &execErr) {
			return LineReleaseResult{
				Kind:   KindNotTracked,
				Sha:    req.Sha,
				Reason: shortReason(execErr),
			}, nil
		}
		return LineReleaseResult{}, err
	}
	tagIndex := git.IndexByName(allTags)

	containing, err := git.TagsContaining(repoRoot, req.Sha, opts.TagInclude)
	if err != nil {
		var execErr *git.ExecError
		if errors.As(err, &execErr) {
			if meta.IsShallow {
				return LineReleaseResult{Kind: KindLimitedHistory, Sha: req.Sha}, nil
			}
			return LineReleaseResult{
				Kind:   KindNotTracked,
				Sha:    req.Sha,
				Reason: shortReason(execErr),
			}, nil
		}
		return LineReleaseResult{}, err
	}

	if len(containing) == 0 {
		if meta.IsShallow {
			return LineReleaseResult{Kind: KindLimitedHistory, Sha: req.Sha}, nil
		}
		return LineReleaseResult{Kind: KindUnreleased, Sha: req.Sha}, nil
	}

	pick := PickFirstRelease(containing, tagIndex, opts.TagExclude, opts.SortBy)
	if pick.Picked == nil {
		return LineReleaseResult{Kind: KindUnreleased, Sha: req.Sha}, nil
	}

	other := len(pick.Candidates) - 1
	if other < 0 {
		other = 0
	}
	return LineReleaseResult{
		Kind:          KindReleased,
		Sha:           req.Sha,
		Tag:           pick.Picked.Name,
		TagCommitSha:  pick.Picked.CommitSha,
		TagDate:       pick.Picked.CommitterDate,
		OtherTagCount: other,
	}, nil
}

func unreleasedFromBlame(b *git.BlameInfo) LineReleaseResult {
	return LineReleaseResult{
		Kind:       KindUnreleased,
		Sha:        b.Sha,
		Summary:    b.Summary,
		Author:     b.Author,
		AuthorTime: b.AuthorTime,
	}
}

func shortReason(err *git.ExecError) string {
	text := err.Stderr
	if text == "" {
		text = err.Error()
	}
	const max = 200
	if len(text) > max {
		return text[:max] + "…"
	}
	return text
}

// safeRealpath resolves symlinks but falls back to the raw path on any error.
// `filepath.EvalSymlinks` is the closest stdlib analogue to fs.realpath.
func safeRealpath(p string) string {
	if resolved, err := filepath.EvalSymlinks(p); err == nil {
		return resolved
	}
	return p
}
