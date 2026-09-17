import { Minimize2, Minus, X } from 'lucide-react';
import type { Snapshot, WindowAction } from '../shared/contracts';
import type { Messages } from '../shared/i18n';
import { IconButton } from '../shared/ui/IconButton';

export function TitleBar({
  platform,
  t,
  onAction,
}: {
  platform: Snapshot['platform'];
  t: Messages;
  onAction: (action: WindowAction) => void;
}) {
  return (
    <header className="titlebar">
      <span className="wordmark">
        <span className="wordmark-dot" />
        pomodoro
      </span>
      <div className="window-actions">
        <IconButton label={t.compact} onClick={() => onAction('compact')}>
          <Minimize2 size={13} />
        </IconButton>
        {platform !== 'darwin' && platform !== 'browser' && (
          <>
            <IconButton label={t.minimize} onClick={() => onAction('minimize')}>
              <Minus size={15} />
            </IconButton>
            <IconButton className="close-window" label={t.close} onClick={() => onAction('close')}>
              <X size={15} />
            </IconButton>
          </>
        )}
      </div>
    </header>
  );
}
