export type Language = 'ru' | 'en';
export type Theme = 'midnight' | 'paper' | 'sage';
export type Phase = 'focus' | 'short' | 'long';
export type TimerStatus = 'idle' | 'running' | 'paused';
export interface Settings {
  durations: Record<Phase, number>;
  longBreakEvery: number;
  language: Language;
  theme: Theme;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  notifications: boolean;
  sound: boolean;
  volume: number;
  minimizeToTray: boolean;
  alwaysOnTop: boolean;
  ambience: 'none' | 'white' | 'brown';
  ambientVolume: number;
}
export interface TimerState {
  phase: Phase;
  status: TimerStatus;
  remainingMs: number;
  durationMs: number;
  deadline: number | null;
  completedInCycle: number;
}
export interface FocusRecord {
  id: string;
  endedAt: number;
  durationMs: number;
}
export interface AppState {
  schema: 1;
  settings: Settings;
  timer: TimerState;
  history: FocusRecord[];
  /** Local calendar day of the latest cycle interaction; null in older profiles. */
  cycleDay: string | null;
}
export type Action =
  | { type: 'toggle' | 'reset' | 'skip' | 'reset-cycle' | 'check-new-day' | 'keep-cycle' }
  | { type: 'phase'; phase: Phase }
  | { type: 'settings'; settings: Partial<Settings> };
export interface Completion {
  phase: Phase;
  nextPhase: Phase;
}

export const isPhase = (value: unknown): value is Phase =>
  ['focus', 'short', 'long'].includes(value as string);
const numberIn = (value: unknown, fallback: number, min: number, max: number, integer = false) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max &&
  (!integer || Number.isInteger(value))
    ? value
    : fallback;
export function defaultSettings(language: Language = 'ru'): Settings {
  return {
    durations: { focus: 25, short: 5, long: 15 },
    longBreakEvery: 4,
    language,
    theme: 'midnight',
    autoStartBreaks: false,
    autoStartFocus: false,
    notifications: true,
    sound: true,
    volume: 0.5,
    minimizeToTray: true,
    alwaysOnTop: false,
    ambience: 'none',
    ambientVolume: 0.15,
  };
}
export function normalizeSettings(value: unknown, base = defaultSettings()): Settings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Settings>;
  const bool = (key: keyof Settings) =>
    typeof v[key] === 'boolean' ? (v[key] as boolean) : (base[key] as boolean);
  const durations = v.durations && typeof v.durations === 'object' ? v.durations : base.durations;
  return {
    durations: {
      focus: numberIn(durations.focus, base.durations.focus, 1, 180, true),
      short: numberIn(durations.short, base.durations.short, 1, 180, true),
      long: numberIn(durations.long, base.durations.long, 1, 180, true),
    },
    longBreakEvery: numberIn(v.longBreakEvery, base.longBreakEvery, 2, 8, true),
    language: v.language === 'ru' || v.language === 'en' ? v.language : base.language,
    theme:
      v.theme === 'midnight' || v.theme === 'paper' || v.theme === 'sage' ? v.theme : base.theme,
    autoStartBreaks: bool('autoStartBreaks'),
    autoStartFocus: bool('autoStartFocus'),
    notifications: bool('notifications'),
    sound: bool('sound'),
    minimizeToTray: bool('minimizeToTray'),
    alwaysOnTop: bool('alwaysOnTop'),
    volume: numberIn(v.volume, base.volume, 0, 1),
    ambientVolume: numberIn(v.ambientVolume, base.ambientVolume, 0, 1),
    ambience:
      v.ambience === 'none' || v.ambience === 'white' || v.ambience === 'brown'
        ? v.ambience
        : base.ambience,
  };
}
export function initialState(language: Language = 'ru'): AppState {
  const settings = defaultSettings(language);
  return {
    schema: 1,
    settings,
    timer: {
      phase: 'focus',
      status: 'idle',
      remainingMs: settings.durations.focus * 60000,
      durationMs: settings.durations.focus * 60000,
      deadline: null,
      completedInCycle: 0,
    },
    history: [],
    cycleDay: null,
  };
}
export function restoreState(value: unknown, language: Language = 'ru'): AppState {
  const initial = initialState(language);
  if (!value || typeof value !== 'object' || (value as AppState).schema !== 1) return initial;
  const raw = value as AppState;
  const settings = normalizeSettings(raw.settings, initial.settings);
  const t = raw.timer;
  const phase = t && isPhase(t.phase) ? t.phase : 'focus';
  const durationMs = numberIn(t?.durationMs, settings.durations[phase] * 60000, 60000, 180 * 60000);
  const remainingMs = numberIn(t?.remainingMs, durationMs, 0, durationMs);
  // Time while the application was closed is never credited as focused work.
  const status: TimerStatus = t?.status === 'running' || t?.status === 'paused' ? 'paused' : 'idle';
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter(
          (r) =>
            r &&
            typeof r.id === 'string' &&
            r.id.length <= 100 &&
            Number.isFinite(r.endedAt) &&
            r.endedAt > 0 &&
            Number.isFinite(r.durationMs) &&
            r.durationMs >= 60000 &&
            r.durationMs <= 180 * 60000,
        )
        .slice(-10000)
        .map((r) => ({
          id: r.id,
          endedAt: r.endedAt,
          durationMs: r.durationMs,
        }))
    : [];
  return {
    schema: 1,
    settings,
    timer: {
      phase,
      status,
      remainingMs: remainingMs || durationMs,
      durationMs,
      deadline: null,
      completedInCycle: numberIn(t?.completedInCycle, 0, 0, settings.longBreakEvery, true),
    },
    history,
    cycleDay:
      typeof raw.cycleDay === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.cycleDay) &&
      Number.isFinite(Date.parse(`${raw.cycleDay}T00:00:00`))
        ? raw.cycleDay
        : null,
  };
}
export function decodeAction(value: unknown): Action {
  if (!value || typeof value !== 'object') throw new Error('Invalid action');
  const a = value as Action;
  if (
    a.type === 'toggle' ||
    a.type === 'reset' ||
    a.type === 'skip' ||
    a.type === 'reset-cycle' ||
    a.type === 'check-new-day' ||
    a.type === 'keep-cycle'
  )
    return { type: a.type };
  if (a.type === 'phase' && isPhase(a.phase)) return { type: 'phase', phase: a.phase };
  if (a.type === 'settings' && a.settings && typeof a.settings === 'object')
    return { type: 'settings', settings: a.settings };
  throw new Error('Invalid action');
}
export function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
