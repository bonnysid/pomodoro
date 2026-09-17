import { Pause, Play } from 'lucide-react';
import type { TimerStatus } from '../../core/model';
import type { Messages } from '../../shared/i18n';

export function PlayButton({
  status,
  onToggle,
  t,
}: {
  status: TimerStatus;
  onToggle: () => void;
  t: Messages;
}) {
  const label = status === 'running' ? t.pause : status === 'paused' ? t.resume : t.start;
  return (
    <button
      type="button"
      className="play-button"
      aria-label={label}
      title={`${label} · Space`}
      onClick={onToggle}
    >
      {status === 'running' ? (
        <Pause size={24} fill="currentColor" />
      ) : (
        <Play size={24} fill="currentColor" />
      )}
    </button>
  );
}
