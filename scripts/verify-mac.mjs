import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

if (process.platform !== 'darwin') throw new Error('Run macOS verification on a Mac');
const metadata = JSON.parse(readFileSync('package.json', 'utf8'));
for (const directory of ['mac', 'mac-arm64']) {
  const bundle = path.resolve('release', directory, 'Pomodoro.app');
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', bundle], {
    stdio: 'inherit',
  });
  if (metadata.pomodoroMacUpdates) {
    execFileSync('spctl', ['--assess', '--type', 'execute', '--verbose=2', bundle], {
      stdio: 'inherit',
    });
  }
}
const executablePath = path.resolve(
  'release',
  process.arch === 'arm64' ? 'mac-arm64' : 'mac',
  'Pomodoro.app/Contents/MacOS/Pomodoro',
);
const env = {
  ...process.env,
  POMODORO_TEST: '1',
  POMODORO_DATA_DIR: mkdtempSync(path.join(os.tmpdir(), 'pomodoro-mac-')),
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.POMODORO_DEV_URL;
let app;
try {
  app = await electron.launch({ executablePath, args: [], env, timeout: 60000 });
  const page = await app.firstWindow();
  await page.locator('.time').waitFor();
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
  assert.equal(
    (await page.evaluate(() => window.pomodoro.getSnapshot())).appVersion,
    metadata.version,
  );
  console.log(`Verified signatures for both architectures and native ${process.arch} launch.`);
} finally {
  await app?.close();
}
