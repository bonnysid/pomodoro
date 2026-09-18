import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, normalizeSettings, restoreState } from '../src/core/model';

test('completion window defaults on for old profiles while preserving history and preferences', () => {
  const state = initialState();
  state.settings.durations = { focus: 50, short: 10, long: 30 };
  state.history = [{ id: 'saved', endedAt: Date.now(), durationMs: 3000000 }];
  const raw = JSON.parse(JSON.stringify(state));
  delete raw.settings.showOnCompletion;
  const restored = restoreState(raw);
  assert.equal(restored.settings.showOnCompletion, true);
  assert.deepEqual(restored.history, state.history);
  assert.deepEqual(restored.settings.durations, state.settings.durations);
});

test('completion window can stay off across restart independently of notifications and pinning', () => {
  const state = initialState();
  state.settings = normalizeSettings({
    showOnCompletion: false,
    notifications: true,
    alwaysOnTop: true,
  });
  const restored = restoreState(state);
  assert.equal(restored.settings.showOnCompletion, false);
  assert.equal(restored.settings.notifications, true);
  assert.equal(restored.settings.alwaysOnTop, true);
  assert.equal(
    normalizeSettings({ showOnCompletion: 'false' }, state.settings).showOnCompletion,
    false,
  );
});
