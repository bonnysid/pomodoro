import { Check, Coffee, Leaf, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Settings } from '../../core/model';
import type { UpdateAction, UpdateState } from '../../core/updates';
import type { Messages } from '../../shared/i18n';
import { Toggle } from '../../shared/ui/Toggle';
import { UpdatesPanel } from '../updates/UpdatesPanel';

type UpdateSettings = (patch: Partial<Settings>) => void;
export function SettingsPanel({
  settings,
  appVersion,
  updates,
  running,
  onUpdateApp,
  update,
  t,
}: {
  settings: Settings;
  appVersion: string;
  updates: UpdateState;
  running: boolean;
  onUpdateApp: (action: UpdateAction) => void;
  update: UpdateSettings;
  t: Messages;
}) {
  const [durations, setDurations] = useState([
    String(settings.durations.focus),
    String(settings.durations.short),
    String(settings.durations.long),
  ]);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDurations([
      String(settings.durations.focus),
      String(settings.durations.short),
      String(settings.durations.long),
    ]);
  }, [settings.durations.focus, settings.durations.short, settings.durations.long]);
  function commit() {
    const values = durations.map(Number);
    if (values.some((n) => !Number.isInteger(n) || n < 1 || n > 180)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    update({
      durations: { focus: values[0], short: values[1], long: values[2] },
    });
  }
  const current = Object.values(settings.durations).join('/');
  return (
    <>
      <section className="settings-section">
        <h2>{t.rhythm}</h2>
        <div className="preset-options">
          {[
            [25, 5, 15],
            [50, 10, 30],
          ].map((p) => (
            <button
              type="button"
              key={p[0]}
              className={current === p.join('/') ? 'selected' : ''}
              aria-pressed={current === p.join('/')}
              onClick={() => {
                setInvalid(false);
                update({ durations: { focus: p[0], short: p[1], long: p[2] } });
              }}
            >
              <span>{p.join(' / ')}</span>
              {current === p.join('/') && <Check size={14} />}
            </button>
          ))}
        </div>
        <div className="duration-fields">
          {[t.workMinutes, t.shortMinutes, t.longMinutes].map((label, i) => (
            <label key={label}>
              <span>{label}</span>
              <input
                aria-label={label}
                type="number"
                min="1"
                max="180"
                step="1"
                value={durations[i]}
                onChange={(e) =>
                  setDurations((d) => d.map((v, j) => (j === i ? e.target.value : v)))
                }
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
            </label>
          ))}
        </div>
        <p className={`field-hint ${invalid ? 'error' : ''}`} role={invalid ? 'alert' : undefined}>
          {invalid ? t.invalidMinutes : t.minutesHint}
        </p>
        <label className="select-row">
          <span>{t.every}</span>
          <select
            value={settings.longBreakEvery}
            onChange={(e) => update({ longBreakEvery: Number(e.target.value) })}
          >
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <p className="field-hint">
          {t.timerChangeHint} {t.cycleChangeHint}
        </p>
      </section>
      <section className="settings-section">
        <h2>{t.theme}</h2>
        <div className="theme-options">
          {(
            [
              { theme: 'midnight', name: 'Midnight', icon: <Moon size={15} /> },
              { theme: 'paper', name: 'Paper', icon: <Coffee size={15} /> },
              { theme: 'sage', name: 'Sage', icon: <Leaf size={15} /> },
            ] as const
          ).map((item) => (
            <button
              type="button"
              key={item.theme}
              className={`theme-option theme-${item.theme} ${settings.theme === item.theme ? 'selected' : ''}`}
              aria-pressed={settings.theme === item.theme}
              onClick={() => update({ theme: item.theme })}
            >
              <span className="theme-swatch">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </div>
        <label className="select-row">
          <span>{t.language}</span>
          <select
            value={settings.language}
            onChange={(e) => update({ language: e.target.value as Settings['language'] })}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>
      <section className="settings-section">
        <h2>{t.behavior}</h2>
        <Toggle
          label={t.autoBreaks}
          checked={settings.autoStartBreaks}
          onChange={(v) => update({ autoStartBreaks: v })}
        />
        <Toggle
          label={t.autoFocus}
          checked={settings.autoStartFocus}
          onChange={(v) => update({ autoStartFocus: v })}
        />
        <Toggle
          label={t.minimizeToTray}
          checked={settings.minimizeToTray}
          onChange={(v) => update({ minimizeToTray: v })}
        />
        <Toggle
          label={t.alwaysOnTop}
          checked={settings.alwaysOnTop}
          onChange={(v) => update({ alwaysOnTop: v })}
        />
        <Toggle
          label={t.notifications}
          checked={settings.notifications}
          onChange={(v) => update({ notifications: v })}
        />
        <Toggle
          label={t.showOnCompletion}
          checked={settings.showOnCompletion}
          onChange={(v) => update({ showOnCompletion: v })}
        />
        <p className="field-hint">{t.showOnCompletionHint}</p>
        <Toggle label={t.sound} checked={settings.sound} onChange={(v) => update({ sound: v })} />
      </section>
      <p className="saved-note">
        <Check size={13} />
        {t.saved}
      </p>
      <section className="app-info" aria-label={t.aboutApp}>
        <span>Pomodoro</span>
        <span>
          {t.version} {appVersion}
        </span>
      </section>
      <UpdatesPanel state={updates} running={running} onAction={onUpdateApp} t={t} />
    </>
  );
}
