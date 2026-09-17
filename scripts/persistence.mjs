import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const { initialState } = require('../build/src/core/model.js');
const root = path.join(
  process.env.POMODORO_TEST_ROOT || os.tmpdir(),
  `pomodoro-persistence-${Date.now()}`,
);
const source = process.cwd();
const fakeAppData = path.join(root, 'system-app-data');
const profile = path.join(fakeAppData, 'Pomodoro', 'state.json');
const history = [{ id: 'preserved-session', endedAt: Date.now() - 60000, durationMs: 1500000 }];
const custom = {
  durations: { focus: 47, short: 9, long: 29 },
  longBreakEvery: 6,
  language: 'en',
  theme: 'sage',
  autoStartBreaks: true,
  autoStartFocus: true,
  notifications: false,
  sound: false,
  volume: 0.37,
  minimizeToTray: false,
  alwaysOnTop: true,
  ambience: 'brown',
  ambientVolume: 0.23,
};
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, state) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state));
};
function fixture(name) {
  const dir = path.join(root, name, 'projects', 'pomodoro');
  fs.mkdirSync(dir, { recursive: true });
  for (const item of ['build', 'dist', 'assets'])
    fs.cpSync(path.join(source, item), path.join(dir, item), {
      recursive: true,
    });
  // A relocated source checkout still needs its runtime dependencies.
  fs.symlinkSync(
    path.join(source, 'node_modules'),
    path.join(dir, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  write(path.join(dir, 'package.json'), {
    name: 'pomodoro-desktop',
    version: '0.1.0',
    main: 'bootstrap.cjs',
  });
  // Override only the platform data root in a test bootstrap. The real main process chooses userData.
  fs.writeFileSync(
    path.join(dir, 'bootstrap.cjs'),
    "const { app } = require('electron'); app.setPath('appData', process.env.POMODORO_FIXTURE_APP_DATA); require('./build/electron/main.js');",
  );
  return dir;
}
let app;
const errors = [];
async function launch(dir, appData = fakeAppData, override) {
  const env = {
    ...process.env,
    POMODORO_TEST: '1',
    POMODORO_FIXTURE_APP_DATA: appData,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.POMODORO_DEV_URL;
  delete env.POMODORO_DATA_DIR;
  if (override) env.POMODORO_DATA_DIR = override;
  app = await electron.launch({
    executablePath: require('electron'),
    args: [dir],
    env,
    cwd: dir,
    timeout: 30000,
  });
  const page = await app.firstWindow({ timeout: 30000 });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.time').waitFor();
  const userData = await app.evaluate(({ app }) => app.getPath('userData'));
  assert.equal(userData, override || path.join(appData, 'Pomodoro'));
  return page;
}
const get = (page) => page.evaluate(() => window.pomodoro.getSnapshot());
async function close() {
  await app.close();
  app = null;
}
try {
  const original = fixture('original'),
    relocated = fixture('relocated');
  const seeded = initialState('ru');
  seeded.history = history;
  write(profile, seeded);
  let page = await launch(original);
  await page.evaluate(
    (settings) => window.pomodoro.dispatch({ type: 'settings', settings }),
    custom,
  );
  assert.deepEqual((await get(page)).settings, custom);
  assert.deepEqual(
    read(profile).settings,
    custom,
    'Settings must be on disk immediately, without waiting for the periodic save',
  );
  await page.evaluate(() => window.pomodoro.dispatch({ type: 'toggle' }));
  await page.waitForTimeout(500);
  await close();
  page = await launch(original);
  assert.deepEqual((await get(page)).settings, custom);
  assert.deepEqual((await get(page)).history, history);
  assert.equal((await get(page)).timer.status, 'paused');
  await close();
  page = await launch(relocated);
  assert.deepEqual(
    (await get(page)).settings,
    custom,
    'Moving the source folder must not reset settings',
  );
  assert.deepEqual((await get(page)).history, history);
  await close();
  console.log(
    'PASS: every setting saves immediately and survives restart + project relocation; history and paused timer survive.',
  );

  const legacyFile = path.resolve(relocated, '../../work/app-data/state.json');
  const legacy = initialState('ru');
  legacy.settings.durations = { focus: 50, short: 10, long: 30 };
  legacy.history = history;
  write(legacyFile, legacy);
  const importRoot = path.join(root, 'fresh-system-app-data');
  page = await launch(relocated, importRoot);
  assert.deepEqual((await get(page)).settings, legacy.settings);
  assert.deepEqual((await get(page)).history, history);
  assert.deepEqual(read(legacyFile), legacy, 'Legacy source must not be modified');
  await close();
  page = await launch(relocated);
  assert.deepEqual(
    (await get(page)).settings,
    custom,
    'An existing shared profile must win over the old development profile',
  );
  await close();
  console.log(
    'PASS: legacy migration preserves original data and never overwrites an existing shared profile.',
  );

  const isolated = path.join(root, 'explicit-isolation');
  page = await launch(relocated, fakeAppData, isolated);
  const isolatedState = await get(page);
  assert.deepEqual(isolatedState.settings.durations, {
    focus: 25,
    short: 5,
    long: 15,
  });
  assert.deepEqual(isolatedState.history, []);
  await close();
  assert.deepEqual(read(profile).settings, custom);
  console.log(
    'PASS: POMODORO_DATA_DIR stays isolated and never imports or overwrites a real profile.',
  );
  assert.deepEqual(errors, []);
  console.log('Persistence regression passed. Test data:', root);
} finally {
  if (app) await close();
}
