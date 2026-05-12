package git

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// FindRepoRoot returns the absolute path to the git work-tree containing
// `filePath`, or "" if `filePath` is not tracked by git. `filePath` may be
// either a file or a directory.
func FindRepoRoot(filePath string) (string, error) {
	dir := filePath
	if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
		dir = filepath.Dir(filePath)
	}
	return FindRepoRootFromDir(dir)
}

// FindRepoRootFromDir is the same as FindRepoRoot but assumes `dir` is a
// directory (saves a stat() when callers already know).
func FindRepoRootFromDir(dir string) (string, error) {
	out, err := Run([]string{"rev-parse", "--show-toplevel"}, RunOptions{Cwd: dir})
	if err != nil {
		var execErr *ExecError
		if errors.As(err, &execErr) {
			// Not inside a git work tree (or `git` missing). Mirror the TS
			// behaviour of "treat as untracked" by returning ("", nil).
			return "", nil
		}
		return "", err
	}
	root := strings.TrimSpace(out)
	if root == "" {
		return "", nil
	}
	return root, nil
}

// IsShallowRepo reports whether the repo at `repoRoot` was cloned with depth
// limits (in which case `git tag --contains` may return false negatives).
func IsShallowRepo(repoRoot string) bool {
	out, err := Run([]string{"rev-parse", "--is-shallow-repository"}, RunOptions{Cwd: repoRoot})
	if err != nil {
		return false
	}
	return strings.TrimSpace(out) == "true"
}

// RepoMeta is what callers usually want: root + shallow flag.
type RepoMeta struct {
	Root      string
	IsShallow bool
}

// LoadRepoMeta combines FindRepoRoot + IsShallowRepo for callers that already
// have a known root.
func LoadRepoMeta(repoRoot string) RepoMeta {
	return RepoMeta{Root: repoRoot, IsShallow: IsShallowRepo(repoRoot)}
}
