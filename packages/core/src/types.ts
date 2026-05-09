export type SortKey = 'committerDate' | 'tagDate' | 'topological' | 'semver';

export interface RepoMeta {
  root: string;
  isShallow: boolean;
}

export interface ResolveOptions {
  /** Glob pattern passed to `git tag --contains <sha> <pattern>`. Defaults to `*`. */
  tagInclude?: string;
  /** Glob patterns dropped after the include filter. Matched with simple `*` globs. */
  tagExclude?: string[];
  /** How to order candidate tags before picking the first. Only `committerDate` is implemented in v0.1. */
  sortBy?: SortKey;
  /** Pass `--follow` to `git blame`. Off by default — it costs latency. */
  followRenames?: boolean;
}

export interface ResolveRequest extends ResolveOptions {
  repoRoot: string;
  /** Absolute path. The repo root is included separately for safety/perf. */
  filePath: string;
  /** 1-based line number. */
  line: number;
}

/**
 * High-level result for a single line. The status bar maps each variant to a
 * fixed display string; tooltips read the rich fields.
 */
export type LineReleaseResult =
  | {
      kind: 'released';
      sha: string;
      summary?: string;
      author?: string;
      authorTime?: string;
      tag: string;
      tagCommitSha: string;
      tagDate: string;
      /** Number of other tags that also contain the commit. */
      otherTagCount: number;
    }
  | {
      kind: 'unreleased';
      sha: string;
      summary?: string;
      author?: string;
      authorTime?: string;
    }
  | { kind: 'uncommitted' }
  | { kind: 'limited-history'; sha: string }
  | { kind: 'not-tracked'; reason: string };

export interface TagInfo {
  /** Short ref name, e.g. `v1.2.0`. */
  name: string;
  /** Commit SHA the tag ultimately points to (peeled for annotated tags). */
  commitSha: string;
  /** Committer date of the pointed-to commit, ISO-8601. */
  committerDate: string;
}

export interface BlameLineInfo {
  sha: string;
  summary?: string;
  author?: string;
  authorTime?: string;
}
