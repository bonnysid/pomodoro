import { Expand, Pin, PinOff } from 'lucide-react';
import { formatTime } from '../../core/model';
import type { Snapshot } from '../../shared/contracts';
import { messages } from '../../shared/i18n';
import { IconButton } from '../../shared/ui/IconButton';
import { PlayButton } from './PlayButton';

export function MiniTimer({
  snapshot,
  onExpand,
  onPin,
  onToggle,
}: {
  snapshot: Snapshot;
  onExpand: () => void;
  onPin: () => void;
  onToggle: () => void;
}) {
  const { timer, settings } = snapshot,
    t = messages[settings.language];
  const count =
    timer.phase === 'focus'
      ? Math.min(timer.completedInCycle + 1, settings.longBreakEvery)
      : timer.completedInCycle;
  return (
    <div className="mini-layout">
      <div className="mini-tools">
        <IconButton label={t.expand} onClick={onExpand}>
          <Expand size={15} />
        </IconButton>
        <IconButton
          label={settings.alwaysOnTop ? t.unpin : t.pin}
          active={settings.alwaysOnTop}
          onClick={onPin}
        >
          {settings.alwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
        </IconButton>
      </div>
      <div className="mini-timer">
        <span>{formatTime(timer.remainingMs)}</span>
        <small>
          {t[timer.phase]} · {count}/{settings.longBreakEvery}
        </small>
      </div>
      <PlayButton status={timer.status} t={t} onToggle={onToggle} />
    </div>
  );
}
