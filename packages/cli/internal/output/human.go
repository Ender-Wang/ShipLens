// Package output renders LineReleaseResult to terminal-friendly text or JSON.
package output

import (
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/Ender-Wang/ShipLens/packages/cli/internal/core"
)

const ship = "🚢"

// Human writes a multi-line, plain-text rendering of `result` to `w`. Designed
// to be skim-readable in a terminal — first line is the headline (mirrors the
// VSCode status bar), subsequent lines fill in the tooltip details.
func Human(w io.Writer, result core.LineReleaseResult) error {
	switch result.Kind {
	case core.KindReleased:
		fmt.Fprintf(w, "%s %s\n", ship, result.Tag)
		fmt.Fprintf(w, "  commit:   %s%s\n", shortSha(result.Sha), summarySuffix(result.Summary))
		if result.Author != "" {
			fmt.Fprintf(w, "  author:   %s\n", result.Author)
		}
		if result.AuthorTime != "" {
			fmt.Fprintf(w, "  authored: %s\n", formatDate(result.AuthorTime))
		}
		fmt.Fprintf(w, "  tag:      %s (commit %s, %s)\n",
			result.Tag, shortSha(result.TagCommitSha), formatDate(result.TagDate))
		if result.OtherTagCount > 0 {
			fmt.Fprintf(w, "  also in:  %d other tag%s\n",
				result.OtherTagCount, plural(result.OtherTagCount))
		}

	case core.KindUnreleased:
		fmt.Fprintf(w, "%s Unreleased\n", ship)
		if result.Sha != "" {
			fmt.Fprintf(w, "  commit:   %s%s\n", shortSha(result.Sha), summarySuffix(result.Summary))
		}
		if result.Author != "" {
			fmt.Fprintf(w, "  author:   %s\n", result.Author)
		}
		if result.AuthorTime != "" {
			fmt.Fprintf(w, "  authored: %s\n", formatDate(result.AuthorTime))
		}
		fmt.Fprintln(w, "  note:     not yet part of any matching release tag")

	case core.KindUncommitted:
		fmt.Fprintf(w, "%s Uncommitted\n", ship)
		fmt.Fprintln(w, "  note:     this line has uncommitted changes in the working tree")

	case core.KindLimitedHistory:
		fmt.Fprintf(w, "%s Limited history\n", ship)
		if result.Sha != "" {
			fmt.Fprintf(w, "  commit:   %s\n", shortSha(result.Sha))
		}
		fmt.Fprintln(w, "  note:     repository is a shallow clone")
		fmt.Fprintln(w, "  hint:     run `git fetch --unshallow` to enable lookups")

	case core.KindNotTracked:
		fmt.Fprintf(w, "%s —\n", ship)
		fmt.Fprintln(w, "  note:     file is not tracked by git, or git query failed")
		if result.Reason != "" {
			fmt.Fprintf(w, "  reason:   %s\n", result.Reason)
		}

	default:
		return fmt.Errorf("output: unknown result kind %q", result.Kind)
	}
	return nil
}

func shortSha(sha string) string {
	if len(sha) > 8 {
		return sha[:8]
	}
	return sha
}

func summarySuffix(summary string) string {
	if summary == "" {
		return ""
	}
	return " — " + summary
}

func formatDate(iso string) string {
	if iso == "" {
		return ""
	}
	if t, err := time.Parse(time.RFC3339, iso); err == nil {
		return t.Local().Format("2006-01-02 15:04:05 MST")
	}
	// Some servers use iso-strict with offset like "2025-01-02T03:04:05+00:00",
	// which time.RFC3339 already handles. Anything else: print the raw value.
	return strings.TrimSpace(iso)
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
