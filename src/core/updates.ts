export type UpdateAction = 'check' | 'download' | 'install';
export interface UpdateState {
  status:
    | 'disabled'
    | 'idle'
    | 'checking'
    | 'current'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'installing'
    | 'error';
  availableVersion: string | null;
  notes: string;
  progress: number;
  problem: 'check' | 'download' | 'save' | 'install' | null;
  unavailableReason: 'development' | 'mac-signing' | 'platform' | null;
}
export function initialUpdateState(reason: UpdateState['unavailableReason'] = null): UpdateState {
  return {
    status: reason ? 'disabled' : 'idle',
    availableVersion: null,
    notes: '',
    progress: 0,
    problem: null,
    unavailableReason: reason,
  };
}
export function decodeUpdateAction(value: unknown): UpdateAction {
  if (value === 'check' || value === 'download' || value === 'install') return value;
  throw new Error('Invalid update action');
}
