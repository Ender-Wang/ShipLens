import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Errors thrown by {@link runGit}. Distinguishes "git executed and returned
 * non-zero" (most common) from "git could not even start" (missing binary).
 */
export class GitExecError extends Error {
  public override readonly name = 'GitExecError';
  constructor(
    public readonly args: readonly string[],
    public readonly cwd: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
    public readonly stdout: string,
  ) {
    super(
      `git ${args.join(' ')} (cwd=${cwd}) exited with ${exitCode}: ${stderr.trim() || stdout.trim() || '<no output>'}`,
    );
  }
}

export interface RunGitOptions {
  cwd: string;
  /** Soft cap on combined stdout+stderr buffered. Defaults to 32 MiB. */
  maxBuffer?: number;
  /** Hard timeout for the child process. Defaults to 10s. */
  timeoutMs?: number;
}

const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Run `git <args>` in `cwd`, returning stdout. Stable, well-typed wrapper used
 * by every other function in this package — never call `execFile` directly.
 */
export async function runGit(args: readonly string[], opts: RunGitOptions): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args as string[], {
      cwd: opts.cwd,
      maxBuffer: opts.maxBuffer ?? DEFAULT_MAX_BUFFER,
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      windowsHide: true,
      encoding: 'utf8',
    });
    return stdout;
  } catch (err) {
    const e = err as { stdout?: unknown; stderr?: unknown; code?: number | string };
    throw new GitExecError(
      args,
      opts.cwd,
      typeof e.code === 'number' ? e.code : null,
      asString(e.stderr),
      asString(e.stdout),
    );
  }
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toString?: unknown }).toString === 'function') {
    try {
      return (value as Buffer).toString('utf8');
    } catch {
      return String(value);
    }
  }
  return '';
}
