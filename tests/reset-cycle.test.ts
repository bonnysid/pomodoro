import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TimerEngine } from '../src/core/engine';
import { decodeAction, initialState, restoreState } from '../src/core/model';

test('a new day can start with a fresh cycle while retaining yesterday’s history and preferences', () => {
  const state = initialState('ru');
  state.settings.durations = { focus: 50, short: 10, long: 30 };
  state.timer.completedInCycle = 1;
  state.history = [{ id: 'yesterday', endedAt: 1000, durationMs: 3000000 }];
  const settings = structuredClone(state.settings),
    history = structuredClone(state.history);
  const engine = new TimerEngine(state);
  engine.dispatch(decodeAction({ type: 'reset-cycle' }), 86400000);
  assert.deepEqual(engine.state.settings, settings);
  assert.deepEqual(engine.state.history, history);
  assert.deepEqual(engine.state.timer, {
    phase: 'focus',
    status: 'idle',
    completedInCycle: 0,
    durationMs: 3000000,
    remainingMs: 3000000,
    deadline: null,
  });
  assert.deepEqual(restoreState(engine.persisted()).timer, engine.state.timer);
});

for (const phase of ['focus', 'short', 'long'] as const) {
  for (const status of ['running', 'paused'] as const) {
    test(`reset cycle from ${status} ${phase} stops it without awarding an unfinished session`, () => {
      const engine = new TimerEngine();
      engine.dispatch({ type: 'phase', phase }, 0);
      engine.state.timer.completedInCycle = phase === 'long' ? 4 : 2;
      engine.dispatch({ type: 'toggle' }, 0);
      if (status === 'paused') engine.dispatch({ type: 'toggle' }, 10000);
      engine.dispatch({ type: 'reset-cycle' }, 20000);
      assert.equal(engine.state.timer.phase, 'focus');
      assert.equal(engine.state.timer.status, 'idle');
      assert.equal(engine.state.timer.completedInCycle, 0);
      assert.equal(engine.state.timer.deadline, null);
      assert.equal(engine.state.history.length, 0);
      engine.tick(86400000);
      assert.equal(engine.state.history.length, 0);
    });
  }
}

test('reset timer and reset cycle remain separate commands', () => {
  const engine = new TimerEngine();
  engine.state.timer.completedInCycle = 2;
  engine.dispatch({ type: 'phase', phase: 'short' }, 0);
  engine.dispatch({ type: 'reset' }, 0);
  assert.equal(engine.state.timer.completedInCycle, 2);
  assert.equal(engine.state.timer.phase, 'short');
  engine.dispatch({ type: 'reset-cycle' }, 0);
  assert.equal(engine.state.timer.completedInCycle, 0);
  assert.equal(engine.state.timer.phase, 'focus');
});

test('a session that actually ended at the reset boundary remains in history', () => {
  const engine = new TimerEngine();
  engine.dispatch({ type: 'toggle' }, 0);
  engine.dispatch({ type: 'reset-cycle' }, 1500000);
  assert.equal(engine.state.history.length, 1);
  assert.equal(engine.state.timer.completedInCycle, 0);
  assert.equal(engine.state.timer.status, 'idle');
});
