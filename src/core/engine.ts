import {
  type Action,
  type AppState,
  type Completion,
  initialState,
  normalizeSettings,
  type Phase,
} from './model';

export class TimerEngine {
  constructor(public state: AppState = initialState()) {}

  private setPhase(phase: Phase, now: number, autoStart = false) {
    const durationMs = this.state.settings.durations[phase] * 60000;
    this.state.timer = {
      ...this.state.timer,
      phase,
      durationMs,
      remainingMs: durationMs,
      status: autoStart ? 'running' : 'idle',
      deadline: autoStart ? now + durationMs : null,
    };
  }

  tick(now = Date.now()): Completion | null {
    const timer = this.state.timer;
    if (timer.status !== 'running' || timer.deadline === null) return null;
    timer.remainingMs = Math.max(0, timer.deadline - now);
    if (timer.remainingMs > 0) return null;
    const phase = timer.phase;
    let nextPhase: Phase = 'focus';
    if (phase === 'focus') {
      this.state.history.push({
        id: `${timer.deadline}-${this.state.history.length}`,
        endedAt: timer.deadline,
        durationMs: timer.durationMs,
      });
      this.state.history = this.state.history.slice(-10000);
      timer.completedInCycle += 1;
      nextPhase = timer.completedInCycle >= this.state.settings.longBreakEvery ? 'long' : 'short';
    } else if (phase === 'long') timer.completedInCycle = 0;
    const auto =
      nextPhase === 'focus'
        ? this.state.settings.autoStartFocus
        : this.state.settings.autoStartBreaks;
    // Start at the observed finish: a delayed tick cannot invent several completed sessions.
    this.setPhase(nextPhase, now, auto);
    return { phase, nextPhase };
  }

  dispatch(action: Action, now = Date.now()): Completion | null {
    const completion = this.tick(now);
    const timer = this.state.timer;
    switch (action.type) {
      case 'toggle':
        if (timer.status === 'running') {
          timer.status = 'paused';
          timer.deadline = null;
        } else {
          timer.status = 'running';
          timer.deadline = now + timer.remainingMs;
        }
        break;
      case 'reset':
        this.setPhase(timer.phase, now);
        break;
      case 'reset-cycle':
        timer.completedInCycle = 0;
        this.setPhase('focus', now);
        break;
      case 'phase':
        if (action.phase === timer.phase) break;
        if (timer.phase === 'long' && action.phase === 'focus') timer.completedInCycle = 0;
        this.setPhase(action.phase, now);
        break;
      case 'skip':
        if (timer.phase === 'long') timer.completedInCycle = 0;
        // Skipping a focus session does not complete it or advance the cycle.
        this.setPhase(timer.phase === 'focus' ? 'short' : 'focus', now);
        break;
      case 'settings': {
        const previous = this.state.settings;
        this.state.settings = normalizeSettings(action.settings, previous);
        if (previous.longBreakEvery !== this.state.settings.longBreakEvery)
          timer.completedInCycle = 0;
        if (timer.status === 'idle') this.setPhase(timer.phase, now);
        break;
      }
    }
    return completion;
  }

  suspend(now = Date.now()): Completion | null {
    const completion = this.tick(now);
    if (this.state.timer.status === 'running') {
      this.state.timer.status = 'paused';
      this.state.timer.deadline = null;
    }
    return completion;
  }

  persisted(): AppState {
    const copy = structuredClone(this.state);
    if (copy.timer.status === 'running') copy.timer.status = 'paused';
    copy.timer.deadline = null;
    return copy;
  }
}
