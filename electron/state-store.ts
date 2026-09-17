import fs from 'node:fs';
import path from 'node:path';
import type { StateRepository } from '../src/application/pomodoro-service';
import { type AppState, initialState, type Language, restoreState } from '../src/core/model';

export function resolveDataDirectory(appData: string, override?: string) {
  return override ? path.resolve(override) : path.join(appData, 'Pomodoro');
}
export class JsonStateRepository implements StateRepository {
  constructor(private readonly file: string) {}
  load(language: Language, legacyFile?: string): { state: AppState; storageError: boolean } {
    let storageError = false;
    if (legacyFile && !fs.existsSync(this.file)) {
      try {
        if (fs.existsSync(legacyFile)) {
          fs.mkdirSync(path.dirname(this.file), { recursive: true });
          fs.copyFileSync(legacyFile, this.file, fs.constants.COPYFILE_EXCL);
        }
      } catch (error) {
        storageError = true;
        console.error('Unable to import legacy Pomodoro state:', error);
      }
    }
    try {
      return {
        state: restoreState(JSON.parse(fs.readFileSync(this.file, 'utf8')), language),
        storageError,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Unable to read Pomodoro state:', error);
        try {
          fs.renameSync(this.file, `${this.file}.unreadable-${Date.now()}`);
        } catch {
          storageError = true;
        }
      }
      return { state: initialState(language), storageError };
    }
  }
  save(state: AppState) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state), 'utf8');
    fs.renameSync(temporary, this.file);
  }
}
