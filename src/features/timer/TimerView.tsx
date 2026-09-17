import {
  BarChart3,
  Bell,
  BellOff,
  ChevronRight,
  Music2,
  RotateCcw,
  Settings2,
  SkipForward,
} from 'lucide-react';
import { type Action, formatTime, type Phase, type Settings } from '../../core/model';
import type { Snapshot } from '../../shared/contracts';
import { messages } from '../../shared/i18n';
import { IconButton } from '../../shared/ui/IconButton';
import { PlayButton } from './PlayButton';
export function TimerView({
  snapshot,
  dispatch,
  update,
  onOpenSettings,
  onOpenStats,
  onOpenSounds,
  onResetCycle,
}: {
  snapshot: Snapshot;
  dispatch: (action: Action) => void;
  update: (patch: Partial<Settings>) => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  onOpenSounds: () => void;
  onResetCycle: () => void;
}) {
  const { timer, settings } = snapshot,
    t = messages[settings.language];
  const focus = timer.phase === 'focus';
  const sessionNumber = Math.min(timer.completedInCycle + 1, settings.longBreakEvery);
  const ratio = Math.max(0, Math.min(1, timer.remainingMs / timer.durationMs));
  const nextPhase: Phase = focus
    ? timer.completedInCycle + 1 >= settings.longBreakEvery
      ? 'long'
      : 'short'
    : 'focus';
  return (
    <div className="timer-layout">
      <div className="top-tools">
        <div className="tool-stack">
          <IconButton label={t.settings} onClick={() => onOpenSettings()}>
            <Settings2 size={18} />
          </IconButton>
          <IconButton label={t.stats} onClick={() => onOpenStats()}>
            <BarChart3 size={18} />
          </IconButton>
        </div>
        <div className="phase-tabs">
          <button
            type="button"
            className={focus ? 'selected' : ''}
            aria-pressed={focus}
            onClick={() => dispatch({ type: 'phase', phase: 'focus' })}
          >
            {t.focus}
          </button>
          <button
            type="button"
            className={!focus ? 'selected' : ''}
            aria-pressed={!focus}
            onClick={() => dispatch({ type: 'phase', phase: focus ? 'short' : timer.phase })}
          >
            {t.break}
          </button>
        </div>
        <div className="tool-stack">
          <IconButton
            label={t.notifications}
            active={settings.notifications}
            onClick={() => update({ notifications: !settings.notifications })}
          >
            {settings.notifications ? <Bell size={18} /> : <BellOff size={18} />}
          </IconButton>
          <IconButton
            label={t.sounds}
            active={settings.ambience !== 'none'}
            onClick={() => onOpenSounds()}
          >
            <Music2 size={18} />
          </IconButton>
        </div>
      </div>
      <div className={`break-tabs ${focus ? 'invisible' : ''}`} aria-hidden={focus}>
        {!focus && (
          <>
            <button
              type="button"
              className={timer.phase === 'short' ? 'selected' : ''}
              aria-pressed={timer.phase === 'short'}
              onClick={() => dispatch({ type: 'phase', phase: 'short' })}
            >
              {t.shortTab}
            </button>
            <span>·</span>
            <button
              type="button"
              className={timer.phase === 'long' ? 'selected' : ''}
              aria-pressed={timer.phase === 'long'}
              onClick={() => dispatch({ type: 'phase', phase: 'long' })}
            >
              {t.longTab}
            </button>
          </>
        )}
      </div>
      <div className="clock-face">
        <div className="clock-glow" />
        <svg className="clock-ring" viewBox="0 0 300 300" aria-hidden="true">
          <circle className="ring-track" cx="150" cy="150" r="132" />
          <circle
            className="ring-value"
            cx="150"
            cy="150"
            r="132"
            strokeDasharray={`${ratio * 2 * Math.PI * 132} ${2 * Math.PI * 132}`}
            transform="rotate(-90 150 150)"
          />
          {ratio > 0 && (
            <circle
              className="ring-tip"
              cx={150 + Math.sin(ratio * 2 * Math.PI) * 132}
              cy={150 - Math.cos(ratio * 2 * Math.PI) * 132}
              r="5"
            />
          )}
        </svg>
        <div className="clock-content">
          <div className="time" role="timer" aria-label={t[timer.phase]}>
            {formatTime(timer.remainingMs)}
          </div>
          <div className="phase-label">{t[`${timer.phase}Label`]}</div>
          {timer.status === 'paused' && <span className="paused-label">{t.pause}</span>}
        </div>
      </div>
      <div className="cycle">
        <div className="cycle-dots" aria-hidden="true">
          {Array.from({ length: settings.longBreakEvery }, (_, index) => index + 1).map(
            (session) => (
              <span
                key={session}
                className={
                  session <= timer.completedInCycle
                    ? 'done'
                    : focus && session === timer.completedInCycle + 1
                      ? 'current'
                      : ''
                }
              />
            ),
          )}
        </div>
        <span>
          {focus
            ? `${t.session} ${sessionNumber} ${t.of} ${settings.longBreakEvery}`
            : `${t.completedCycle} ${timer.completedInCycle} ${t.of} ${settings.longBreakEvery}`}
        </span>
        <button type="button" className="cycle-reset" title={t.resetCycle} onClick={onResetCycle}>
          <RotateCcw size={12} aria-hidden="true" />
          {t.firstSession}
        </button>
      </div>
      <div className="timer-actions">
        <IconButton label={t.reset} onClick={() => dispatch({ type: 'reset' })}>
          <RotateCcw size={19} />
        </IconButton>
        <PlayButton status={timer.status} t={t} onToggle={() => dispatch({ type: 'toggle' })} />
        <IconButton label={t.skip} onClick={() => dispatch({ type: 'skip' })}>
          <SkipForward size={19} />
        </IconButton>
      </div>
      <div className="next-phase">
        {t.next}: {t[nextPhase].toLocaleLowerCase(settings.language)} <span>·</span>{' '}
        {settings.durations[nextPhase]} {t.min}
      </div>
      <footer className="timer-footer">
        <button type="button" className="preset-link" onClick={() => onOpenSettings()}>
          {settings.durations.focus} <span>/</span> {settings.durations.short} <span>/</span>{' '}
          {settings.durations.long}
          <ChevronRight size={12} />
        </button>
        <span>{t.keyHint}</span>
      </footer>
    </div>
  );
}
