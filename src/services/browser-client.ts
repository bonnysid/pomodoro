import { PomodoroService } from '../application/pomodoro-service';
import { decodeAction, restoreState } from '../core/model';
import { initialUpdateState } from '../core/updates';
import type { DesktopAPI, Snapshot } from '../shared/contracts';

/** Development preview only. Uses the same application service as Electron. */
export function createBrowserClient(): DesktopAPI {
  const language = navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  let storageError = false,
    raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem('pomodoro-v1') || 'null');
  } catch {
    storageError = true;
  }
  const service = new PomodoroService(
    restoreState(raw, language),
    {
      save: (state) => localStorage.setItem('pomodoro-v1', JSON.stringify(state)),
    },
    Date.now,
    storageError,
  );
  let compact = false;
  const listeners = new Set<(s: Snapshot) => void>();
  const snapshot = (): Snapshot =>
    structuredClone({
      ...service.state,
      appVersion: import.meta.env.VITE_APP_VERSION,
      updates: initialUpdateState('development'),
      platform: 'browser',
      compact,
      storageError: service.storageError,
      suspended: service.suspended,
      newDayAvailable: service.newDayAvailable,
    });
  const emit = () => {
    for (const listener of listeners) listener(snapshot());
  };
  service.onState(emit);
  setInterval(() => service.tick(), 250);
  setInterval(() => service.checkpoint(), 5000);
  window.addEventListener('pagehide', () => service.suspend());
  return {
    update: async () => snapshot(),
    getSnapshot: async () => snapshot(),
    dispatch: async (action) => {
      service.dispatch(decodeAction(action));
      return snapshot();
    },
    onSnapshot: (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    onComplete: (callback) => service.onComplete(callback),
    window: async (action) => {
      if (action === 'compact') compact = true;
      if (action === 'expand') compact = false;
      emit();
    },
  };
}
