import { useMemo } from 'react';
import type { UpdateAction, UpdateState } from '../../core/updates';
import type { Messages } from '../../shared/i18n';
import { releaseNotesText } from './release-notes';

export function UpdatesPanel({
  state,
  running,
  onAction,
  t,
}: {
  state: UpdateState;
  running: boolean;
  onAction: (action: UpdateAction) => void;
  t: Messages;
}) {
  const notes = useMemo(() => releaseNotesText(state.notes), [state.notes]);
  const statusText =
    state.status === 'disabled'
      ? state.unavailableReason === 'mac-signing'
        ? t.updatesMacSigning
        : t.updatesInstalledOnly
      : state.status === 'available'
        ? `${t.updateAvailable} ${state.availableVersion}`
        : state.status === 'downloaded'
          ? `${t.updateReady} ${state.availableVersion}`
          : state.status === 'checking'
            ? t.updateChecking
            : state.status === 'downloading'
              ? `${t.updateDownloading} ${Math.round(state.progress)}%`
              : state.status === 'current'
                ? t.updateCurrent
                : state.status === 'installing'
                  ? t.updateInstalling
                  : state.status === 'error'
                    ? t.updateCheckError
                    : t.updatesHint;
  const canCheck = ['idle', 'current', 'error'].includes(state.status);
  return (
    <section className="update-panel" aria-label={t.updates}>
      <h2>{t.updates}</h2>
      <p className="field-hint" role="status">
        {statusText}
      </p>
      {state.status === 'downloading' && (
        <progress aria-label={t.updateDownloading} value={state.progress} max={100} />
      )}
      {notes && (
        <details className="update-notes">
          <summary>{t.whatsNew}</summary>
          <p>{notes}</p>
        </details>
      )}
      {state.problem && state.problem !== 'check' && (
        <p className="field-hint error" role="alert">
          {state.problem === 'download'
            ? t.updateDownloadError
            : state.problem === 'save'
              ? t.updateSaveError
              : t.updateInstallError}
        </p>
      )}
      {canCheck && (
        <button type="button" className="secondary-button" onClick={() => onAction('check')}>
          {t.checkUpdates}
        </button>
      )}
      {state.status === 'available' && (
        <button type="button" className="primary-button" onClick={() => onAction('download')}>
          {t.downloadUpdate}
        </button>
      )}
      {state.status === 'downloaded' && (
        <>
          <button
            type="button"
            className="primary-button"
            disabled={running}
            onClick={() => onAction('install')}
          >
            {t.installUpdate}
          </button>
          <p className="field-hint">{running ? t.updatePauseFirst : t.updateLaterHint}</p>
        </>
      )}
    </section>
  );
}
