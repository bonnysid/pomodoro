import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { findMinecraftMusic, MinecraftMusic } from '../electron/minecraft-music';

test('only indexed calm Ogg tracks with matching hashes are exposed, and only a folder reference is saved', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pomodoro-music-'));
  const assets = path.join(root, 'assets');
  mkdirSync(path.join(assets, 'indexes'), { recursive: true });
  const bytes = Buffer.from('OggS synthetic test object');
  const hash = createHash('sha1').update(bytes).digest('hex');
  mkdirSync(path.join(assets, 'objects', hash.slice(0, 2)), { recursive: true });
  writeFileSync(path.join(assets, 'objects', hash.slice(0, 2), hash), bytes);
  writeFileSync(
    path.join(assets, 'indexes', 'test.json'),
    JSON.stringify({
      objects: {
        'minecraft/sounds/music/game/sweden.ogg': { hash },
        'minecraft/sounds/music/game/wet_hands.ogg': { hash: '../../private' },
        'minecraft/sounds/music/game/end/boss.ogg': { hash },
        'minecraft/sounds/music/game/minecraft.ogg': { hash: 'a'.repeat(40) },
      },
    }),
  );
  assert.equal(findMinecraftMusic(root).length, 1);
  const config = path.join(root, 'profile', 'library.json');
  const library = new MinecraftMusic(config);
  assert.equal(library.connect(assets), true);
  assert.deepEqual(library.summary, [{ id: hash, title: 'Sweden' }]);
  assert.equal(library.file('../../private'), undefined);
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), { directory: assets });
  assert.deepEqual(new MinecraftMusic(config).summary, library.summary);
  assert.equal(library.connect(path.join(root, 'missing')), false);
  assert.equal(library.summary.length, 1, 'failed reconnect keeps the existing library');
  writeFileSync(path.join(assets, 'objects', hash.slice(0, 2), hash), Buffer.from('OggS modified'));
  assert.equal(findMinecraftMusic(assets).length, 0);
  library.disconnect();
  assert.equal(new MinecraftMusic(config).summary.length, 0);
});
