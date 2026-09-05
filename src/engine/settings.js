// ============================================================================
//  SETTINGS — small persisted preferences that live outside any save slot,
//  so they apply on the title screen before a save even exists.
// ============================================================================

const KEY = 'qot13.settings';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch { return {}; }
}

function write(patch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  } catch { /* private browsing, storage full — the setting just won't stick */ }
}

// 'auto' matches the old behaviour (shown only on a coarse pointer); 'on' and
// 'off' let a player override that guess — a touchscreen laptop with a mouse
// attached, or someone who just prefers the on-screen pad on a desktop.
const TOUCH_MODES = ['auto', 'on', 'off'];
export const TOUCH_LABEL = { auto: 'Auto', on: 'On', off: 'Off' };

export function getTouchMode() {
  const m = read().touch;
  return TOUCH_MODES.includes(m) ? m : 'auto';
}

export function cycleTouchMode() {
  const next = TOUCH_MODES[(TOUCH_MODES.indexOf(getTouchMode()) + 1) % TOUCH_MODES.length];
  write({ touch: next });
  applyTouchVisibility();
  return next;
}

/** Show or hide the on-screen pad right now, per the current setting. */
export function applyTouchVisibility() {
  const pad = document.getElementById('touch');
  if (!pad) return;
  const mode = getTouchMode();
  const show = mode === 'on' || (mode === 'auto' && matchMedia('(pointer: coarse)').matches);
  pad.classList.toggle('visible', show);
  // the pad reserves screen gutters so it never overlaps canvas content;
  // toggling it mid-session must resize the canvas to match immediately
  window.app?.screen?.resize();
}

// A straight multiplier on the battle scene's own dt (see BattleScene.update)
// — windups, strikes, message dwell time, everything speeds up together.
// Never touches tools/simulate.js, which has no frame timing to begin with.
const BATTLE_SPEEDS = [1, 2, 3];

export function getBattleSpeed() {
  const s = read().battleSpeed;
  return BATTLE_SPEEDS.includes(s) ? s : 1;
}

export function cycleBattleSpeed() {
  const next = BATTLE_SPEEDS[(BATTLE_SPEEDS.indexOf(getBattleSpeed()) + 1) % BATTLE_SPEEDS.length];
  write({ battleSpeed: next });
  return next;
}
