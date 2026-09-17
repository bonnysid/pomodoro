import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const tsc = spawn(
  process.execPath,
  [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.electron.json'],
  { stdio: 'inherit', windowsHide: true },
);
if ((await new Promise((resolve) => tsc.on('exit', resolve))) !== 0) process.exit(1);
const server = await createServer();
await server.listen();
const env = { ...process.env, POMODORO_DEV_URL: 'http://127.0.0.1:5173' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), ['.'], {
  env,
  stdio: 'inherit',
  windowsHide: true,
});
child.on('exit', async () => {
  await server.close();
  process.exit();
});
process.on('SIGINT', () => child.kill());
