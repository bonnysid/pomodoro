import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PomodoroService } from '../src/application/pomodoro-service';
import { localDay } from '../src/core/calendar';
import { type AppState, decodeAction, initialState, restoreState } from '../src/core/model';

const yesterday = new Date(2026, 8, 15, 12).getTime();
const today = new Date(2026, 8, 16, 8).getTime();
function fixture() {
  const state = initialState('ru');
  state.cycleDay = localDay(yesterday);
  state.settings.durations = { focus: 50, short: 10, long: 30 };
  state.timer.completedInCycle = 1;
  state.timer.status = 'paused';
  state.timer.durationMs = 3000000;
  state.timer.remainingMs = 1234567;
  state.history = [{ id: 'yesterday', endedAt: yesterday, durationMs: 3000000 }];
  let now = today;
  let saved = structuredClone(state);
  const repository = {
    save: (value: AppState) => {
      saved = structuredClone(value);
    },
  };
  const service = new PomodoroService(state, repository, () => now);
  return {
    service,
    repository,
    saved: () => saved,
    now: (value: number) => {
      now = value;
    },
  };
}

test('opening on a later local day offers a reset without touching the timer or history', () => {
  const { service } = fixture();
  const before = structuredClone(service.state);
  service.dispatch(decodeAction({ type: 'check-new-day' }));
  assert.equal(service.newDayAvailable, true);
  assert.deepEqual(service.state, before);
});

test('keeping the cycle persists the choice across reopen/restart, and offers again next day', () => {
  const f = fixture();
  const timer = structuredClone(f.service.state.timer);
  f.service.dispatch({ type: 'check-new-day' });
  f.service.dispatch(decodeAction({ type: 'keep-cycle' }));
  assert.deepEqual(f.service.state.timer, timer);
  assert.equal(f.service.newDayAvailable, false);
  const restarted = new PomodoroService(restoreState(f.saved()), f.repository, () => today);
  restarted.dispatch({ type: 'check-new-day' });
  assert.equal(restarted.newDayAvailable, false);
  f.now(new Date(2026, 8, 17, 9).getTime());
  f.service.dispatch({ type: 'check-new-day' });
  assert.equal(f.service.newDayAvailable, true);
});

test('new day and manual reset both return to session 1 and preserve all records and settings', () => {
  const f = fixture();
  const { history, settings } = structuredClone(f.service.state);
  f.service.dispatch({ type: 'check-new-day' });
  f.service.dispatch({ type: 'reset-cycle' });
  assert.equal(f.service.newDayAvailable, false);
  assert.deepEqual(f.service.state.timer, {
    phase: 'focus',
    status: 'idle',
    remainingMs: 3000000,
    durationMs: 3000000,
    deadline: null,
    completedInCycle: 0,
  });
  assert.deepEqual(f.saved().history, history);
  assert.deepEqual(f.saved().settings, settings);
  assert.equal(f.saved().cycleDay, localDay(today));
  const restarted = new PomodoroService(restoreState(f.saved()), f.repository, () => today);
  restarted.dispatch({ type: 'check-new-day' });
  assert.equal(restarted.newDayAvailable, false);
  assert.equal(restarted.state.timer.completedInCycle + 1, 1);
});

test('midnight and foreground checks never interrupt running work', () => {
  const f = fixture();
  const midnight = new Date(2026, 8, 16).getTime();
  f.now(midnight - 1000);
  f.service.dispatch({ type: 'toggle' });
  const deadline = f.service.state.timer.deadline;
  f.now(midnight + 1000);
  f.service.tick();
  f.service.dispatch({ type: 'check-new-day' });
  assert.equal(f.service.newDayAvailable, false);
  assert.equal(f.service.state.timer.status, 'running');
  assert.equal(f.service.state.timer.deadline, deadline);
  assert.equal(f.service.state.timer.completedInCycle, 1);
  f.service.suspend();
  f.service.dispatch({ type: 'check-new-day' });
  assert.equal(f.service.newDayAvailable, true);
});

test('idle fresh cycle needs no prompt; unfinished first session and breaks do', () => {
  for (const phase of ['focus', 'short', 'long'] as const) {
    const f = fixture();
    f.service.state.timer.completedInCycle = 0;
    f.service.state.timer.phase = phase;
    f.service.dispatch({ type: 'check-new-day' });
    assert.equal(f.service.newDayAvailable, true);
  }
  const f = fixture();
  f.service.state.timer = initialState().timer;
  f.service.dispatch({ type: 'check-new-day' });
  assert.equal(f.service.newDayAvailable, false);
  assert.equal(f.saved().cycleDay, localDay(today));
});

test('old schema-1 profiles infer a day from real history; unknown dates start today', () => {
  const f = fixture();
  const legacy: Record<string, unknown> = structuredClone(f.service.state) as unknown as Record<
    string,
    unknown
  >;
  delete legacy.cycleDay;
  const restored = restoreState(legacy);
  assert.equal(restored.cycleDay, null);
  const service = new PomodoroService(restored, f.repository, () => today);
  service.dispatch({ type: 'check-new-day' });
  assert.equal(service.newDayAvailable, true);
  assert.deepEqual(service.state.history, f.service.state.history);
  const fresh = new PomodoroService(initialState(), f.repository, () => today);
  fresh.dispatch({ type: 'check-new-day' });
  assert.equal(fresh.newDayAvailable, false);
  assert.equal(fresh.state.cycleDay, localDay(today));
});

test('local midnight, year change and clock rollback use calendar dates', () => {
  assert.equal(localDay(new Date(2026, 0, 1, 0, 1).getTime()), '2026-01-01');
  const f = fixture();
  f.service.state.cycleDay = '2025-12-31';
  f.now(new Date(2026, 0, 1, 0, 1).getTime());
  f.service.dispatch({ type: 'check-new-day' });
  assert.equal(f.service.newDayAvailable, true);
  f.service.dispatch({ type: 'keep-cycle' });
  f.now(new Date(2025, 11, 31, 23, 59).getTime());
  f.service.dispatch({ type: 'check-new-day' });
  assert.equal(f.service.newDayAvailable, false);
});

test('changing settings does not consume the day prompt or alter the cycle', () => {
  const { service } = fixture();
  service.dispatch({ type: 'settings', settings: { language: 'en' } });
  service.dispatch({ type: 'check-new-day' });
  assert.equal(service.newDayAvailable, true);
  assert.equal(service.state.timer.completedInCycle, 1);
});
