import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { type BrowserWindow, type IpcMainInvokeEvent, net, protocol, session } from 'electron';
import type { MinecraftMusic } from './minecraft-music';

export function registerLocalContent(appPath: string, music: MinecraftMusic) {
  const root = path.resolve(appPath, 'dist');
  protocol.handle('pomodoro', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || request.method !== 'GET')
      return new Response('Forbidden', { status: 403 });
    if (url.pathname.startsWith('/music/')) {
      const id = /^\/music\/([a-f0-9]{40})\.ogg$/.exec(url.pathname)?.[1];
      const file = id ? music.file(id) : undefined;
      if (!file) return new Response('Not found', { status: 404 });
      try {
        const size = statSync(file).size;
        let start = 0,
          end = size - 1;
        const range = request.headers.get('range');
        if (range) {
          const parts = /^bytes=(\d*)-(\d*)$/.exec(range);
          if (!parts || (!parts[1] && !parts[2]))
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${size}` },
            });
          start = parts[1] ? Number(parts[1]) : Math.max(0, size - Number(parts[2]));
          end = parts[1] && parts[2] ? Math.min(Number(parts[2]), size - 1) : size - 1;
          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start > end ||
            start >= size
          )
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${size}` },
            });
        }
        const headers = new Headers({
          'Content-Type': 'audio/ogg',
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
        });
        if (range) headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
        return new Response(
          Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream,
          { status: range ? 206 : 200, headers },
        );
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    const file = path.resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
    if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
}
export function assertTrusted(
  event: IpcMainInvokeEvent,
  win: BrowserWindow | null,
  devUrl: string | null,
) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame)
    throw new Error('Untrusted sender');
  const url = new URL(event.senderFrame.url);
  if (devUrl ? url.origin !== devUrl : url.protocol !== 'pomodoro:' || url.hostname !== 'app')
    throw new Error('Untrusted origin');
}
