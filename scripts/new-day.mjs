import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const { initialState } = require('../build/src/core/model.js');
const { localDay } = require('../build/src/core/calendar.js');
const root = path.join(
  process.env.POMODORO_TEST_ROOT || os.tmpdir(),
  `pomodoro-new-day-${Date.now()}`,
);
mkdirSync(root, { recursive: true });
const profile = path.join(root, 'state.json');
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const seed = initialState('ru');
seed.cycleDay = localDay(yesterday.getTime());
seed.settings.durations = { focus: 50, short: 10, long: 30 };
seed.settings.sound = false;
seed.settings.notifications = false;
seed.timer.completedInCycle = 1;
seed.timer.durationMs = 3000000;
seed.timer.remainingMs = 1200000;
seed.timer.status = 'paused';
seed.history = [{ id: 'yesterday', endedAt: yesterday.getTime(), durationMs: 3000000 }];
const env = { ...process.env, POMODORO_TEST: '1', POMODORO_DATA_DIR: root };
delete env.ELECTRON_RUN_AS_NODE;
delete env.POMODORO_DEV_URL;
const errors = [];
let app;
async function launch() {
  app = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: process.cwd(),
    env,
  });
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
  await page.locator('.time').waitFor();
  return page;
}
const get = (page) => page.evaluate(() => window.pomodoro.getSnapshot());
try {
  writeFileSync(profile, JSON.stringify(seed));
  let page = await launch();
  await page.getByRole('dialog', { name: 'Новый день — новый цикл?' }).waitFor();
  await page.getByRole('dialog').press('r');
  assert.deepEqual((await get(page)).timer, seed.timer);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(360, 600));
  await page.screenshot({ path: path.join(root, 'new-day-ru.png') });
  await page.getByRole('button', { name: 'Продолжить цикл', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.deepEqual((await get(page)).timer, seed.timer);
  assert.deepEqual((await get(page)).history, seed.history);
  await app.close();

  page = await launch();
  assert.equal((await get(page)).newDayAvailable, false);
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.deepEqual((await get(page)).timer, seed.timer);
  await page.getByRole('button', { name: 'С первой сессии', exact: true }).click();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  assert.deepEqual((await get(page)).timer, seed.timer);
  await page.getByRole('button', { name: 'С первой сессии', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'С первой сессии', exact: true })
    .click();
  await page.getByText('Сессия 1 из 4', { exact: true }).waitFor();
  assert.equal(await page.locator('.time').innerText(), '50:00');
  assert.deepEqual((await get(page)).history, seed.history);
  assert.deepEqual((await get(page)).settings, seed.settings);
  await page.screenshot({ path: path.join(root, 'session-one.png') });
  await app.close();
  assert.equal(JSON.parse(readFileSync(profile, 'utf8')).timer.completedInCycle, 0);

  // Start a new day fixture and confirm directly from the automatic dialog in English.
  seed.settings.language = 'en';
  writeFileSync(profile, JSON.stringify(seed));
  page = await launch();
  await page.getByRole('dialog', { name: 'New day, new cycle?' }).waitFor();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Back to session 1', exact: true })
    .click();
  await page.getByText('Session 1 of 4', { exact: true }).waitFor();
  assert.equal((await get(page)).timer.status, 'idle');
  assert.deepEqual((await get(page)).history, seed.history);
  await app.close();
  page = await launch();
  assert.equal((await get(page)).newDayAvailable, false);
  assert.equal((await get(page)).timer.completedInCycle, 0);
  await app.close();

  // Escape means keep the cycle, including after a subsequent process restart.
  writeFileSync(profile, JSON.stringify(seed));
  page = await launch();
  await page.getByRole('dialog', { name: 'New day, new cycle?' }).press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.deepEqual((await get(page)).timer, seed.timer);
  await app.close();
  page = await launch();
  assert.equal((await get(page)).newDayAvailable, false);
  await app.close();
  app = null;
  assert.deepEqual(errors, []);
  console.log(
    'New-day UI passed: RU/EN, automatic offer, keep/restart, confirm/restart, manual reset/cancel, Escape, preserved statistics and settings.',
  );
  console.log('Isolated profile and screenshots:', root);
} finally {
  if (app) await app.close();
}
