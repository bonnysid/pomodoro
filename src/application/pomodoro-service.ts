import { localDay } from '../core/calendar';
import { TimerEngine } from '../core/engine';
import type { Action, AppState, Completion } from '../core/model';

export interface StateRepository {
  save(state: AppState): void;
}

/** Commands, persistence and events without Electron, browser or React dependencies. */
export class PomodoroService {
  private readonly engine: TimerEngine;
  private readonly stateListeners = new Set<() => void>();
  private readonly completionListeners = new Set<(event: Completion) => void>();
  storageError: boolean;
  suspended = false;
  newDayAvailable = false;
  constructor(
    state: AppState,
    private readonly repository: StateRepository,
    private readonly clock: () => number = Date.now,
    storageError = false,
  ) {
    this.engine = new TimerEngine(state);
    this.storageError = storageError;
  }
  get state(): AppState {
    return this.engine.state;
  }
  onState(listener: () => void) {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }
  onComplete(listener: (event: Completion) => void) {
    this.completionListeners.add(listener);
    return () => {
      this.completionListeners.delete(listener);
    };
  }
  dispatch(action: Action) {
    const now = this.clock();
    if (action.type === 'check-new-day') {
      this.checkNewDay(now);
      this.publish(null);
      return;
    }
    if (action.type === 'keep-cycle') {
      this.state.cycleDay = localDay(now);
      this.newDayAvailable = false;
      this.save();
      this.publish(null);
      return;
    }
    const completed = this.engine.dispatch(action, now);
    if (action.type !== 'settings' || completed) {
      this.state.cycleDay = localDay(now);
      this.newDayAvailable = false;
    }
    this.suspended = false;
    this.save();
    this.publish(completed);
  }
  tick() {
    const now = this.clock();
    const completed = this.engine.tick(now);
    if (completed) {
      this.state.cycleDay = localDay(now);
      this.newDayAvailable = false;
      this.save();
    }
    this.publish(completed);
  }
  suspend() {
    this.suspended = this.state.timer.status === 'running';
    const completed = this.engine.suspend(this.clock());
    this.save();
    this.publish(completed);
  }
  checkpoint() {
    if (this.state.timer.status === 'running' || this.storageError) this.save();
  }
  private checkNewDay(now: number) {
    const today = localDay(now);
    const { timer, history } = this.state;
    // Older profiles have no day marker. Infer it only from actual completed work.
    if (this.state.cycleDay === null) {
      const latest = history.reduce((endedAt, record) => Math.max(endedAt, record.endedAt), 0);
      this.state.cycleDay = localDay(latest || now);
      this.save();
    }
    if (this.state.cycleDay >= today || timer.status === 'running') return;
    const hasProgress =
      timer.completedInCycle > 0 ||
      timer.phase !== 'focus' ||
      timer.status !== 'idle' ||
      timer.remainingMs < timer.durationMs;
    if (hasProgress) this.newDayAvailable = true;
    else {
      this.state.cycleDay = today;
      this.save();
    }
  }
  private save() {
    try {
      this.repository.save(this.engine.persisted());
      this.storageError = false;
    } catch (error) {
      this.storageError = true;
      console.error('Unable to save Pomodoro state:', error);
    }
  }
  private publish(completed: Completion | null) {
    for (const listener of this.stateListeners) listener();
    if (completed) for (const listener of this.completionListeners) listener(completed);
  }
}
