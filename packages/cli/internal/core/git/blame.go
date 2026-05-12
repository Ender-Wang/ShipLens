package git

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// BlameInfo is the subset of porcelain blame headers ShipLens cares about.
// Empty strings mean "header was missing from the porcelain output".
type BlameInfo struct {
	Sha        string
	Summary    string
	Author     string
	AuthorTime string // ISO-8601 (UTC) when present
}

var zeroSha = regexp.MustCompile(`^0+$`)

// BlameLineOptions configures BlameLine.
type BlameLineOptions struct {
	RepoRoot      string
	FilePath      string
	Line          int // 1-indexed
	FollowRenames bool
}

// BlameLine returns the blame info for a single line, or (nil, nil) when the
// line is uncommitted (`git blame` returns the all-zero sentinel SHA).
//
// We intentionally do NOT pass an explicit ref so that working-tree edits
// surface as Uncommitted, matching @shiplens/core.
func BlameLine(opts BlameLineOptions) (*BlameInfo, error) {
	if opts.Line < 1 {
		return nil, fmt.Errorf("BlameLine: line must be a positive integer, got %d", opts.Line)
	}

	rel, err := filepath.Rel(opts.RepoRoot, opts.FilePath)
	if err != nil {
		return nil, fmt.Errorf("BlameLine: filePath outside repo root: %w", err)
	}

	args := []string{
		"blame", "--porcelain",
		"-L", fmt.Sprintf("%d,%d", opts.Line, opts.Line),
	}
	if opts.FollowRenames {
		args = append(args, "--follow")
	}
	// `--` disambiguates the path from a possible ref of the same name.
	args = append(args, "--", rel)

	stdout, err := Run(args, RunOptions{Cwd: opts.RepoRoot})
	if err != nil {
		return nil, err
	}
	return parsePorcelainBlame(stdout), nil
}

// parsePorcelainBlame parses single-line porcelain output. Format:
// https://git-scm.com/docs/git-blame#_the_porcelain_format
func parsePorcelainBlame(stdout string) *BlameInfo {
	lines := strings.Split(stdout, "\n")
	if len(lines) == 0 || lines[0] == "" {
		return nil
	}

	// First line: "<sha> <orig> <final> <num>"
	header := strings.SplitN(lines[0], " ", 2)
	sha := header[0]
	if sha == "" || zeroSha.MatchString(sha) {
		return nil
	}

	info := &BlameInfo{Sha: sha}
	for i := 1; i < len(lines); i++ {
		ln := lines[i]
		if strings.HasPrefix(ln, "\t") {
			break // body line — end of headers
		}
		switch {
		case strings.HasPrefix(ln, "summary "):
			info.Summary = ln[len("summary "):]
		case strings.HasPrefix(ln, "author "):
			info.Author = ln[len("author "):]
		case strings.HasPrefix(ln, "author-time "):
			tsStr := strings.TrimSpace(ln[len("author-time "):])
			if ts, err := strconv.ParseInt(tsStr, 10, 64); err == nil {
				info.AuthorTime = time.Unix(ts, 0).UTC().Format(time.RFC3339)
			}
		}
	}
	return info
}
