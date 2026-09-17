import type { DesktopAPI } from '../shared/contracts';
import { createBrowserClient } from './browser-client';

let browserClient: DesktopAPI | undefined;
export function getAPI(): DesktopAPI {
  if (window.pomodoro) return window.pomodoro;
  browserClient ??= createBrowserClient();
  return browserClient;
}
