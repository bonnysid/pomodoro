import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type BrowserWindow, type IpcMainInvokeEvent, net, protocol, session } from 'electron';

export function registerLocalContent(appPath: string) {
  const root = path.resolve(appPath, 'dist');
  protocol.handle('pomodoro', (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'app' || request.method !== 'GET')
      return new Response('Forbidden', { status: 403 });
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
