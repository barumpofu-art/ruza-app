import { SAVE_VERSION } from './state.js';
import { resetPlayerIds } from './players.js';

const KEY = 'kalahari-manager-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function save(state) {
  try {
    // Commentary is huge and only matters while you are watching, so it goes.
    const slim = { ...state, lastResult: state.lastResult ? { ...state.lastResult, result: undefined } : null };
    localStorage.setItem(KEY, JSON.stringify(slim));
    return true;
  } catch (err) {
    console.warn('Could not save', err);
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (state.version !== SAVE_VERSION) return null;
    // Player ids must not collide with the ones already in the save.
    resetPlayerIds(state.nextPlayerId ?? highestPlayerId(state) + 1);
    return state;
  } catch (err) {
    console.warn('Could not load save', err);
    return null;
  }
}

function highestPlayerId(state) {
  let max = 0;
  for (const team of state.teams ?? []) for (const p of team.squad) max = Math.max(max, p.id);
  for (const p of state.freeAgents ?? []) max = Math.max(max, p.id);
  return max;
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
