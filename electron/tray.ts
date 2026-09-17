import path from 'node:path';
import { Menu, nativeImage, Tray } from 'electron';
import type { Action, AppState } from '../src/core/model';
import { formatTime } from '../src/core/model';
import { messages, phaseName } from '../src/shared/i18n';

export class AppTray {
  private tray: Tray;
  private lastKey = '';
  constructor(
    appPath: string,
    private readonly actions: {
      show: () => void;
      quit: () => void;
      dispatch: (action: Action) => void;
    },
  ) {
    const image = nativeImage.createFromPath(
      path.join(appPath, 'assets', process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'),
    );
    if (process.platform === 'darwin') image.setTemplateImage(true);
    this.tray = new Tray(image);
    this.tray.on('double-click', actions.show);
    this.tray.on('click', () => {
      if (process.platform !== 'darwin') actions.show();
    });
  }
  update({ timer, settings }: AppState) {
    const t = messages[settings.language],
      time = formatTime(timer.remainingMs);
    const key = `${time}/${timer.status}/${timer.phase}/${settings.language}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.tray.setToolTip(`Pomodoro · ${phaseName(timer.phase, settings.language)} · ${time}`);
    if (process.platform === 'darwin') this.tray.setTitle(timer.status === 'idle' ? '' : time);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: `${phaseName(timer.phase, settings.language)} · ${time}`,
          enabled: false,
        },
        { type: 'separator' },
        { label: t.show, click: this.actions.show },
        {
          label:
            timer.status === 'running' ? t.pause : timer.status === 'paused' ? t.resume : t.start,
          click: () => this.actions.dispatch({ type: 'toggle' }),
        },
        {
          label: t.reset,
          click: () => this.actions.dispatch({ type: 'reset' }),
        },
        { type: 'separator' },
        { label: t.quit, click: this.actions.quit },
      ]),
    );
  }
  dispose() {
    this.tray.destroy();
  }
}
