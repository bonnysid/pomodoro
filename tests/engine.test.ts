import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TimerEngine } from '../src/core/engine';
import {
  decodeAction,
  formatTime,
  initialState,
  normalizeSettings,
  restoreState,
} from '../src/core/model';

test('timestamp countdown remains accurate across delayed ticks and pause/resume', () => {
  const e = new TimerEngine();
  e.dispatch({ type: 'toggle' }, 1000);
  e.tick(61123);
  assert.equal(e.state.timer.remainingMs, 1439877);
  e.dispatch({ type: 'toggle' }, 61123);
  e.tick(9999999);
  assert.equal(e.state.timer.remainingMs, 1439877);
  e.dispatch({ type: 'toggle' }, 10000000);
  assert.equal(e.state.timer.deadline, 11439877);
});

test('four completed sessions lead to a long break and a fresh cycle', () => {
  const e = new TimerEngine();
  let now = 0;
  for (let i = 1; i <= 4; i++) {
    e.dispatch({ type: 'toggle' }, now);
    now += 25 * 60000;
    const event = e.tick(now);
    assert.equal(event?.nextPhase, i === 4 ? 'long' : 'short');
    assert.equal(e.state.timer.completedInCycle, i);
    assert.equal(e.state.history.length, i);
    e.dispatch({ type: 'toggle' }, now);
    now += (i === 4 ? 15 : 5) * 60000;
    e.tick(now);
    assert.equal(e.state.timer.phase, 'focus');
  }
  assert.equal(e.state.timer.completedInCycle, 0);
});

test('reset, manual phase selection, and skipping never award a focus session', () => {
  const e = new TimerEngine();
  e.dispatch({ type: 'toggle' }, 0);
  e.dispatch({ type: 'reset' }, 20000);
  e.dispatch({ type: 'skip' }, 30000);
  e.dispatch({ type: 'phase', phase: 'long' }, 40000);
  e.dispatch({ type: 'skip' }, 50000);
  assert.equal(e.state.history.length, 0);
  assert.equal(e.state.timer.completedInCycle, 0);
});

test('selecting the active phase does not interrupt a running timer', () => {
  const e = new TimerEngine();
  e.dispatch({ type: 'toggle' }, 0);
  e.dispatch({ type: 'phase', phase: 'focus' }, 10000);
  assert.equal(e.state.timer.status, 'running');
  assert.equal(e.state.timer.deadline, 1500000);
  assert.equal(e.state.timer.remainingMs, 1490000);
});

test('a heavily delayed tick completes at most one real session', () => {
  const e = new TimerEngine();
  e.dispatch(
    {
      type: 'settings',
      settings: { autoStartBreaks: true, autoStartFocus: true },
    },
    0,
  );
  e.dispatch({ type: 'toggle' }, 0);
  e.tick(86400000);
  assert.equal(e.state.history.length, 1);
  assert.equal(e.state.timer.phase, 'short');
  assert.equal(e.state.timer.remainingMs, 300000);
  assert.equal(e.state.timer.deadline, 86700000);
});

test('sleep pauses and restart restores remaining time without crediting downtime', () => {
  const e = new TimerEngine();
  e.dispatch({ type: 'toggle' }, 0);
  e.suspend(10000);
  e.tick(86400000);
  assert.equal(e.state.timer.status, 'paused');
  assert.equal(e.state.timer.remainingMs, 1490000);
  assert.equal(e.state.history.length, 0);
  e.dispatch({ type: 'toggle' }, 86400000);
  const restored = restoreState(e.persisted());
  assert.equal(restored.timer.status, 'paused');
  assert.equal(restored.timer.deadline, null);
  assert.equal(restored.timer.remainingMs, 1490000);
});

test('new settings preserve a running timer, apply next, and cannot inject invalid values', () => {
  const e = new TimerEngine();
  e.dispatch({ type: 'toggle' }, 0);
  e.dispatch(
    {
      type: 'settings',
      settings: { durations: { focus: 50, short: 10, long: 30 } },
    },
    1000,
  );
  assert.equal(e.state.timer.durationMs, 1500000);
  e.tick(1500000);
  assert.equal(e.state.timer.durationMs, 600000);
  const s = normalizeSettings({
    durations: { focus: -1, short: NaN, long: 300 },
    volume: Infinity,
    theme: 'unsafe',
    language: 'fr',
  });
  assert.deepEqual(s.durations, { focus: 25, short: 5, long: 15 });
  assert.equal(s.theme, 'midnight');
  assert.throws(() => decodeAction({ type: 'phase', phase: 'oops' }));
});

test('corrupt persisted state falls back safely and time formatting rounds up', () => {
  assert.deepEqual(restoreState(null), initialState());
  const restored = restoreState({
    schema: 1,
    settings: {},
    timer: { phase: 'oops', remainingMs: -1 },
    history: [null, { id: 'x', endedAt: 1, durationMs: -100 }],
  });
  assert.equal(restored.timer.phase, 'focus');
  assert.equal(restored.history.length, 0);
  assert.equal(formatTime(59999), '01:00');
  assert.equal(formatTime(1), '00:01');
  assert.equal(formatTime(-1), '00:00');
});
