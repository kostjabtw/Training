import { validateBackup, initialPlans } from './domain.js';
const KEY = 'team-progress:v1';
export const emptyState = () => ({ version: 2, plans: initialPlans(), activePlanId: 'base-v11', schedule: [], activities: [], deleted: {}, prefsUpdatedAt: '1970-01-01T00:00:00.000Z', sessions: [], active: null, preferences: { name: '', theme: 'light', restSeconds: 120 } });
export function loadState() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyState();
  return validateBackup(JSON.parse(raw));
}
export function saveState(state) {
  const previous = localStorage.getItem(KEY);
  if (previous) {
    try { validateBackup(JSON.parse(previous)); }
    catch { localStorage.setItem(`${KEY}:recovery`, previous); }
  }
  localStorage.setItem(KEY, JSON.stringify(state));
}
export function exportState(state) { return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2); }
