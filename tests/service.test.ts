import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PomodoroService } from '../src/application/pomodoro-service';
import { type AppState, initialState, restoreState } from '../src/core/model';

test('cycle reset is saved immediately and survives service recreation', () => {
  const state = initialState();
  state.timer.completedInCycle = 3;
  state.history = [{ id: 'kept', endedAt: 1, durationMs: 1500000 }];
  let saved: AppState = initialState();
  const store = {
    save: (s: AppState) => {
      saved = structuredClone(s);
    },
  };
  const service = new PomodoroService(state, store, () => 10000);
  let changes = 0;
  service.onState(() => {
    changes++;
  });
  service.dispatch({ type: 'reset-cycle' });
  assert.equal(saved.timer.completedInCycle, 0);
  assert.equal(saved.history.length, 1);
  const restarted = new PomodoroService(restoreState(saved), store);
  assert.deepEqual(restarted.state, service.state);
  assert.equal(changes, 1);
});

test('completion is persisted and emitted exactly once despite repeated ticks', () => {
  let now = 0,
    saves = 0,
    completed = 0;
  const service = new PomodoroService(
    initialState(),
    {
      save: () => {
        saves++;
      },
    },
    () => now,
  );
  service.onComplete(() => {
    completed++;
  });
  service.dispatch({ type: 'toggle' });
  now = 1500000;
  service.tick();
  service.tick();
  service.tick();
  assert.equal(completed, 1);
  assert.equal(saves, 2);
  assert.equal(service.state.history.length, 1);
});

test('an unavailable storage is reported and a later checkpoint retries saving', (t) => {
  t.mock.method(console, 'error', () => {});
  let unavailable = true;
  const service = new PomodoroService(initialState(), {
    save: () => {
      if (unavailable) throw new Error('Disk unavailable');
    },
  });
  service.dispatch({ type: 'settings', settings: { theme: 'paper' } });
  assert.equal(service.storageError, true);
  assert.equal(service.state.settings.theme, 'paper');
  unavailable = false;
  service.checkpoint();
  assert.equal(service.storageError, false);
});
