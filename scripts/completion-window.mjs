import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const { initialState } = require('../build/src/core/model.js');
const root = path.join(os.tmpdir(), `pomodoro-completion-${Date.now()}`);
mkdirSync(root, { recursive: true });
const profile = path.join(root, 'profile');
mkdirSync(profile, { recursive: true });
const env = { ...process.env, POMODORO_TEST: '1', POMODORO_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.POMODORO_DEV_URL;
let app;
let mainWindowId;
const windowState = () =>
  app.evaluate(({ BrowserWindow }, id) => {
    const win = BrowserWindow.fromId(id);
    return {
      visible: win.isVisible(),
      minimized: win.isMinimized(),
      pinned: win.isAlwaysOnTop(),
      focused: win.isFocused(),
    };
  }, mainWindowId);
try {
  for (const scenario of [
    { phase: 'focus', mode: 'hidden' },
    { phase: 'short', mode: 'minimized' },
    { phase: 'long', mode: 'covered' },
    { phase: 'focus', mode: 'compact' },
    { phase: 'focus', mode: 'pinned' },
    { phase: 'focus', mode: 'disabled' },
    { phase: 'focus', mode: 'skip' },
    { phase: 'focus', mode: 'disable-raised' },
  ]) {
    const seed = initialState('ru');
    seed.settings.sound = false;
    seed.settings.notifications = false;
    seed.settings.alwaysOnTop = scenario.mode === 'pinned';
    seed.timer.phase = scenario.phase;
    seed.timer.status = 'paused';
    seed.timer.durationMs = seed.settings.durations[scenario.phase] * 60000;
    seed.timer.remainingMs = 1200;
    writeFileSync(path.join(profile, 'state.json'), JSON.stringify(seed));
    app = await electron.launch({
      executablePath: require('electron'),
      args: ['.'],
      cwd: process.cwd(),
      env,
      timeout: 30000,
    });
    const page = await app.firstWindow({ timeout: 30000 });
    await page.locator('.time').waitFor();
    if (scenario.mode === 'disabled') {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
      await page.getByRole('button', { name: 'Настройки', exact: true }).click();
      const toggle = page.getByRole('switch', {
        name: 'Показывать окно по завершении',
        exact: true,
      });
      assert.equal(await toggle.isChecked(), true);
      await toggle.uncheck();
      await page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
      await app.close();
      app = await electron.launch({
        executablePath: require('electron'),
        args: ['.'],
        cwd: process.cwd(),
        env,
        timeout: 30000,
      });
      const restartedPage = await app.firstWindow({ timeout: 30000 });
      await restartedPage.locator('.time').waitFor();
      assert.equal(
        (await restartedPage.evaluate(() => window.pomodoro.getSnapshot())).settings
          .showOnCompletion,
        false,
      );
    }
    const activePage = await app.firstWindow();
    mainWindowId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id);
    if (scenario.mode === 'compact')
      await activePage.evaluate(() => window.pomodoro.window('compact'));
    if (scenario.mode === 'minimized') {
      await app.evaluate(({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.show();
        win.minimize();
      });
    } else if (scenario.mode === 'covered') {
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].show();
        const cover = new BrowserWindow({ width: 600, height: 700, show: true });
        cover.focus();
      });
    } else {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    }
    if (scenario.mode === 'skip') {
      await activePage.evaluate(() => window.pomodoro.dispatch({ type: 'skip' }));
      assert.equal((await windowState()).visible, false);
    } else {
      await activePage.evaluate(() => window.pomodoro.dispatch({ type: 'toggle' }));
      await activePage.waitForFunction(
        (phase) => document.querySelector('.app').dataset.phase !== phase,
        scenario.phase,
      );
      if (scenario.mode === 'disabled') {
        assert.equal((await windowState()).visible, false);
      } else {
        const win = await windowState();
        assert.equal(win.visible, true, scenario.mode);
        assert.equal(win.minimized, false, scenario.mode);
        assert.equal(win.pinned, true, scenario.mode);
        if (scenario.mode === 'covered') assert.equal(win.focused, true);
        if (scenario.mode === 'compact')
          assert.equal(
            (await activePage.evaluate(() => window.pomodoro.getSnapshot())).compact,
            true,
          );
        if (scenario.mode === 'disable-raised') {
          await activePage.evaluate(() =>
            window.pomodoro.dispatch({ type: 'settings', settings: { showOnCompletion: false } }),
          );
          assert.equal((await windowState()).pinned, false);
        } else {
          await activePage.waitForTimeout(2300);
          assert.equal((await windowState()).pinned, scenario.mode === 'pinned');
        }
      }
    }
    console.log(`PASS: ${scenario.phase} / ${scenario.mode}`);
    await app.close();
    app = null;
  }
  console.log(
    'Completion window regression passed, including persisted opt-out. Profile:',
    profile,
  );
} finally {
  if (app) await app.close();
}
