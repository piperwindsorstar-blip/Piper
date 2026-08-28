// ============================================================================
//  SAVE — three localStorage slots. Characters are stored as plain data and
//  rebuilt on load, so adding fields to the character model does not break
//  existing saves (missing fields fall back to their defaults).
// ============================================================================

const KEY = (slot) => `qot13.save.${slot}`;
export const SLOTS = [1, 2, 3];
export const VERSION = 1;

export function hasSave(slot) {
  try { return !!localStorage.getItem(KEY(slot)); } catch { return false; }
}

export function saveGame(slot, data) {
  try {
    localStorage.setItem(KEY(slot), JSON.stringify({ v: VERSION, at: Date.now(), data }));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export function loadGame(slot) {
  try {
    const raw = localStorage.getItem(KEY(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.v !== VERSION) return null;
    return parsed;
  } catch { return null; }
}

export function deleteSave(slot) {
  try { localStorage.removeItem(KEY(slot)); } catch { /* ignore */ }
}

export function saveSummary(slot) {
  const s = loadGame(slot);
  if (!s) return null;
  const d = s.data;
  return {
    at: s.at,
    leader: d.party?.[0]?.name ?? '???',
    level: d.party?.[0]?.level ?? 1,
    gold: d.gold ?? 0,
    map: d.mapName ?? '',
    playtime: d.playtime ?? 0,
    members: d.party?.length ?? 0,
  };
}
