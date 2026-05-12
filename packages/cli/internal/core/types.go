// Package core mirrors @shiplens/core (TypeScript) and the Kotlin port in the
// JetBrains plugin. It owns the editor-agnostic pipeline: blame -> tag scan ->
// pick first release.
//
// Maintenance contract: when @shiplens/core changes, this package and the
// JetBrains port must move in lockstep. See ShipLens-Plan.md.
package core

// ResultKind enumerates every variant of LineReleaseResult. Mirrors the
// discriminated-union `kind` field in the TS/Kotlin implementations.
type ResultKind string

const (
	KindReleased       ResultKind = "released"
	KindUnreleased     ResultKind = "unreleased"
	KindUncommitted    ResultKind = "uncommitted"
	KindLimitedHistory ResultKind = "limited-history"
	KindNotTracked     ResultKind = "not-tracked"
)

// LineReleaseResult is a flat representation of every result variant. Fields
// are populated based on Kind:
//
//   - released:        Sha, Summary, Author, AuthorTime, Tag, TagCommitSha,
//     TagDate, OtherTagCount
//   - unreleased:      Sha, Summary, Author, AuthorTime
//   - uncommitted:     (no extra fields)
//   - limited-history: Reason, optional Sha
//   - not-tracked:     (no extra fields)
//
// We deliberately use a single struct instead of Go interfaces so that:
//
//   - JSON marshalling stays trivial.
//   - Callers can switch on Kind without type assertions.
//   - Adding a new variant doesn't ripple through callers.
type LineReleaseResult struct {
	Kind ResultKind `json:"kind"`

	// Commit fields
	Sha        string `json:"sha,omitempty"`
	Summary    string `json:"summary,omitempty"`
	Author     string `json:"author,omitempty"`
	AuthorTime string `json:"authorTime,omitempty"`

	// Released-only fields
	Tag           string `json:"tag,omitempty"`
	TagCommitSha  string `json:"tagCommitSha,omitempty"`
	TagDate       string `json:"tagDate,omitempty"`
	OtherTagCount int    `json:"otherTagCount,omitempty"`

	// Diagnostic
	Reason string `json:"reason,omitempty"`
}

// ResolveOptions configures how the pipeline filters and sorts tags.
type ResolveOptions struct {
	// TagInclude is a glob applied at fetch time. Default "*".
	TagInclude string

	// TagExclude is the list of globs filtered out *after* fetch. Defaults to
	// DefaultTagExclude when nil. An empty (non-nil) slice disables exclusion.
	TagExclude []string

	// SortBy currently only supports "committerDate" (default). Reserved for
	// v0.2 (e.g. "tagName" semver-aware sort).
	SortBy string

	// FollowRenames toggles `git blame --follow`.
	FollowRenames bool
}

// DefaultTagExclude mirrors the VSCode default for `shiplens.tagExclude`.
// Keep in sync with packages/vscode-extension/package.json and the JetBrains
// settings defaults.
var DefaultTagExclude = []string{
	"*-rc*",
	"*-beta*",
	"*-alpha*",
	"*-pre*",
	"*-dev*",
	"*-snapshot*",
	"rescue/*",
}

// ResolveLineRequest is the input to ResolveLineRelease.
type ResolveLineRequest struct {
	RepoRoot string
	FilePath string
	Line     int // 1-indexed
	Options  ResolveOptions
}

// ResolveCommitRequest is the input to ResolveCommitRelease.
type ResolveCommitRequest struct {
	RepoRoot string
	Sha      string
	Options  ResolveOptions
}

// applyDefaults returns a copy of ResolveOptions with empty fields filled in.
func (o ResolveOptions) applyDefaults() ResolveOptions {
	out := o
	if out.TagInclude == "" {
		out.TagInclude = "*"
	}
	if out.TagExclude == nil {
		out.TagExclude = DefaultTagExclude
	}
	if out.SortBy == "" {
		out.SortBy = "committerDate"
	}
	return out
}
