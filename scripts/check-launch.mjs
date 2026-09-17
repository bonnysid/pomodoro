import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const packaged = process.argv.includes('--packaged');
const dataDir = path.resolve(
  `../../work/${packaged ? 'packaged' : 'development'}-check-${Date.now()}`,
);
let server, app;
try {
  if (!packaged) {
    server = await createServer();
    await server.listen();
  }
  const env = {
    ...process.env,
    POMODORO_TEST: '1',
    POMODORO_DATA_DIR: dataDir,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  if (!packaged) env.POMODORO_DEV_URL = 'http://127.0.0.1:5173';
  else delete env.POMODORO_DEV_URL;
  app = await electron.launch({
    executablePath: packaged
      ? process.env.POMODORO_PACKAGED_EXECUTABLE ||
        path.resolve('release/win-unpacked/Pomodoro.exe')
      : require('electron'),
    args: packaged ? [] : ['.'],
    cwd: process.cwd(),
    env,
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.time').waitFor();
  const version = await app.evaluate(({ app }) => app.getVersion());
  assert.equal((await page.evaluate(() => window.pomodoro.getSnapshot())).appVersion, version);
  await page.evaluate(() =>
    window.pomodoro.dispatch({ type: 'settings', settings: { language: 'ru' } }),
  );
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.locator('.app-info').scrollIntoViewIfNeeded();
  assert.ok((await page.locator('.app-info').innerText()).includes(`Версия ${version}`));
  await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
  assert.ok((await page.locator('.app-info').innerText()).includes(`Version ${version}`));
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(await page.locator('.time').innerText(), '25:00');
  await page.evaluate(() => window.pomodoro.dispatch({ type: 'toggle' }));
  await page.waitForTimeout(700);
  const snapshot = await page.evaluate(() => window.pomodoro.getSnapshot());
  assert.equal(snapshot.timer.status, 'running');
  assert.ok(snapshot.timer.remainingMs < 1500000);
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), packaged);
  if (packaged) {
    await page.evaluate(() => window.pomodoro.window('close'));
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
      false,
    );
    assert.equal(
      (await page.evaluate(() => window.pomodoro.getSnapshot())).timer.status,
      'running',
    );
  }
  assert.deepEqual(errors, []);
  console.log(`${packaged ? 'Packaged executable' : 'Vite development'} launch passed.`);
} finally {
  if (app) await app.close();
  if (server) await server.close();
}
