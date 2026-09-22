import { initialUpdateState, type UpdateAction, type UpdateState } from '../core/updates';

export interface UpdateDriver {
  check(): Promise<void>;
  download(): Promise<void>;
  install(): void;
}

/** Update orchestration is independent of Electron; installation requires a saved, stopped timer. */
export class UpdateService {
  state: UpdateState;
  private checking = false;
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly driver: UpdateDriver | null,
    private readonly canInstall: () => boolean,
    private readonly prepareInstall: () => boolean,
    reason: UpdateState['unavailableReason'] = null,
  ) {
    this.state = initialUpdateState(driver ? null : reason || 'development');
  }
  onState(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  available(version: string, notes: string) {
    if (this.state.status !== 'checking') return;
    this.change({
      status: 'available',
      availableVersion: version,
      notes: notes.slice(0, 8000),
      problem: null,
    });
  }
  current() {
    if (this.state.status === 'checking')
      this.change({ status: 'current', availableVersion: null, notes: '', problem: null });
  }
  progress(percent: number) {
    if (this.state.status === 'downloading' && Number.isFinite(percent))
      this.change({ progress: Math.max(0, Math.min(100, percent)) });
  }
  downloaded() {
    if (this.state.status === 'downloading')
      this.change({ status: 'downloaded', progress: 100, problem: null });
  }
  installFailed() {
    if (this.state.status === 'installing')
      this.change({ status: 'downloaded', problem: 'install' });
  }
  async dispatch(action: UpdateAction) {
    if (!this.driver) return;
    if (action === 'check') {
      if (this.checking || !['idle', 'current', 'available', 'error'].includes(this.state.status))
        return;
      this.checking = true;
      this.change({
        status: 'checking',
        problem: null,
        availableVersion: null,
        notes: '',
        progress: 0,
      });
      try {
        await this.driver.check();
      } catch {
        this.change({ status: 'error', problem: 'check' });
        return;
      } finally {
        this.checking = false;
      }
      // Download once the check has completed; only the user can request installation.
      if (this.state.status === 'available') await this.dispatch('download');
    } else if (action === 'download') {
      if (this.state.status !== 'available') return;
      this.change({ status: 'downloading', problem: null, progress: 0 });
      try {
        await this.driver.download();
      } catch {
        this.change({ status: 'available', problem: 'download', progress: 0 });
      }
    } else if (action === 'install') {
      if (this.state.status !== 'downloaded' || !this.canInstall()) return;
      try {
        if (!this.prepareInstall()) {
          this.change({ problem: 'save' });
          return;
        }
        this.change({ status: 'installing', problem: null });
        this.driver.install();
      } catch {
        this.change({ status: 'downloaded', problem: 'install' });
      }
    }
  }
  private change(patch: Partial<UpdateState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
}
