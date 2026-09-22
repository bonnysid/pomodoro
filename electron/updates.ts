import { readFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { UpdateService } from '../src/application/update-service';
import type { UpdateState } from '../src/core/updates';

export function createUpdates(options: {
  canInstall: () => boolean;
  prepareInstall: () => boolean;
  setQuitting: (value: boolean) => void;
}) {
  let reason: UpdateState['unavailableReason'] = null;
  if (!app.isPackaged) reason = 'development';
  else if (process.platform === 'darwin') {
    const metadata = JSON.parse(readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
    if (metadata.pomodoroMacUpdates !== true) reason = 'mac-signing';
  } else if (process.platform !== 'win32') reason = 'platform';
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  const driver = {
    check: async () => {
      await autoUpdater.checkForUpdates();
    },
    download: async () => {
      await autoUpdater.downloadUpdate();
    },
    install: () => {
      options.setQuitting(true);
      try {
        // electron-updater 6.x: silent installation, then launch the updated app.
        autoUpdater.quitAndInstall(true, true);
      } catch (error) {
        options.setQuitting(false);
        throw error;
      }
    },
  };
  const service = new UpdateService(
    reason ? null : driver,
    options.canInstall,
    options.prepareInstall,
    reason,
  );
  autoUpdater.on('update-available', (info) => {
    const notes =
      typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : (info.releaseNotes || []).map((entry) => entry.note || '').join('\n');
    service.available(info.version, notes);
  });
  autoUpdater.on('update-not-available', () => service.current());
  autoUpdater.on('download-progress', (info) => service.progress(info.percent));
  autoUpdater.on('update-downloaded', () => service.downloaded());
  // check/download reject their promises too. A listener prevents unhandled EventEmitter errors.
  autoUpdater.on('error', (error) => {
    options.setQuitting(false);
    service.installFailed();
    console.error('Pomodoro update failed:', error.message);
  });
  return service;
}
