import { Moon, Music2, Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Ambience, Settings } from '../../core/model';
import { getAPI } from '../../services/api';
import { audio } from '../../services/audio';
import type { MusicTrack } from '../../shared/contracts';
import type { Messages } from '../../shared/i18n';
import { Toggle } from '../../shared/ui/Toggle';

type UpdateSettings = (patch: Partial<Settings>) => void;
export function SoundsPanel({
  settings,
  update,
  t,
  minecraftTracks,
}: {
  settings: Settings;
  update: UpdateSettings;
  t: Messages;
  minecraftTracks: MusicTrack[];
}) {
  const [preview, setPreview] = useState<Ambience | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [libraryError, setLibraryError] = useState(false);
  const [musicError, setMusicError] = useState(false);
  useEffect(() => audio.onMusicError(setMusicError), []);
  const connectMusic = async (action: 'connect' | 'disconnect') => {
    setConnecting(true);
    setLibraryError(false);
    audio.stopPreview();
    try {
      await getAPI().music(action);
    } catch {
      setLibraryError(true);
    } finally {
      setConnecting(false);
    }
  };
  useEffect(() => {
    const unsubscribe = audio.onPreview(setPreview);
    return () => {
      unsubscribe();
      audio.stopPreview();
    };
  }, []);
  return (
    <>
      <div className="sound-options">
        {(['none', 'white', 'brown', 'lofi', 'worlds', 'minecraft'] as const).map((kind) => (
          <div className="sound-option" key={kind}>
            <button
              type="button"
              className={settings.ambience === kind ? 'selected' : ''}
              aria-pressed={settings.ambience === kind}
              disabled={kind === 'minecraft' && !minecraftTracks.length}
              onClick={() => {
                audio.stopPreview();
                update({ ambience: kind });
              }}
            >
              <span>
                {kind === 'none' ? <Moon size={18} /> : <Music2 size={18} />}
                {kind === 'none' ? t.noSound : t[kind]}
              </span>
              <span className="radio-mark">{settings.ambience === kind && <span />}</span>
            </button>
            {kind !== 'none' && (
              <button
                type="button"
                className="sound-preview"
                aria-label={`${preview === kind ? t.stopPreview : t.previewAmbience}: ${t[kind]}`}
                aria-pressed={preview === kind}
                disabled={kind === 'minecraft' && !minecraftTracks.length}
                onClick={() => {
                  if (preview === kind) audio.stopPreview();
                  else void audio.preview(kind, settings);
                }}
              >
                {preview === kind ? <Square size={15} /> : <Play size={15} />}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="minecraft-library">
        <p className="field-hint">
          {minecraftTracks.length
            ? `${t.minecraftConnected}: ${minecraftTracks.length} · ${t.minecraftLoop}`
            : t.minecraftHint}
        </p>
        {minecraftTracks.length > 0 && (
          <details>
            <summary>{t.minecraftTrackList}</summary>
            <p className="field-hint">{minecraftTracks.map((track) => track.title).join(' · ')}</p>
          </details>
        )}
        <button
          className="secondary-button"
          type="button"
          disabled={connecting}
          onClick={() => void connectMusic(minecraftTracks.length ? 'disconnect' : 'connect')}
        >
          {connecting
            ? t.minecraftConnecting
            : minecraftTracks.length
              ? t.minecraftDisconnect
              : t.minecraftConnect}
        </button>
        {(libraryError || musicError) && (
          <p className="field-hint error" role="alert">
            {t.minecraftError}
          </p>
        )}
      </div>
      <p className="field-hint">{t.ambienceHint}</p>
      <p className="field-hint">{t.originalMusicHint}</p>
      <Toggle
        label={t.ambientAlways}
        checked={settings.ambientAlways}
        onChange={(value) => update({ ambientAlways: value })}
      />
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
