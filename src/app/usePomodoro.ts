import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, Settings } from '../core/model';
import { formatTime } from '../core/model';
import type { UpdateAction } from '../core/updates';
import { getAPI } from '../services/api';
import { audio } from '../services/audio';
import type { Snapshot, WindowAction } from '../shared/contracts';

export type Panel = 'settings' | 'stats' | 'sounds' | 'resetCycle' | null;
const api = getAPI();

export function usePomodoro() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState(false);
  const latest = useRef(snapshot);
  useEffect(() => {
    let alive = true;
    const receive = (state: Snapshot) => {
      latest.current = state;
      if (alive) setSnapshot(state);
    };
    const unsubscribe = api.onSnapshot(receive);
    const checkDay = () => {
      if (document.visibilityState === 'hidden') return;
      void api
        .dispatch({ type: 'check-new-day' })
        .then(receive)
        .catch(() => {
          if (alive) setError(true);
        });
    };
    void api
      .getSnapshot()
      .then(receive)
      .catch(() => {
        if (alive) setError(true);
      });
    checkDay();
    window.addEventListener('focus', checkDay);
    document.addEventListener('visibilitychange', checkDay);
    const offComplete = api.onComplete(() => {
      const s = latest.current;
      if (s?.settings.sound) audio.chime(s.settings.volume);
    });
    return () => {
      alive = false;
      unsubscribe();
      offComplete();
      window.removeEventListener('focus', checkDay);
      document.removeEventListener('visibilitychange', checkDay);
    };
  }, []);
  const dispatch = useCallback((action: Action) => {
    void audio.unlock().then(() => {
      const s = latest.current;
      if (s) audio.ambience(s.settings, s.timer.status === 'running' && s.timer.phase === 'focus');
    });
    void api
      .dispatch(action)
      .then((state) => {
        latest.current = state;
        setSnapshot(state);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);
  const windowAction = (action: WindowAction) => {
    setPanel(null);
    void api.window(action).catch(() => setError(true));
  };
  const update = (settings: Partial<Settings>) => dispatch({ type: 'settings', settings });
  const updateApp = (action: UpdateAction) => {
    void api
      .update(action)
      .then((state) => {
        latest.current = state;
        setSnapshot(state);
        setError(false);
      })
      .catch(() => setError(true));
  };
  useEffect(() => {
    if (!snapshot) return;
    document.documentElement.lang = snapshot.settings.language;
    document.documentElement.dataset.theme = snapshot.settings.theme;
    document.title = `${formatTime(snapshot.timer.remainingMs)} · Pomodoro`;
    audio.ambience(
      snapshot.settings,
      snapshot.timer.status === 'running' && snapshot.timer.phase === 'focus',
    );
  }, [snapshot]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        panel ||
        (latest.current?.newDayAvailable && !latest.current.compact) ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      )
        return;
      if (event.code === 'Space' && !(event.target instanceof HTMLButtonElement) && !event.repeat) {
        event.preventDefault();
        dispatch({ type: 'toggle' });
      }
      if (event.code === 'KeyR' && !event.ctrlKey && !event.metaKey && !event.repeat)
        dispatch({ type: 'reset' });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, panel]);
  return { snapshot, panel, setPanel, error, dispatch, windowAction, update, updateApp };
}
