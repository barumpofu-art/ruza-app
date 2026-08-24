import { SAVE_VERSION } from './state.js';
import { resetPlayerIds } from './players.js';

const KEY = 'kalahari-manager-save-v1';

// Some ways of opening a local file (a content:// URI on Android, private
// browsing) give a page no storage at all. The game still has to run, so fall
// back to keeping the save in memory for as long as the tab is open.
const memory = new Map();

function backing() {
  try {
    const probe = '__kalahari_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

const store = backing();

/** True when progress will actually survive closing the page. */
export const persistent = () => store !== null;

const read = (key) => (store ? store.getItem(key) : memory.get(key) ?? null);
const write = (key, value) => (store ? store.setItem(key, value) : memory.set(key, value));
const remove = (key) => (store ? store.removeItem(key) : memory.delete(key));

export function hasSave() {
  return !!read(KEY);
}

export function save(state) {
  try {
    // Commentary is huge and only matters while you are watching, so it goes.
    const slim = { ...state, lastResult: state.lastResult ? { ...state.lastResult, result: undefined } : null };
    write(KEY, JSON.stringify(slim));
    return true;
  } catch (err) {
    console.warn('Could not save', err);
    return false;
  }
}

export function load() {
  try {
    const raw = read(KEY);
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
  try { remove(KEY); } catch { /* ignore */ }
}
