import path from 'node:path';
import { app, BrowserWindow, type Rectangle, screen } from 'electron';
import type { Settings } from '../src/core/model';
import type { WindowAction } from '../src/shared/contracts';

export class AppWindow {
  window: BrowserWindow | null = null;
  compact = false;
  quitting = false;
  private normalBounds: Rectangle | null = null;
  private completionTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private readonly options: {
      appPath: string;
      devUrl: string | null;
      testMode: boolean;
      settings: () => Settings;
      hasTray: () => boolean;
      changed: () => void;
      checkpoint: () => void;
    },
  ) {}
  create() {
    const settings = this.options.settings();
    const win = new BrowserWindow({
      width: 500,
      height: 650,
      minWidth: 360,
      minHeight: 600,
      show: false,
      frame: false,
      ...(process.platform === 'darwin'
        ? {
            titleBarStyle: 'hidden' as const,
            trafficLightPosition: { x: 18, y: 16 },
          }
        : {}),
      backgroundColor: settings.theme === 'midnight' ? '#111216' : '#F6F2EB',
      title: 'Pomodoro',
      icon: path.join(this.options.appPath, 'assets/icon.png'),
      alwaysOnTop: settings.alwaysOnTop,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        spellcheck: false,
      },
    });
    this.window = win;
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.on('ready-to-show', () => {
      if (!this.options.testMode) win.show();
    });
    win.on('close', (event) => {
      if (!this.quitting && this.options.settings().minimizeToTray && this.options.hasTray()) {
        event.preventDefault();
        win.hide();
        this.options.checkpoint();
      }
    });
    win.on('closed', () => {
      clearTimeout(this.completionTimer);
      this.completionTimer = undefined;
      this.window = null;
      this.compact = false;
      if (!this.quitting) app.quit();
    });
    win.on('hide', () => this.clearCompletionAttention());
    win.on('minimize', () => this.clearCompletionAttention());
    void win.loadURL(this.options.devUrl || 'pomodoro://app/index.html');
  }
  show = () => {
    if (!this.window || this.window.isDestroyed()) this.create();
    if (this.window?.isMinimized()) this.window.restore();
    this.window?.show();
    this.window?.focus();
  };
  showOnCompletion() {
    const win = this.window;
    if (this.quitting || !this.options.settings().showOnCompletion || !win || win.isDestroyed())
      return;
    clearTimeout(this.completionTimer);
    // Briefly raise the window, then restore the user's separate pin preference.
    this.completionTimer = setTimeout(() => this.clearCompletionAttention(), 2000);
    this.completionTimer.unref();
    this.applySettings();
    this.show();
    win.moveTop();
    if (process.platform === 'darwin') app.focus({ steal: true });
    win.focus();
  }
  private clearCompletionAttention() {
    clearTimeout(this.completionTimer);
    this.completionTimer = undefined;
    this.applySettings();
  }
  send(channel: string, value: unknown) {
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send(channel, value);
  }
  applySettings() {
    const settings = this.options.settings();
    if (!settings.showOnCompletion && this.completionTimer) {
      clearTimeout(this.completionTimer);
      this.completionTimer = undefined;
    }
    const pinned = settings.alwaysOnTop || this.completionTimer !== undefined;
    if (this.window && !this.window.isDestroyed() && this.window.isAlwaysOnTop() !== pinned)
      this.window.setAlwaysOnTop(pinned);
  }
  action(action: WindowAction) {
    if (action === 'minimize') this.window?.minimize();
    else if (action === 'close') this.window?.close();
    else this.setCompact(action === 'compact');
  }
  private setCompact(value: boolean) {
    const win = this.window;
    if (!win || this.compact === value) return;
    this.compact = value;
    if (value) {
      this.normalBounds = win.getBounds();
      win.setMinimumSize(280, 88);
      win.setResizable(false);
      const area = screen.getDisplayMatching(this.normalBounds).workArea;
      win.setBounds({
        x: Math.min(this.normalBounds.x, area.x + area.width - 300),
        y: Math.min(this.normalBounds.y, area.y + area.height - 88),
        width: 300,
        height: 88,
      });
    } else {
      win.setResizable(true);
      win.setMinimumSize(360, 600);
      if (this.normalBounds) win.setBounds(this.normalBounds);
    }
    if (process.platform === 'darwin') win.setWindowButtonVisibility(!value);
    this.options.changed();
  }
}
