import path from 'node:path';
import { app, Menu, powerMonitor, protocol } from 'electron';
import { PomodoroService } from '../src/application/pomodoro-service';
import { channels, type Snapshot } from '../src/shared/contracts';
import { registerIpc } from './ipc';
import { notifyCompletion } from './notifications';
import { registerLocalContent } from './security';
import { JsonStateRepository, resolveDataDirectory } from './state-store';
import { AppTray } from './tray';
import { createUpdates } from './updates';
import { AppWindow } from './window';

app.setName('Pomodoro');
app.setPath(
  'userData',
  resolveDataDirectory(app.getPath('appData'), process.env.POMODORO_DATA_DIR),
);
app.setAppUserModelId('app.pomodoro.desktop');
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pomodoro',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let window: AppWindow | undefined;
let service: PomodoroService | undefined;
let tray: AppTray | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let checkpoint: ReturnType<typeof setInterval> | undefined;
const testMode = process.env.POMODORO_TEST === '1';
const devUrl =
  !app.isPackaged && process.env.POMODORO_DEV_URL === 'http://127.0.0.1:5173'
    ? process.env.POMODORO_DEV_URL
    : null;

async function start() {
  const appPath = app.getAppPath();
  const repository = new JsonStateRepository(path.join(app.getPath('userData'), 'state.json'));
  const language = app.getLocale().toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const legacy =
    !process.env.POMODORO_DATA_DIR && !app.isPackaged
      ? path.resolve(appPath, '../../work/app-data/state.json')
      : undefined;
  const loaded = repository.load(language, legacy);
  const controller = new PomodoroService(loaded.state, repository, Date.now, loaded.storageError);
  service = controller;
  const updates = createUpdates({
    canInstall: () => controller.state.timer.status !== 'running',
    prepareInstall: () => {
      controller.suspend();
      return !controller.storageError;
    },
    setQuitting: (value) => {
      if (window) window.quitting = value;
    },
  });
  const snapshot = (): Snapshot => ({
    ...controller.state,
    appVersion: app.getVersion(),
    updates: updates.state,
    platform: process.platform as Snapshot['platform'],
    compact: window?.compact ?? false,
    storageError: controller.storageError,
    suspended: controller.suspended,
    newDayAvailable: controller.newDayAvailable,
  });
  const broadcast = () => {
    window?.send(channels.state, snapshot());
    tray?.update(controller.state);
    window?.applySettings();
  };
  const desktop = new AppWindow({
    appPath,
    devUrl,
    testMode,
    settings: () => controller.state.settings,
    hasTray: () => Boolean(tray),
    changed: broadcast,
    checkpoint: () => controller.checkpoint(),
  });
  window = desktop;
  registerLocalContent(appPath);
  registerIpc({
    service: controller,
    updates,
    window: () => desktop.window,
    snapshot,
    windowAction: (action) => desktop.action(action),
    devUrl,
  });
  controller.onState(broadcast);
  updates.onState(broadcast);
  controller.onComplete((event) => {
    desktop.showOnCompletion();
    if (!testMode) notifyCompletion(event, controller.state.settings, appPath, desktop.show);
    desktop.send(channels.complete, event);
  });
  try {
    tray = new AppTray(appPath, {
      show: desktop.show,
      quit: () => app.quit(),
      dispatch: (action) => controller.dispatch(action),
    });
  } catch (error) {
    console.error('Tray unavailable:', error);
  }
  if (process.platform === 'darwin')
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'Pomodoro',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        { role: 'editMenu' },
        { role: 'windowMenu' },
      ]),
    );
  else Menu.setApplicationMenu(null);
  desktop.create();
  broadcast();
  heartbeat = setInterval(() => controller.tick(), 250);
  heartbeat.unref();
  checkpoint = setInterval(() => controller.checkpoint(), 5000);
  checkpoint.unref();
  powerMonitor.on('suspend', () => controller.suspend());
  powerMonitor.on('resume', broadcast);
  if (!testMode && updates.state.status !== 'disabled') {
    const updateCheck = setTimeout(() => {
      void updates.dispatch('check');
    }, 15000);
    updateCheck.unref();
  }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => window?.show());
  app.on('activate', () => window?.show());
  void app
    .whenReady()
    .then(start)
    .catch((error) => {
      console.error(error);
      app.quit();
    });
}
app.on('before-quit', () => {
  if (window) window.quitting = true;
  clearInterval(heartbeat);
  clearInterval(checkpoint);
  service?.suspend();
  tray?.dispose();
  tray = undefined;
});
app.on('window-all-closed', () => {
  if (!window?.quitting) app.quit();
});
