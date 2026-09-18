import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const { initialState } = require('../build/src/core/model.js');
const profile = path.join(os.tmpdir(), `pomodoro-release-notes-${Date.now()}`);
mkdirSync(profile, { recursive: true });
writeFileSync(path.join(profile, 'state.json'), JSON.stringify(initialState('ru')));
const env = { ...process.env, POMODORO_TEST: '1', POMODORO_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
delete env.POMODORO_DEV_URL;
let app;
try {
  app = await electron.launch({ executablePath: require('electron'), args: ['.'], env });
  const page = await app.firstWindow();
  await page.locator('.time').waitFor();
  // Supply release descriptions through the real snapshot channel without a network request.
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.showInactive();
    const send = win.webContents.send.bind(win.webContents);
    win.webContents.send = (channel, ...args) => {
      if (channel === 'pomodoro:state' && win.testReleaseNotes !== undefined) {
        args[0] = {
          ...args[0],
          updates: { ...args[0].updates, notes: win.testReleaseNotes },
        };
      }
      send(channel, ...args);
    };
  });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  const cases = [
    [
      '<p>Pomodoro 0.2.4</p>\n<p>• Первый пункт<br>\n• Второй пункт</p>',
      'Pomodoro 0.2.4\n\n• Первый пункт\n• Второй пункт',
    ],
    [
      '<h2>Changes</h2><ul><li>One</li><li><strong>Two</strong></li></ul>',
      'Changes\n\n• One\n• Two',
    ],
    ['<p>Русский &amp; English &lt;example&gt; &#169;</p>', 'Русский & English <example> ©'],
    ['Plain text\nLine two\n\nNext paragraph', 'Plain text\nLine two\n\nNext paragraph'],
    [
      '<p>Safe</p><script>window.notesExecuted = true</script><style>body{display:none}</style><iframe src="https://example.invalid"></iframe><img src="https://example.invalid/a" onerror="window.notesExecuted=true">',
      'Safe',
    ],
    ['<script>window.notesExecuted = true</script>', ''],
  ];
  for (const [source, expected] of cases) {
    await app.evaluate(({ BrowserWindow }, notes) => {
      BrowserWindow.getAllWindows()[0].testReleaseNotes = notes;
    }, source);
    await page.waitForFunction((text) => {
      const paragraph = document.querySelector('.update-notes p');
      return text ? paragraph?.textContent === text : !paragraph;
    }, expected);
    assert.equal(
      await page.locator('.update-notes script, .update-notes img, .update-notes iframe').count(),
      0,
    );
    assert.equal(await page.evaluate(() => window.notesExecuted), undefined);
  }
  console.log(`Release notes: ${cases.length} UI regression cases passed.`);
} finally {
  await app?.close();
}
