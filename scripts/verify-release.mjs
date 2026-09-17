import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(process.env.GITHUB_REF_NAME, `v${version}`, 'Git tag must match package.json version');
assert.match(version, /^\d+\.\d+\.\d+$/, 'Only stable releases are published by this workflow');
console.log(`Release version verified: ${version}`);
