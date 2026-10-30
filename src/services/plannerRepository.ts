import type { PlannerState } from '../types/planner';

export const STORAGE_KEY = 'off-planner-state-v1';

/**
 * Abstract Backend / Persistence Repository Interface.
 *
 * Right now this uses a LocalStorage + In-Memory repository so user data is ALWAYS
 * preserved across page reloads and browser restarts, while keeping an async backend
 * service boundary so replacing it with an HTTP/Database API later requires zero UI changes.
 */
export interface PlannerRepository {
  getState(): Promise<PlannerState>;
  saveState(state: PlannerState): Promise<void>;
  exportJson(state: PlannerState): string;
}

export class LocalStoragePlannerRepository implements PlannerRepository {
  private memoryState: PlannerState;
  private sanitizer: (raw: unknown) => PlannerState;

  constructor(
    initialState: PlannerState,
    sanitizer: (raw: unknown) => PlannerState
  ) {
    this.memoryState = initialState;
    this.sanitizer = sanitizer;
  }

  async getState(): Promise<PlannerState> {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.memoryState = this.sanitizer(parsed);
          return this.memoryState;
        }
      } catch (err) {
        console.warn('Failed to load state from localStorage:', err);
      }
    }
    return this.memoryState;
  }

  async saveState(state: PlannerState): Promise<void> {
    this.memoryState = state;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn('Failed to persist state to localStorage:', err);
      }
    }
  }

  exportJson(state: PlannerState): string {
    return JSON.stringify(state, null, 2);
  }
}
