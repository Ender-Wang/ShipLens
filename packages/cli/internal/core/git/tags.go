package git

import "strings"

// TagInfo is the metadata ShipLens needs about a single tag. Annotated tags
// resolve to the pointed-to commit; lightweight tags ARE the commit.
type TagInfo struct {
	Name          string
	CommitSha     string
	CommitterDate string // iso-strict
}

// TagsContaining returns the names of tags whose tip (or pointed-to commit)
// contains `sha`. One subprocess. `pattern` is the optional fnmatch glob that
// `git tag` applies before listing.
func TagsContaining(repoRoot, sha, pattern string) ([]string, error) {
	args := []string{"tag", "--contains", sha}
	if pattern != "" && pattern != "*" {
		args = append(args, pattern)
	}
	out, err := Run(args, RunOptions{Cwd: repoRoot})
	if err != nil {
		return nil, err
	}
	var tags []string
	for _, line := range strings.Split(out, "\n") {
		if t := strings.TrimSpace(line); t != "" {
			tags = append(tags, t)
		}
	}
	return tags, nil
}

// fieldSep is ASCII unit separator (0x1F) — won't appear in any field we read.
const fieldSep = "\x1f"

var tagFormat = strings.Join([]string{
	"%(refname:short)",
	"%(*objectname)",
	"%(objectname)",
	"%(*committerdate:iso-strict)",
	"%(committerdate:iso-strict)",
}, fieldSep)

// LoadAllTagInfo snapshots metadata for every tag in the repo (optionally
// filtered by a glob). One subprocess regardless of tag count, so safe to
// call eagerly per resolve.
func LoadAllTagInfo(repoRoot, pattern string) ([]TagInfo, error) {
	refspec := "refs/tags/"
	if pattern != "" && pattern != "*" {
		refspec = "refs/tags/" + pattern
	}
	out, err := Run(
		[]string{"for-each-ref", "--format=" + tagFormat, refspec},
		RunOptions{Cwd: repoRoot},
	)
	if err != nil {
		return nil, err
	}

	var tags []TagInfo
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		parts := strings.Split(line, fieldSep)
		if len(parts) < 5 {
			continue
		}
		name := parts[0]
		commitSha := strings.TrimSpace(parts[1])
		if commitSha == "" {
			commitSha = strings.TrimSpace(parts[2])
		}
		committerDate := strings.TrimSpace(parts[3])
		if committerDate == "" {
			committerDate = strings.TrimSpace(parts[4])
		}
		if name == "" || commitSha == "" {
			continue
		}
		tags = append(tags, TagInfo{
			Name:          name,
			CommitSha:     commitSha,
			CommitterDate: committerDate,
		})
	}
	return tags, nil
}

// IndexByName converts []TagInfo to a name->info map for quick lookup.
func IndexByName(tags []TagInfo) map[string]TagInfo {
	m := make(map[string]TagInfo, len(tags))
	for _, t := range tags {
		m[t.Name] = t
	}
	return m
}
