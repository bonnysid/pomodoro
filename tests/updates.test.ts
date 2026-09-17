import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UpdateService } from '../src/application/update-service';
import { decodeUpdateAction } from '../src/core/updates';

function fixture() {
  const calls: string[] = [];
  let running = false;
  let saved = true;
  const driver = {
    check: async () => {
      calls.push('check');
    },
    download: async () => {
      calls.push('download');
    },
    install: () => {
      calls.push('install');
    },
  };
  const service = new UpdateService(
    driver,
    () => !running,
    () => {
      calls.push('save');
      return saved;
    },
  );
  return {
    service,
    driver,
    calls,
    running: (value: boolean) => {
      running = value;
    },
    saved: (value: boolean) => {
      saved = value;
    },
  };
}
test('only explicit update actions are accepted over IPC', () => {
  for (const action of ['check', 'download', 'install'])
    assert.equal(decodeUpdateAction(action), action);
  for (const action of [null, 'https://example.com/install.exe', {}, { action: 'install' }])
    assert.throws(() => decodeUpdateAction(action));
});
test('disabled preview never checks, downloads or installs', async () => {
  const service = new UpdateService(
    null,
    () => true,
    () => {
      throw new Error('Must not save');
    },
    'development',
  );
  for (const action of ['check', 'download', 'install'] as const) await service.dispatch(action);
  assert.equal(service.state.status, 'disabled');
});
test('checking never downloads automatically and concurrent checks are ignored', async () => {
  const f = fixture();
  await Promise.all([f.service.dispatch('check'), f.service.dispatch('check')]);
  assert.deepEqual(f.calls, ['check']);
  f.service.available('0.2.4', 'Changes');
  assert.equal(f.service.state.status, 'available');
  assert.deepEqual(f.calls, ['check']);
  assert.equal(f.service.state.availableVersion, '0.2.4');
});
test('current status requires a successful response; a failed check can be retried', async () => {
  const f = fixture();
  f.driver.check = async () => {
    throw new Error('Offline');
  };
  await f.service.dispatch('check');
  assert.equal(f.service.state.status, 'error');
  assert.equal(f.service.state.problem, 'check');
  f.driver.check = async () => {
    f.service.current();
  };
  await f.service.dispatch('check');
  assert.equal(f.service.state.status, 'current');
  assert.equal(f.service.state.problem, null);
});
test('download requires an available version and handles progress, failure and retry', async () => {
  const f = fixture();
  await f.service.dispatch('download');
  await f.service.dispatch('install');
  assert.deepEqual(f.calls, []);
  await f.service.dispatch('check');
  f.service.available('0.2.4', 'x'.repeat(10000));
  assert.equal(f.service.state.notes.length, 8000);
  f.driver.download = async () => {
    f.service.progress(40);
    throw new Error('Checksum mismatch');
  };
  await f.service.dispatch('download');
  assert.equal(f.service.state.status, 'available');
  assert.equal(f.service.state.problem, 'download');
  f.driver.download = async () => {
    f.service.progress(500);
    assert.equal(f.service.state.progress, 100);
    f.service.downloaded();
  };
  await f.service.dispatch('download');
  assert.equal(f.service.state.status, 'downloaded');
  assert.equal(f.service.state.problem, null);
  const before = structuredClone(f.service.state);
  await f.service.dispatch('check');
  assert.deepEqual(f.service.state, before);
});
test('install waits for paused timer and successful save; it only installs once', async () => {
  const f = fixture();
  await f.service.dispatch('check');
  f.service.available('0.2.4', '');
  await f.service.dispatch('download');
  f.service.downloaded();
  f.running(true);
  await f.service.dispatch('install');
  assert.deepEqual(f.calls, ['check', 'download']);
  f.running(false);
  f.saved(false);
  await f.service.dispatch('install');
  assert.equal(f.service.state.problem, 'save');
  assert.equal(f.service.state.status, 'downloaded');
  f.saved(true);
  await Promise.all([f.service.dispatch('install'), f.service.dispatch('install')]);
  assert.deepEqual(f.calls, ['check', 'download', 'save', 'save', 'install']);
  assert.equal(f.service.state.status, 'installing');
});
test('synchronous and event-based installer failures allow another attempt', async () => {
  const f = fixture();
  await f.service.dispatch('check');
  f.service.available('0.2.4', '');
  await f.service.dispatch('download');
  f.service.downloaded();
  f.driver.install = () => {
    throw new Error('Installer unavailable');
  };
  await f.service.dispatch('install');
  assert.equal(f.service.state.problem, 'install');
  assert.equal(f.service.state.status, 'downloaded');
  f.driver.install = () => {};
  await f.service.dispatch('install');
  f.service.installFailed();
  assert.equal(f.service.state.status, 'downloaded');
});
