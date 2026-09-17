import { type BrowserWindow, ipcMain } from 'electron';
import type { PomodoroService } from '../src/application/pomodoro-service';
import type { UpdateService } from '../src/application/update-service';
import { decodeAction } from '../src/core/model';
import { decodeUpdateAction } from '../src/core/updates';
import { channels, type Snapshot, type WindowAction } from '../src/shared/contracts';
import { assertTrusted } from './security';

export function registerIpc(options: {
  service: PomodoroService;
  updates: UpdateService;
  window: () => BrowserWindow | null;
  snapshot: () => Snapshot;
  windowAction: (action: WindowAction) => void;
  devUrl: string | null;
}) {
  const { service, snapshot, devUrl } = options;
  ipcMain.handle(channels.update, async (event, raw: unknown) => {
    assertTrusted(event, options.window(), devUrl);
    await options.updates.dispatch(decodeUpdateAction(raw));
    return snapshot();
  });
  ipcMain.handle(channels.get, (event) => {
    assertTrusted(event, options.window(), devUrl);
    service.tick();
    return snapshot();
  });
  ipcMain.handle(channels.action, (event, raw: unknown) => {
    assertTrusted(event, options.window(), devUrl);
    service.dispatch(decodeAction(raw));
    return snapshot();
  });
  ipcMain.handle(channels.window, (event, raw: unknown) => {
    assertTrusted(event, options.window(), devUrl);
    if (raw !== 'compact' && raw !== 'expand' && raw !== 'close' && raw !== 'minimize')
      throw new Error('Invalid window action');
    options.windowAction(raw);
  });
}
