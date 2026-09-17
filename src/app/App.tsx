import { SettingsPanel } from '../features/settings/SettingsPanel';
import { SoundsPanel } from '../features/sounds/SoundsPanel';
import { StatsPanel } from '../features/statistics/StatsPanel';
import { MiniTimer } from '../features/timer/MiniTimer';
import { TimerView } from '../features/timer/TimerView';
import { messages } from '../shared/i18n';
import { Modal } from '../shared/ui/Modal';
import { TitleBar } from './TitleBar';
import { usePomodoro } from './usePomodoro';

export function App() {
  const { snapshot, panel, setPanel, error, dispatch, windowAction, update, updateApp } =
    usePomodoro();
  if (!snapshot)
    return (
      <main className="loading">
        {error ? 'Не удалось открыть Pomodoro / Could not open Pomodoro' : 'pomodoro'}
      </main>
    );
  const { timer, settings, compact } = snapshot,
    t = messages[settings.language];
  const newDay = !panel && !compact && snapshot.newDayAvailable;
  const closePanel = () => {
    if (newDay) dispatch({ type: 'keep-cycle' });
    else setPanel(null);
  };
  return (
    <main
      className={`app ${compact ? 'compact' : ''} platform-${snapshot.platform}`}
      data-phase={timer.phase}
    >
      {compact ? (
        <MiniTimer
          snapshot={snapshot}
          onExpand={() => windowAction('expand')}
          onToggle={() => dispatch({ type: 'toggle' })}
          onPin={() => update({ alwaysOnTop: !settings.alwaysOnTop })}
        />
      ) : (
        <>
          <TitleBar platform={snapshot.platform} t={t} onAction={windowAction} />
          <TimerView
            snapshot={snapshot}
            dispatch={dispatch}
            update={update}
            onOpenSettings={() => setPanel('settings')}
            onOpenStats={() => setPanel('stats')}
            onOpenSounds={() => setPanel('sounds')}
            onResetCycle={() => setPanel('resetCycle')}
          />
        </>
      )}
      {(snapshot.storageError || error || snapshot.suspended) && !compact && (
        <div className="status-banner" role="status">
          {snapshot.storageError ? t.storageError : error ? t.operationError : t.pausedSleep}
        </div>
      )}
      {(panel || newDay) && (
        <Modal
          title={
            newDay
              ? t.newDayTitle
              : panel === 'resetCycle'
                ? t.resetCycleTitle
                : panel
                  ? t[panel]
                  : ''
          }
          close={closePanel}
          closeLabel={t.close}
        >
          {panel === 'settings' && (
            <SettingsPanel
              settings={settings}
              appVersion={snapshot.appVersion}
              updates={snapshot.updates}
              running={timer.status === 'running'}
              onUpdateApp={updateApp}
              update={update}
              t={t}
            />
          )}
          {panel === 'stats' && <StatsPanel snapshot={snapshot} t={t} />}
          {panel === 'sounds' && <SoundsPanel settings={settings} update={update} t={t} />}
          {(panel === 'resetCycle' || newDay) && (
            <>
              <p className="reset-cycle-description">
                {newDay ? t.newDayDescription : t.resetCycleDescription}
              </p>
              <div className="confirmation-actions">
                <button type="button" className="secondary-button" onClick={closePanel}>
                  {newDay ? t.keepCycle : t.cancel}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    dispatch({ type: 'reset-cycle' });
                    setPanel(null);
                  }}
                >
                  {t.firstSession}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}
