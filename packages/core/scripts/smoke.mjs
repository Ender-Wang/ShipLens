// Quick end-to-end smoke test: spin up a throwaway git repo with a few tags
// and verify that resolveLineRelease maps each scenario to the right result.
//
// Run with: node packages/core/scripts/smoke.mjs

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const dist = await import('../dist/index.js');
const { resolveLineRelease, findRepoRoot, invalidateRepo } = dist;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shiplens-smoke-'));
const file = path.join(tmp, 'src.txt');
const sh = (...args) => execFileSync(args[0], args.slice(1), { cwd: tmp, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();

try {
  sh('git', 'init', '-q', '-b', 'main');
  sh('git', 'config', 'user.email', 'smoke@example.com');
  sh('git', 'config', 'user.name', 'Smoke Test');
  sh('git', 'config', 'commit.gpgsign', 'false');

  fs.writeFileSync(file, 'line A\nline B\nline C\n');
  sh('git', 'add', 'src.txt');
  sh('git', 'commit', '-q', '-m', 'first commit');
  sh('git', 'tag', 'v1.0.0');

  fs.writeFileSync(file, 'line A\nline B (changed in v1.1)\nline C\n');
  sh('git', 'add', 'src.txt');
  sh('git', 'commit', '-q', '-m', 'tweak line B');
  sh('git', 'tag', 'v1.1.0-rc1');
  sh('git', 'tag', 'v1.1.0');

  fs.writeFileSync(file, 'line A\nline B (changed in v1.1)\nline C\nline D (post-1.1)\n');
  sh('git', 'add', 'src.txt');
  sh('git', 'commit', '-q', '-m', 'add line D');

  // Working-tree change to demonstrate the Uncommitted path.
  fs.appendFileSync(file, 'line E (uncommitted)\n');

  invalidateRepo();
  const repoRoot = await findRepoRoot(file);
  console.log('repoRoot:', repoRoot);

  const cases = [
    { line: 1, label: 'line 1 — original commit, expect v1.0.0' },
    { line: 2, label: 'line 2 — v1.1 commit, expect v1.1.0 (rc filtered)' },
    { line: 4, label: 'line 4 — post-1.1 commit, expect Unreleased' },
    { line: 5, label: 'line 5 — uncommitted, expect Uncommitted' },
  ];

  for (const c of cases) {
    const r = await resolveLineRelease({
      repoRoot,
      filePath: file,
      line: c.line,
      tagInclude: '*',
      tagExclude: ['*-rc*'],
    });
    console.log(`\n# ${c.label}`);
    console.log(JSON.stringify(r, null, 2));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
