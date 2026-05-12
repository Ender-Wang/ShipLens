// Command shiplens prints the first release tag that contains a given line or
// commit, mirroring the algorithm of the VSCode and JetBrains editions.
//
// Usage:
//
//	shiplens line <file>:<line>   [--json] [--include GLOB] [--exclude GLOB]...
//	shiplens commit <sha>         [--json] [--cwd DIR] [--include GLOB] [--exclude GLOB]...
//	shiplens version
//	shiplens help
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/Ender-Wang/ShipLens/packages/cli/internal/core"
	"github.com/Ender-Wang/ShipLens/packages/cli/internal/core/git"
	"github.com/Ender-Wang/ShipLens/packages/cli/internal/output"
)

// Version is overridable at build time via:
//
//	go build -ldflags "-X main.Version=0.1.2"
//
// Default mirrors the lockstep version of the VSCode/JetBrains editions.
var Version = "0.1.2"

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "shiplens: missing command")
		printUsage(os.Stderr)
		os.Exit(2)
	}

	cmd, args := os.Args[1], os.Args[2:]
	switch cmd {
	case "line":
		os.Exit(runLine(args))
	case "commit":
		os.Exit(runCommit(args))
	case "version", "--version", "-V":
		fmt.Println(Version)
	case "help", "--help", "-h":
		printUsage(os.Stdout)
	default:
		fmt.Fprintf(os.Stderr, "shiplens: unknown command %q\n", cmd)
		printUsage(os.Stderr)
		os.Exit(2)
	}
}

func runLine(args []string) int {
	fs := flag.NewFlagSet("line", flag.ContinueOnError)
	var (
		jsonOut       = fs.Bool("json", false, "emit JSON instead of human-readable text")
		include       = fs.String("include", "", "tag include glob (default \"*\")")
		excludes      stringSlice
		followRenames = fs.Bool("follow", false, "pass --follow to git blame (slower, follows file renames)")
	)
	fs.Var(&excludes, "exclude",
		"tag exclude glob; repeatable. Specifying any --exclude replaces the built-in defaults.")
	fs.Usage = func() { lineUsage(fs) }
	if err := fs.Parse(reorderForFlagSet(fs, args)); err != nil {
		return 2
	}

	pos := fs.Args()
	if len(pos) != 1 {
		fmt.Fprintln(os.Stderr, "shiplens line: expected exactly one positional <file>:<line>")
		lineUsage(fs)
		return 2
	}

	file, line, err := parseFileLine(pos[0])
	if err != nil {
		fmt.Fprintln(os.Stderr, "shiplens line:", err)
		return 2
	}
	abs, err := absPath(file)
	if err != nil {
		fmt.Fprintln(os.Stderr, "shiplens line:", err)
		return 2
	}

	repoRoot, err := git.FindRepoRoot(abs)
	if err != nil {
		fmt.Fprintln(os.Stderr, "shiplens line:", err)
		return 1
	}
	if repoRoot == "" {
		return emit(*jsonOut, core.LineReleaseResult{
			Kind:   core.KindNotTracked,
			Reason: "file is not inside a git work tree",
		})
	}

	result, err := core.ResolveLineRelease(core.ResolveLineRequest{
		RepoRoot: repoRoot,
		FilePath: abs,
		Line:     line,
		Options:  resolveOptionsFromFlags(*include, excludes, *followRenames),
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "shiplens line:", err)
		return 1
	}
	return emit(*jsonOut, result)
}

func runCommit(args []string) int {
	fs := flag.NewFlagSet("commit", flag.ContinueOnError)
	var (
		jsonOut  = fs.Bool("json", false, "emit JSON instead of human-readable text")
		cwd      = fs.String("cwd", ".", "directory inside the target repository")
		include  = fs.String("include", "", "tag include glob (default \"*\")")
		excludes stringSlice
	)
	fs.Var(&excludes, "exclude",
		"tag exclude glob; repeatable. Specifying any --exclude replaces the built-in defaults.")
	fs.Usage = func() { commitUsage(fs) }
	if err := fs.Parse(reorderForFlagSet(fs, args)); err != nil {
		return 2
	}

	pos := fs.Args()
	if len(pos) != 1 {
		fmt.Fprintln(os.Stderr, "shiplens commit: expected exactly one positional <sha>")
		commitUsage(fs)
		return 2
	}
	sha := strings.TrimSpace(pos[0])
	if sha == "" {
		fmt.Fprintln(os.Stderr, "shiplens commit: empty sha")
		return 2
	}

	absCwd, err := absPath(*cwd)
	if err != nil {
		fmt.Fprintln(os.Stderr, "shiplens commit:", err)
		return 2
	}
	repoRoot, err := git.FindRepoRootFromDir(absCwd)
	if err != nil {
		fmt.Fprintln(os.Stderr, "shiplens commit:", err)
		return 1
	}
	if repoRoot == "" {
		return emit(*jsonOut, core.LineReleaseResult{
			Kind:   core.KindNotTracked,
			Sha:    sha,
			Reason: "cwd is not inside a git work tree",
		})
	}

	result, err := core.ResolveCommitRelease(core.ResolveCommitRequest{
		RepoRoot: repoRoot,
		Sha:      sha,
		Options:  resolveOptionsFromFlags(*include, excludes, false),
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "shiplens commit:", err)
		return 1
	}
	return emit(*jsonOut, result)
}

func resolveOptionsFromFlags(include string, excludes stringSlice, followRenames bool) core.ResolveOptions {
	opts := core.ResolveOptions{
		FollowRenames: followRenames,
	}
	if include != "" {
		opts.TagInclude = include
	}
	if len(excludes) > 0 {
		// Specifying any --exclude replaces defaults entirely. Documented above.
		opts.TagExclude = []string(excludes)
	} // else: applyDefaults() will fill in DefaultTagExclude.
	return opts
}

func emit(jsonOut bool, r core.LineReleaseResult) int {
	var err error
	if jsonOut {
		err = output.JSON(os.Stdout, r)
	} else {
		err = output.Human(os.Stdout, r)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "shiplens:", err)
		return 1
	}
	// Exit code semantics: 0 = success (any kind), 1 = unexpected error,
	// 2 = bad usage. We deliberately do NOT use kind to encode exit codes —
	// "unreleased" is a valid finding, not a failure.
	return 0
}

// parseFileLine accepts "path:line" and returns the path + 1-based line.
// On Windows, "C:\\foo:42" needs special handling; we split on the LAST
// colon to keep drive letters intact.
func parseFileLine(spec string) (string, int, error) {
	idx := strings.LastIndex(spec, ":")
	if idx <= 0 || idx == len(spec)-1 {
		return "", 0, fmt.Errorf("expected <file>:<line>, got %q", spec)
	}
	file, lineStr := spec[:idx], spec[idx+1:]
	line, err := strconv.Atoi(lineStr)
	if err != nil {
		return "", 0, fmt.Errorf("invalid line number %q", lineStr)
	}
	if line < 1 {
		return "", 0, fmt.Errorf("line must be >= 1, got %d", line)
	}
	return file, line, nil
}

func absPath(p string) (string, error) {
	if filepath.IsAbs(p) {
		return p, nil
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		return "", err
	}
	return abs, nil
}

// stringSlice is a flag.Value implementation that collects repeated string
// flags into a slice, e.g. --exclude foo --exclude bar => ["foo", "bar"].
type stringSlice []string

func (s *stringSlice) String() string { return strings.Join(*s, ",") }
func (s *stringSlice) Set(v string) error {
	*s = append(*s, v)
	return nil
}

// reorderForFlagSet moves every flag (and its value, if any) ahead of the
// positional args. Lets users write `shiplens line file:42 --json` as well as
// `shiplens line --json file:42`, matching the convention of git/docker/gh.
//
// We need the FlagSet to know which flags are bool (no value) vs which take
// a value. Unknown flags are passed through verbatim so flag.Parse can
// produce its usual error.
func reorderForFlagSet(fs *flag.FlagSet, args []string) []string {
	var flags, positionals []string
	i := 0
	for i < len(args) {
		arg := args[i]
		switch {
		case arg == "--":
			// Everything after `--` is positional, by convention.
			positionals = append(positionals, args[i+1:]...)
			i = len(args)
			continue
		case !strings.HasPrefix(arg, "-") || arg == "-":
			positionals = append(positionals, arg)
		case strings.Contains(arg, "="):
			// -foo=val / --foo=val — value already attached.
			flags = append(flags, arg)
		default:
			name := strings.TrimLeft(arg, "-")
			f := fs.Lookup(name)
			flags = append(flags, arg)
			if f != nil && !isBoolFlag(f) && i+1 < len(args) {
				i++
				flags = append(flags, args[i])
			}
		}
		i++
	}
	return append(flags, positionals...)
}

func isBoolFlag(f *flag.Flag) bool {
	bf, ok := f.Value.(interface{ IsBoolFlag() bool })
	return ok && bf.IsBoolFlag()
}

func printUsage(w *os.File) {
	fmt.Fprintf(w, `shiplens %s — show the first release tag containing a line or commit.

Usage:
  shiplens line <file>:<line>   [--json] [--include GLOB] [--exclude GLOB]... [--follow]
  shiplens commit <sha>         [--json] [--cwd DIR] [--include GLOB] [--exclude GLOB]...
  shiplens version
  shiplens help

Examples:
  shiplens line src/auth.ts:42
  shiplens line src/auth.ts:42 --json
  shiplens commit a1b2c3d --cwd ~/code/myrepo
  shiplens line src/auth.ts:42 --exclude '*-rc*' --exclude 'rescue/*'

Default tag-exclude globs (used when --exclude is not given):
  *-rc*  *-beta*  *-alpha*  *-pre*  *-dev*  *-snapshot*  rescue/*

Exit codes:
  0  success (any LineReleaseResult kind)
  1  unexpected error (git failure, IO error)
  2  bad usage (missing args, parse error)

Docs and source: https://github.com/Ender-Wang/ShipLens
`, Version)
}

func lineUsage(fs *flag.FlagSet) {
	fmt.Fprintln(fs.Output(), "Usage: shiplens line <file>:<line> [flags]")
	fmt.Fprintln(fs.Output())
	fmt.Fprintln(fs.Output(), "Flags:")
	fs.PrintDefaults()
}

func commitUsage(fs *flag.FlagSet) {
	fmt.Fprintln(fs.Output(), "Usage: shiplens commit <sha> [flags]")
	fmt.Fprintln(fs.Output())
	fmt.Fprintln(fs.Output(), "Flags:")
	fs.PrintDefaults()
}
