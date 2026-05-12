package core

import (
	"regexp"
	"strings"
	"sync"
)

// MatchGlob returns true when `name` matches the fnmatch-style `pattern`.
//
// Supported metacharacters: `*` (any run), `?` (single char), `[...]` (class).
// Mirrors packages/core/src/semantics/glob.ts and the Kotlin Glob.kt.
func MatchGlob(name, pattern string) bool {
	return globToRegex(pattern).MatchString(name)
}

// MatchAnyGlob returns true when `name` matches any pattern in `patterns`.
func MatchAnyGlob(name string, patterns []string) bool {
	for _, p := range patterns {
		if MatchGlob(name, p) {
			return true
		}
	}
	return false
}

var globCache sync.Map // map[string]*regexp.Regexp

func globToRegex(pattern string) *regexp.Regexp {
	if cached, ok := globCache.Load(pattern); ok {
		return cached.(*regexp.Regexp)
	}

	var sb strings.Builder
	sb.WriteByte('^')
	i := 0
	for i < len(pattern) {
		ch := pattern[i]
		switch ch {
		case '*':
			sb.WriteString(".*")
		case '?':
			sb.WriteByte('.')
		case '[':
			closeIdx := strings.IndexByte(pattern[i+1:], ']')
			if closeIdx == -1 {
				sb.WriteString(`\[`)
			} else {
				sb.WriteByte('[')
				inner := pattern[i+1 : i+1+closeIdx]
				sb.WriteString(strings.ReplaceAll(inner, `\`, `\\`))
				sb.WriteByte(']')
				i += closeIdx + 1
			}
		case '\\', '^', '$', '.', '+', '|', '(', ')', '{', '}':
			sb.WriteByte('\\')
			sb.WriteByte(ch)
		default:
			sb.WriteByte(ch)
		}
		i++
	}
	sb.WriteByte('$')

	compiled := regexp.MustCompile(sb.String())
	globCache.Store(pattern, compiled)
	return compiled
}
