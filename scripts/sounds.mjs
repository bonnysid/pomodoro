import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const { initialState } = require('../build/src/core/model.js');
const profile = mkdtempSync(path.join(os.tmpdir(), 'pomodoro-sounds-'));
writeFileSync(path.join(profile, 'state.json'), JSON.stringify(initialState('ru')));
const env = { ...process.env, POMODORO_TEST: '1', POMODORO_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.POMODORO_DEV_URL;
let app;
const errors = [];
async function launch() {
  app = await electron.launch({ executablePath: require('electron'), args: ['.'], env });
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.setAudioMuted(true);
    win.showInactive();
  });
  // Observe real Web Audio sources without exposing production test hooks.
  await page.addInitScript(() => {
    window.activeSources = new Set();
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function (...args) {
      const source = create.apply(this, args);
      const start = source.start.bind(source);
      source.start = (...values) => {
        window.activeSources.add(source);
        start(...values);
      };
      source.addEventListener('ended', () => window.activeSources.delete(source));
      return source;
    };
  });
  await page.reload();
  await page.locator('.time').waitFor();
  return page;
}
const expectSources = (page, count) =>
  page.waitForFunction((expected) => window.activeSources.size === expected, count);
try {
  let page = await launch();
  await page.getByRole('button', { name: 'Фоновые звуки', exact: true }).click();
  await page.getByRole('button', { name: 'Прослушать: LoFi', exact: true }).click();
  await expectSources(page, 1);
  assert.equal(
    (await page.evaluate(() => window.pomodoro.getSnapshot())).settings.ambience,
    'none',
  );
  await page.getByRole('button', { name: 'Прослушать: Тихие миры', exact: true }).click();
  await expectSources(page, 1);
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expectSources(page, 0);
  await page.getByRole('button', { name: 'Фоновые звуки', exact: true }).click();
  await page.getByRole('button', { name: 'LoFi', exact: true }).click();
  await expectSources(page, 0);
  await page.getByRole('switch', { name: 'Играть и без таймера', exact: true }).click();
  await expectSources(page, 1);
  await page.getByRole('button', { name: 'Прослушать: Белый шум', exact: true }).click();
  await page
    .getByRole('button', { name: 'Остановить прослушивание: Белый шум', exact: true })
    .waitFor();
  await page
    .getByRole('button', { name: 'Прослушать: Белый шум', exact: true })
    .waitFor({ timeout: 16000 });
  await expectSources(page, 1);
  assert.ok(await page.evaluate(() => [...window.activeSources][0].buffer.duration > 40));
  await page.getByRole('switch', { name: 'Играть и без таймера', exact: true }).click();
  await expectSources(page, 0);
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await expectSources(page, 1);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await expectSources(page, 0);
  const volume = page.getByRole('slider', { name: 'Громкость фоновых звуков', exact: true });
  await volume.fill('0.37');
  await page.waitForFunction(
    () => document.querySelector('.quick-volume span')?.textContent === '37%',
  );
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(360, 600));
  assert.ok(await page.locator('.quick-volume').isVisible());
  assert.ok(
    await page
      .locator('.timer-footer')
      .evaluate((node) => node.getBoundingClientRect().bottom <= innerHeight),
  );
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/sounds-main.png' });
  await page.getByRole('button', { name: 'Фоновые звуки', exact: true }).click();
  await page.getByRole('switch', { name: 'Играть и без таймера', exact: true }).click();
  await page.screenshot({ path: 'test-results/sounds-panel.png' });
  await app.close();
  page = await launch();
  await expectSources(page, 1);
  const state = await page.evaluate(() => window.pomodoro.getSnapshot());
  assert.equal(state.settings.ambientAlways, true);
  assert.equal(state.settings.ambience, 'lofi');
  assert.equal(state.settings.ambientVolume, 0.37);
  await page.evaluate(() => window.pomodoro.dispatch({ type: 'phase', phase: 'short' }));
  await expectSources(page, 1);
  await page.evaluate(() =>
    window.pomodoro.dispatch({ type: 'settings', settings: { ambience: 'none' } }),
  );
  await expectSources(page, 0);
  assert.deepEqual(errors, []);
  console.log(
    'Sound previews, timeout/restore, focus/pause/break behavior, quick volume and persistence passed.',
  );
} finally {
  await app?.close();
}
