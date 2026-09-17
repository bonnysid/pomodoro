import type { Action, AppState, Completion } from '../core/model';
import type { UpdateAction, UpdateState } from '../core/updates';

export type WindowAction = 'minimize' | 'close' | 'compact' | 'expand';
export interface Snapshot extends AppState {
  appVersion: string;
  updates: UpdateState;
  platform: 'win32' | 'darwin' | 'linux' | 'browser';
  compact: boolean;
  storageError: boolean;
  suspended: boolean;
  newDayAvailable: boolean;
}
export interface DesktopAPI {
  getSnapshot(): Promise<Snapshot>;
  dispatch(action: Action): Promise<Snapshot>;
  onSnapshot(callback: (snapshot: Snapshot) => void): () => void;
  onComplete(callback: (completion: Completion) => void): () => void;
  window(action: WindowAction): Promise<void>;
  update(action: UpdateAction): Promise<Snapshot>;
}
export const channels = {
  get: 'pomodoro:get',
  action: 'pomodoro:action',
  state: 'pomodoro:state',
  complete: 'pomodoro:complete',
  window: 'pomodoro:window',
  update: 'pomodoro:update',
} as const;
