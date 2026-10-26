import { validateBackup, initialPlans } from './domain.js';
import { scopedKey, currentAccount } from './account.js';
const LEGACY_KEY='team-progress:v1';
export const emptyState = () => ({ version: 2, habits: [], habitEntries: [], plans: initialPlans(), activePlanId: 'base-v11', schedule: [], activities: [], deleted: {}, prefsUpdatedAt: '1970-01-01T00:00:00.000Z', sessions: [], active: null, preferences: { name: '', theme: 'light', restSeconds: 120 } });
export function loadState() {
  const KEY=scopedKey();
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyState();
  return validateBackup(JSON.parse(raw));
}
export function saveState(state) {
  const KEY=scopedKey();
  const previous = localStorage.getItem(KEY);
  if (previous) {
    try { validateBackup(JSON.parse(previous)); }
    catch { localStorage.setItem(`${KEY}:recovery`, previous); }
  }
  localStorage.setItem(KEY, JSON.stringify(state));
}
export function exportState(state) { return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2); }

export function hasLegacyState(){return !!localStorage.getItem(LEGACY_KEY)&&!localStorage.getItem('team-progress:legacy-claimed');}
export function readLegacyState(){if(!hasLegacyState())throw new Error('Keine älteren lokalen Daten verfügbar.');return validateBackup(JSON.parse(localStorage.getItem(LEGACY_KEY)));}
export function claimLegacyState(){localStorage.setItem('team-progress:legacy-claimed',currentAccount().id);}
