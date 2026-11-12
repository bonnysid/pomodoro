import { type BrowserWindow, dialog, ipcMain } from 'electron';
import type { PomodoroService } from '../src/application/pomodoro-service';
import type { UpdateService } from '../src/application/update-service';
import { decodeAction } from '../src/core/model';
import { decodeUpdateAction } from '../src/core/updates';
import { channels, type Snapshot, type WindowAction } from '../src/shared/contracts';
import type { MinecraftMusic } from './minecraft-music';
import { assertTrusted } from './security';

export function registerIpc(options: {
  service: PomodoroService;
  updates: UpdateService;
  window: () => BrowserWindow | null;
  snapshot: () => Snapshot;
  windowAction: (action: WindowAction) => void;
  devUrl: string | null;
  music: MinecraftMusic;
  musicDirectory: string;
  broadcast: () => void;
}) {
  const { service, snapshot, devUrl } = options;
  let selectingMusic = false;
  ipcMain.handle(channels.music, async (event, action: unknown) => {
    const win = options.window();
    assertTrusted(event, win, devUrl);
    if (!win) throw new Error('Window unavailable');
    if (action !== 'connect' && action !== 'disconnect') throw new Error('Invalid music action');
    if (selectingMusic) return snapshot();
    selectingMusic = true;
    try {
      if (action === 'disconnect') {
        options.music.disconnect();
        if (service.state.settings.ambience === 'minecraft')
          service.dispatch({ type: 'settings', settings: { ambience: 'none' } });
      } else if (!options.music.connect(options.musicDirectory)) {
        const result = await dialog.showOpenDialog(win, {
          properties: ['openDirectory'],
          defaultPath: options.musicDirectory,
        });
        if (result.canceled) return snapshot();
        if (!options.music.connect(result.filePaths[0]))
          throw new Error('Minecraft music not found');
      }
      options.broadcast();
      return snapshot();
    } finally {
      selectingMusic = false;
    }
  });
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
