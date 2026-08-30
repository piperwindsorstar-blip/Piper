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
  // saves store the full roster plus which ids are active (`partyIds`);
  // older saves only ever had a flat `party` array — fall back to that.
  const roster = d.roster ?? d.party ?? [];
  const party = d.partyIds
    ? d.partyIds.map((id) => roster.find((c) => c.id === id)).filter(Boolean)
    : roster;
  const leader = party[0] ?? roster[0];
  return {
    at: s.at,
    leader: leader?.name ?? '???',
    level: leader?.level ?? 1,
    gold: d.gold ?? 0,
    map: d.mapName ?? '',
    playtime: d.playtime ?? 0,
    members: party.length || roster.length,
  };
}
