// Package git wraps `git` subprocess calls used by core. Mirrors
// packages/core/src/git in the TypeScript implementation.
package git

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// DefaultTimeout matches @shiplens/core (10s).
const DefaultTimeout = 10 * time.Second

// ExecError is returned by Run when git exits non-zero or fails to start.
type ExecError struct {
	Args     []string
	Cwd      string
	ExitCode int // -1 when the process never started or signal-terminated
	Stderr   string
	Stdout   string
}

func (e *ExecError) Error() string {
	msg := strings.TrimSpace(e.Stderr)
	if msg == "" {
		msg = strings.TrimSpace(e.Stdout)
	}
	if msg == "" {
		msg = "<no output>"
	}
	return fmt.Sprintf("git %s (cwd=%s) exited with %d: %s",
		strings.Join(e.Args, " "), e.Cwd, e.ExitCode, msg)
}

// RunOptions configures a single Run call.
type RunOptions struct {
	Cwd     string
	Timeout time.Duration // 0 means DefaultTimeout
}

// Run executes `git <args>` and returns stdout. Stable wrapper used by every
// other function in this package — never call exec.Command directly.
func Run(args []string, opts RunOptions) (string, error) {
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = opts.Cwd

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		exitCode := -1
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			exitCode = exitErr.ExitCode()
		}
		return "", &ExecError{
			Args:     append([]string(nil), args...),
			Cwd:      opts.Cwd,
			ExitCode: exitCode,
			Stderr:   stderr.String(),
			Stdout:   stdout.String(),
		}
	}
	return stdout.String(), nil
}
