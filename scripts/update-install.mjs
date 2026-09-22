import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const env = {
  ...process.env,
  POMODORO_TEST: '1',
  POMODORO_DATA_DIR: mkdtempSync(path.join(os.tmpdir(), 'pomodoro-update-test-')),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.POMODORO_DEV_URL;
if (process.platform !== 'win32') throw new Error('NSIS update test requires Windows');
let desktop;
try {
  desktop = await electron.launch({ executablePath: require('electron'), args: ['.'], env });
  const page = await desktop.firstWindow();
  await page.locator('.time').waitFor();
  const result = await desktop.evaluate(async ({ app }) => {
    const { createRequire } = process.mainModule.require('node:module');
    const load = createRequire(`${app.getAppPath()}/package.json`);
    const { autoUpdater } = load('electron-updater');
    const { createUpdates } = load('./build/electron/updates.js');
    const calls = [];
    const states = [];
    const packaged = Object.getOwnPropertyDescriptor(app, 'isPackaged');
    const originalQuit = autoUpdater.app.quit;
    Object.defineProperty(app, 'isPackaged', { configurable: true, value: true });
    // Exercise the real adapter and NSIS argument generation, intercepting only
    // network access, process launch and quit so no installed app is replaced.
    autoUpdater.checkForUpdates = async () => {
      calls.push('check');
      autoUpdater.emit('update-available', { version: '9.0.0', releaseNotes: '<p>Changes</p>' });
    };
    autoUpdater.downloadUpdate = async () => {
      calls.push('download');
      autoUpdater.emit('download-progress', { percent: 50 });
      autoUpdater.downloadedUpdateHelper = {
        file: 'C:\\test-only\\Pomodoro-update.exe',
        downloadedFileInfo: { isAdminRightsRequired: false },
      };
      autoUpdater.emit('update-downloaded');
    };
    let launched;
    autoUpdater.spawnLog = async (file, args) => {
      calls.push('launch');
      launched = { file, args };
    };
    autoUpdater.app.quit = () => calls.push('quit');
    try {
      const updates = createUpdates({
        canInstall: () => true,
        prepareInstall: () => {
          calls.push('save');
          return true;
        },
        setQuitting: (value) => calls.push(`quitting:${value}`),
      });
      updates.onState(() => states.push(updates.state.status));
      await updates.dispatch('check');
      const beforeInstall = [...calls];
      await updates.dispatch('install');
      await new Promise((resolve) => setImmediate(resolve));
      return { beforeInstall, calls, states, launched, status: updates.state.status };
    } finally {
      Object.defineProperty(app, 'isPackaged', packaged);
      autoUpdater.app.quit = originalQuit;
    }
  });
  assert.deepEqual(result.beforeInstall, ['check', 'download']);
  assert.deepEqual(result.calls, ['check', 'download', 'save', 'quitting:true', 'launch', 'quit']);
  assert.deepEqual(result.launched.args, ['--updated', '/S', '--force-run']);
  assert.equal(result.launched.file, 'C:\\test-only\\Pomodoro-update.exe');
  assert.equal(result.status, 'installing');
  assert.ok(result.states.includes('downloaded'));
  console.log(
    'Background download and real NSIS silent/relaunch arguments passed (process launch intercepted).',
  );
} finally {
  await desktop?.close();
}
