import { Moon, Music2, Volume2 } from 'lucide-react';
import type { Settings } from '../../core/model';
import { audio } from '../../services/audio';
import type { Messages } from '../../shared/i18n';
import { Toggle } from '../../shared/ui/Toggle';

type UpdateSettings = (patch: Partial<Settings>) => void;
export function SoundsPanel({
  settings,
  update,
  t,
}: {
  settings: Settings;
  update: UpdateSettings;
  t: Messages;
}) {
  return (
    <>
      <div className="sound-options">
        {(['none', 'white', 'brown'] as const).map((kind) => (
          <button
            type="button"
            key={kind}
            className={settings.ambience === kind ? 'selected' : ''}
            aria-pressed={settings.ambience === kind}
            onClick={() => update({ ambience: kind })}
          >
            <span>
              {kind === 'none' ? <Moon size={18} /> : <Music2 size={18} />}
              {kind === 'none' ? t.noSound : t[kind]}
            </span>
            <span className="radio-mark">{settings.ambience === kind && <span />}</span>
          </button>
        ))}
      </div>
      <p className="field-hint">{t.ambienceHint}</p>
      <label className="range-field">
        <span>
          {t.volume}
          <small>{Math.round(settings.ambientVolume * 100)}%</small>
        </span>
        <input
          aria-label={t.volume}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.ambientVolume}
          onChange={(e) => update({ ambientVolume: Number(e.target.value) })}
        />
      </label>
      <section className="settings-section">
        <h2>{t.sound}</h2>
        <Toggle label={t.sound} checked={settings.sound} onChange={(v) => update({ sound: v })} />
        <label className="range-field">
          <span>
            {t.volume}
            <small>{Math.round(settings.volume * 100)}%</small>
          </span>
          <input
            aria-label={`${t.sound}: ${t.volume}`}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            void audio.unlock().then(() => audio.chime(settings.volume));
          }}
        >
          <Volume2 size={15} />
          {t.previewSound}
        </button>
      </section>
    </>
  );
}
