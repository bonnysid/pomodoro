import { contextBridge, ipcRenderer } from 'electron';
import type { Action, Completion } from '../src/core/model';
import type { DesktopAPI, Snapshot } from '../src/shared/contracts';

const api: DesktopAPI = {
  getSnapshot: () => ipcRenderer.invoke('pomodoro:get'),
  dispatch: (action: Action) => ipcRenderer.invoke('pomodoro:action', action),
  onSnapshot: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: Snapshot) => callback(snapshot);
    ipcRenderer.on('pomodoro:state', listener);
    return () => ipcRenderer.removeListener('pomodoro:state', listener);
  },
  onComplete: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, completion: Completion) =>
      callback(completion);
    ipcRenderer.on('pomodoro:complete', listener);
    return () => ipcRenderer.removeListener('pomodoro:complete', listener);
  },
  window: (action) => ipcRenderer.invoke('pomodoro:window', action),
  update: (action) => ipcRenderer.invoke('pomodoro:update', action),
};
contextBridge.exposeInMainWorld('pomodoro', api);
