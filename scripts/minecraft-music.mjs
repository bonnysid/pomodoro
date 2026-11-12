import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const { initialState } = require('../build/src/core/model.js');
const profile = mkdtempSync(path.join(os.tmpdir(), 'pomodoro-minecraft-ui-'));
const assets = path.join(profile, 'fake-assets');
mkdirSync(path.join(assets, 'indexes'), { recursive: true });
const objects = {};
const ids = [];
for (const [file, name] of [
  ['tone-a.ogg', 'minecraft'],
  ['tone-b.ogg', 'sweden'],
]) {
  // Synthetic tones, not recordings from Minecraft.
  const bytes = readFileSync(path.join('tests/fixtures', file));
  const hash = createHash('sha1').update(bytes).digest('hex');
  mkdirSync(path.join(assets, 'objects', hash.slice(0, 2)), { recursive: true });
  writeFileSync(path.join(assets, 'objects', hash.slice(0, 2), hash), bytes);
  objects[`minecraft/sounds/music/game/${name}.ogg`] = { hash };
  ids.push(hash);
}
writeFileSync(path.join(assets, 'indexes', 'test.json'), JSON.stringify({ objects }));
writeFileSync(path.join(profile, 'minecraft-music.json'), JSON.stringify({ directory: assets }));
writeFileSync(path.join(profile, 'state.json'), JSON.stringify(initialState('ru')));
const env = { ...process.env, POMODORO_TEST: '1', POMODORO_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.POMODORO_DEV_URL;
let app;
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: ['.'], env });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.setAudioMuted(true);
    win.showInactive();
  });
  await page.addInitScript(() => {
    window.musicPlayer = null;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.musicPlayer = this;
      return play.call(this);
    };
  });
  await page.reload();
  await page.locator('.time').waitFor();
  return page;
}
try {
  let page = await launch();
  await page.getByRole('button', { name: 'Фоновые звуки', exact: true }).click();
  await page
    .getByRole('button', { name: 'Прослушать: Minecraft · оригиналы', exact: true })
    .click();
  await page.waitForFunction(
    () => window.musicPlayer?.currentTime > 0.1 && !window.musicPlayer.paused,
  );
  assert.equal(
    (await page.evaluate(() => window.pomodoro.getSnapshot())).settings.ambience,
    'none',
  );
  await page.waitForFunction(
    (id) => window.musicPlayer?.src.includes(id) && window.musicPlayer.currentTime > 0.1,
    ids[1],
  );
  await page.waitForFunction(
    (id) => window.musicPlayer?.src.includes(id) && window.musicPlayer.currentTime > 0.1,
    ids[0],
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.waitForFunction(() => window.musicPlayer.paused);
  await page.getByRole('button', { name: 'Фоновые звуки', exact: true }).click();
  await page.getByRole('button', { name: 'Minecraft · оригиналы', exact: true }).click();
  await page.getByRole('switch', { name: 'Играть и без таймера', exact: true }).click();
  await page.waitForFunction(() => window.musicPlayer && !window.musicPlayer.paused);
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('slider', { name: 'Громкость фоновых звуков', exact: true }).fill('0.27');
  await page.waitForFunction(() => window.musicPlayer.volume === 0.27);
  assert.equal(
    await page.evaluate(async () => (await fetch('pomodoro://app/music/not-a-track.ogg')).status),
    404,
  );
  const range = await page.evaluate(async (id) => {
    const response = await fetch(`pomodoro://app/music/${id}.ogg`, {
      headers: { Range: 'bytes=0-3' },
    });
    return {
      status: response.status,
      text: await response.text(),
      range: response.headers.get('Content-Range'),
    };
  }, ids[0]);
  assert.equal(range.status, 206);
  assert.equal(range.text, 'OggS');
  assert.ok(range.range.startsWith('bytes 0-3/'));
  await app.close();
  page = await launch();
  await page.waitForFunction(
    () => window.musicPlayer?.currentTime > 0.1 && !window.musicPlayer.paused,
  );
  assert.equal(
    (await page.evaluate(() => window.pomodoro.getSnapshot())).settings.ambientVolume,
    0.27,
  );
  await page.getByRole('button', { name: 'Фоновые звуки', exact: true }).click();
  await page.getByRole('button', { name: 'Отключить библиотеку', exact: true }).click();
  await page.waitForFunction(() => window.musicPlayer.paused);
  await page.getByRole('button', { name: 'Подключить музыку Minecraft', exact: true }).waitFor();
  assert.equal(
    (await page.evaluate(() => window.pomodoro.getSnapshot())).settings.ambience,
    'none',
  );
  console.log(
    'Minecraft playlist: real decoding, next-track/repeat, preview, volume, restart and disconnect passed.',
  );
} finally {
  await app?.close();
}
