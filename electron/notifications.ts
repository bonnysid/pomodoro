import path from 'node:path';
import { Notification } from 'electron';
import type { Completion, Settings } from '../src/core/model';
import { messages, phaseName } from '../src/shared/i18n';

export function notifyCompletion(
  event: Completion,
  settings: Settings,
  appPath: string,
  show: () => void,
) {
  if (!settings.notifications || !Notification.isSupported()) return;
  const t = messages[settings.language];
  const notification = new Notification({
    title: event.phase === 'focus' ? t.focusFinished : t.breakFinished,
    body: `${event.phase === 'focus' ? t.timeForBreak : t.timeForFocus} ${phaseName(event.nextPhase, settings.language)} · ${settings.durations[event.nextPhase]} ${t.min}`,
    silent: true,
    icon: path.join(appPath, 'assets/icon.png'),
  });
  notification.on('click', show);
  notification.show();
}
