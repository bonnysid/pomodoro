import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const tag = process.env.RELEASE_TAG;
assert.match(tag || '', /^v\d+\.\d+\.\d+$/);
const assets = readdirSync('release')
  .filter((name) => /\.(exe|dmg|zip|yml|blockmap)$/.test(name) && !name.startsWith('builder-'))
  .map((name) => path.join('release', name));
assert.ok(existsSync('release/latest.yml'), 'Missing Windows update metadata');
assert.ok(existsSync('release/latest-mac.yml'), 'Missing macOS update metadata');
assert.ok(assets.some((file) => file.endsWith('.exe')));
assert.ok(assets.some((file) => file.endsWith('.zip')));
function gh(args, allowFailure = false) {
  const result = spawnSync('gh', args, { encoding: 'utf8', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(result.stderr);
  return result;
}
const existing = gh(['release', 'view', tag, '--json', 'isDraft'], true);
if (existing.status === 0) {
  assert.equal(
    JSON.parse(existing.stdout).isDraft,
    true,
    'Refusing to overwrite a published release',
  );
} else {
  gh([
    'release',
    'create',
    tag,
    '--verify-tag',
    '--draft',
    '--title',
    `Pomodoro ${tag.slice(1)}`,
    '--notes-file',
    'docs/release-notes.md',
  ]);
}
gh(['release', 'upload', tag, ...assets, '--clobber']);
gh(['release', 'edit', tag, '--draft=false', '--latest']);
console.log(`Published ${tag} with ${assets.length} files.`);
