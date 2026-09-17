import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const { initialState } = require('../build/src/core/model.js');
const dataDir = path.resolve(`../../work/smoke-data-${Date.now()}`);
const captures = path.resolve('../../work/screenshots');
mkdirSync(dataDir, { recursive: true });
mkdirSync(captures, { recursive: true });
const seed = initialState('ru');
seed.settings.sound = false;
seed.settings.notifications = false;
writeFileSync(path.join(dataDir, 'state.json'), JSON.stringify(seed));
const env = { ...process.env, POMODORO_TEST: '1', POMODORO_DATA_DIR: dataDir };
delete env.ELECTRON_RUN_AS_NODE;
delete env.POMODORO_DEV_URL;
let app;
const errors = [];
async function waitState(page, predicate) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    if (predicate(await page.evaluate(() => window.pomodoro.getSnapshot()))) return;
    await page.waitForTimeout(100);
  }
  throw new Error('Timed out waiting for timer state');
}
async function launch() {
  app = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: process.cwd(),
    env,
    timeout: 30000,
  });
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.time').waitFor();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
  return page;
}
try {
  let page = await launch();
  const get = () => page.evaluate(() => window.pomodoro.getSnapshot());
  assert.equal(await page.locator('.time').innerText(), '25:00');
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector('.timer-footer').getBoundingClientRect().bottom <=
        window.innerHeight,
    ),
    true,
  );
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '01-focus.png'),
  });
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await waitState(page, (s) => s.timer.remainingMs < 1499500);
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  assert.equal((await get()).timer.status, 'paused');
  const remaining = (await get()).timer.remainingMs;
  await page.waitForTimeout(400);
  assert.equal((await get()).timer.remainingMs, remaining);
  await page.getByRole('button', { name: 'Сбросить таймер', exact: true }).click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: '50 / 10 / 30', exact: true }).click();
  assert.equal((await get()).settings.durations.focus, 50);
  await page.getByRole('spinbutton', { name: 'Работа', exact: true }).fill('45');
  await page.getByRole('spinbutton', { name: 'Работа', exact: true }).press('Enter');
  assert.equal((await get()).settings.durations.focus, 45);
  await page.getByRole('spinbutton', { name: 'Работа', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: 'Работа', exact: true }).press('Enter');
  assert.equal((await get()).settings.durations.focus, 45);
  assert.equal(await page.getByRole('alert').count(), 1);
  await page.getByRole('spinbutton', { name: 'Работа', exact: true }).fill('45');
  await page.getByRole('spinbutton', { name: 'Работа', exact: true }).press('Enter');
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '02-settings.png'),
  });
  await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Paper', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(await page.locator('.time').innerText(), '45:00');
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '03-paper-english.png'),
  });
  await page.getByRole('button', { name: 'Break', exact: true }).click();
  await page.getByRole('button', { name: 'Long', exact: true }).click();
  assert.equal(await page.locator('.time').innerText(), '30:00');
  await page.getByRole('button', { name: 'Mini mode', exact: true }).click();
  await page.locator('.mini-timer').waitFor();
  const size = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getSize(),
  );
  assert.deepEqual(size, [300, 88]);
  await page.getByRole('button', { name: 'Pin above other windows', exact: true }).click();
  assert.equal(
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),
    true,
  );
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '04-mini.png'),
  });
  await page.getByRole('button', { name: 'Expand', exact: true }).click();
  assert.equal((await get()).compact, false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sage', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '05-sage-break.png'),
  });
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  assert.equal(await page.getByText('Your first completed session will appear here.').count(), 1);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Ambient sounds', exact: true }).click();
  await page.getByRole('button', { name: 'Brown noise', exact: true }).click();
  assert.equal((await get()).settings.ambience, 'brown');
  await page.getByRole('button', { name: 'Silence', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  const isolated = await page.evaluate(
    () => typeof window.require === 'undefined' && typeof window.process === 'undefined',
  );
  assert.equal(isolated, true);
  const invalidRejected = await page.evaluate(async () => {
    try {
      await window.pomodoro.dispatch({ type: 'phase', phase: 'bad' });
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(invalidRejected, true);
  await app.close();
  page = await launch();
  assert.equal((await get()).settings.language, 'en');
  assert.equal((await get()).settings.theme, 'sage');
  assert.equal((await get()).settings.durations.focus, 45);
  await app.close();

  const finalSession = initialState('ru');
  finalSession.settings.sound = false;
  finalSession.settings.notifications = false;
  finalSession.timer.completedInCycle = 3;
  finalSession.timer.remainingMs = 1200;
  finalSession.timer.status = 'paused';
  writeFileSync(path.join(dataDir, 'state.json'), JSON.stringify(finalSession));
  page = await launch();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await waitState(page, (s) => s.timer.phase === 'long');
  await page.locator('.time').filter({ hasText: '15:00' }).waitFor();
  assert.equal((await get()).history.length, 1);
  assert.equal((await get()).timer.completedInCycle, 4);
  assert.equal(await page.locator('.time').innerText(), '15:00');
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '06-long-break.png'),
  });
  await page.getByRole('button', { name: 'Статистика', exact: true }).click();
  assert.equal(await page.locator('.stats-numbers strong').first().innerText(), '1');
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '07-statistics.png'),
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
  const beforeReset = await get();
  await page.getByRole('button', { name: 'С первой сессии', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click();
  assert.deepEqual((await get()).timer, beforeReset.timer);
  await page.getByRole('button', { name: 'С первой сессии', exact: true }).click();
  await page.getByRole('dialog').press('Escape');
  assert.deepEqual((await get()).timer, beforeReset.timer);
  await page.getByRole('button', { name: 'С первой сессии', exact: true }).click();
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '09-reset-cycle.png'),
  });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'С первой сессии', exact: true })
    .click();
  assert.deepEqual((await get()).history, beforeReset.history);
  assert.deepEqual((await get()).settings, beforeReset.settings);
  assert.equal((await get()).timer.status, 'idle');
  assert.equal((await get()).timer.phase, 'focus');
  assert.equal((await get()).timer.completedInCycle, 0);
  await page.getByRole('button', { name: 'Начать', exact: true }).click();
  await app.evaluate(({ powerMonitor }) => powerMonitor.emit('suspend'));
  assert.equal((await get()).timer.status, 'paused');
  assert.equal((await get()).suspended, true);
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
  const before = (await get()).timer.remainingMs;
  await page.waitForTimeout(1100);
  assert.ok((await get()).timer.remainingMs < before - 900);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(360, 600));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > window.innerWidth ||
      document.querySelector('.timer-footer').getBoundingClientRect().bottom > window.innerHeight,
  );
  assert.equal(overflow, false);
  await page.screenshot({
    animations: 'disabled',
    path: path.join(captures, '08-small-window.png'),
  });
  await app.close();
  app = null;
  const persisted = JSON.parse(readFileSync(path.join(dataDir, 'state.json'), 'utf8'));
  assert.equal(persisted.timer.status, 'paused');
  assert.equal(persisted.history.length, 1);
  assert.deepEqual(errors, []);
  console.log(
    'Electron smoke passed: timer, pause, presets, custom durations, validation, RU/EN, 3 themes, long break, cycle, mini mode, pinning, statistics, sounds, persistence, sleep, hidden countdown, 360px layout, IPC isolation.',
  );
  console.log('Screenshots:', captures);
} finally {
  if (app) await app.close();
}
