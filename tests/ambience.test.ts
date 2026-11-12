import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSettings, initialState, normalizeSettings, restoreState } from '../src/core/model';
import { ambientSamples } from '../src/services/ambient-tracks';

test('old profiles keep focus-only audio; music choices, volume and always-play survive restore', () => {
  assert.equal(normalizeSettings({ ambience: 'brown' }).ambientAlways, false);
  for (const ambience of ['lofi', 'worlds'] as const) {
    const state = initialState();
    state.settings = { ...defaultSettings(), ambience, ambientAlways: true, ambientVolume: 0.37 };
    assert.deepEqual(restoreState(JSON.parse(JSON.stringify(state))).settings, state.settings);
  }
  assert.equal(normalizeSettings({ ambience: 'invalid', ambientAlways: 'yes' }).ambience, 'none');
  assert.equal(normalizeSettings({ ambientAlways: 'yes' }).ambientAlways, false);
});
test('original music loops have finite, audible samples without clipping', () => {
  for (const kind of ['lofi', 'worlds'] as const) {
    const samples = ambientSamples(kind, 22050);
    let peak = 0;
    let energy = 0;
    for (const sample of samples) {
      assert.ok(Number.isFinite(sample));
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
    }
    assert.ok(peak < 1 && peak > 0.1, `${kind}: peak ${peak}`);
    assert.ok(Math.sqrt(energy / samples.length) > 0.03);
    assert.ok(Math.abs(samples[0] - samples[samples.length - 1]) < 0.05, 'smooth loop boundary');
  }
});
