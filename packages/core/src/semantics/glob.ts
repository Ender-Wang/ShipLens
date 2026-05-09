/**
 * Tiny fnmatch-style glob matcher, sufficient for tag-name patterns
 * (`*-rc*`, `v[0-9]*`, etc). We avoid pulling in `minimatch` because the
 * surface we need is very small and `core` aims to stay dependency-free.
 *
 * Supported metacharacters: `*` (any run), `?` (single char), `[...]` (class).
 */
export function matchesGlob(name: string, pattern: string): boolean {
  return globToRegex(pattern).test(name);
}

const cache = new Map<string, RegExp>();

function globToRegex(pattern: string): RegExp {
  const cached = cache.get(pattern);
  if (cached) return cached;

  let re = '^';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '*') {
      re += '.*';
    } else if (ch === '?') {
      re += '.';
    } else if (ch === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close === -1) {
        re += '\\[';
      } else {
        re += '[' + pattern.slice(i + 1, close).replace(/\\/g, '\\\\') + ']';
        i = close;
      }
    } else if (/[\\^$.+|(){}]/.test(ch)) {
      re += '\\' + ch;
    } else {
      re += ch;
    }
  }
  re += '$';
  const compiled = new RegExp(re);
  cache.set(pattern, compiled);
  return compiled;
}
