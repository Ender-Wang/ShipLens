export { resolveLineRelease } from './resolve.js';
export { findRepoRoot, isShallowRepo, loadRepoMeta } from './git/repo.js';
export { invalidateRepo } from './cache.js';
export { GitExecError } from './git/exec.js';
export type {
  BlameLineInfo,
  LineReleaseResult,
  RepoMeta,
  ResolveOptions,
  ResolveRequest,
  SortKey,
  TagInfo,
} from './types.js';
