// ============================================================================
//  CHARACTER — the point where class, element and job meet.
//
//  A character's stats are the sum of four independent contributions:
//
//    BASE      a flat starting allowance, identical for everyone
//    GROWTH    accumulated per-level gains from whichever class node they held
//              at the time (so a promotion changes future levels, not past ones)
//    ELEMENT   a permanent bias chosen at creation, never changes
//    JOB       a rank-scaled bonus that grows with job use, not level
//    EQUIP     gear
//
//  Because GROWTH is accumulated as it is earned, the class tree genuinely
//  matters: promoting late means levels spent growing at the lower rate.
// ============================================================================

import { STAT_KEYS, getClass, pendingPromotion, PROMOTION_BONUS, classLineage } from '../data/classes.js';
import { ELEMENT_BY_ID } from '../data/elements.js';
import { getJob, jobBonus, jobRankFromExp, jobAffinityBonus, JOB_RANK_EXP, MAX_JOB_RANK } from '../data/jobs.js';
import { skillsForSchools, getSkill, STATUS } from '../data/skills.js';
import { getItem, canEquip, WEAPON_TYPES } from '../data/items.js';

export const BASE_STATS = { hp: 34, mp: 8, str: 8, vit: 8, agi: 8, int: 8, spr: 8, lck: 8 };
export const MAX_LEVEL = 60;

/** Cumulative EXP required to reach `level`. */
export function expForLevel(level) {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 2; l <= level; l++) total += Math.floor(16 * Math.pow(l - 1, 1.85) + 8 * (l - 1));
  return total;
}

export function createCharacter(o) {
  const cls = getClass(o.classId);
  const ch = {
    id: o.id ?? `pc_${Math.random().toString(36).slice(2, 9)}`,
    name: o.name ?? 'Hero',
    classId: o.classId,
    elementId: o.elementId,
    jobId: o.jobId,
    level: 1,
    exp: 0,
    acc: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
    jobExp: 0,
    equip: { weapon: null, offhand: null, body: null, head: null, accessory: null },
    grid: { row: o.row ?? 1, col: o.col ?? 0 },
    ip: 0,
    statuses: {},
    hp: 0, mp: 0,
    classHistory: [o.classId],
    pendingPromo: null,
    skin: o.skin ?? 0,
    hair: o.hair ?? 0,
    alive: true,
  };
  // level 1 already banks one application of growth so classes differ from the start
  for (const k of STAT_KEYS) ch.acc[k] = cls.growth[k];
  if (o.level && o.level > 1) grantLevels(ch, o.level - 1);
  const s = stats(ch);
  ch.hp = s.maxHp;
  ch.mp = s.maxMp;
  return ch;
}

// ---------------------------------------------------------------------------
//  STATS
// ---------------------------------------------------------------------------
export function stats(ch) {
  const out = {};
  const el = ELEMENT_BY_ID[ch.elementId];
  const jb = jobBonus(ch.jobId, jobRank(ch));

  for (const k of STAT_KEYS) {
    out[k] = BASE_STATS[k] + Math.floor(ch.acc[k]) + (el?.bias?.[k] ?? 0) + (jb[k] ?? 0);
  }

  // equipment
  let atk = 0, def = 0, reach = 2;
  for (const slot of Object.keys(ch.equip)) {
    const id = ch.equip[slot];
    if (!id) continue;
    const it = getItem(id);
    if (it.atk) atk += it.atk;
    if (it.def) def += it.def;
    if (it.bonus) for (const [k, v] of Object.entries(it.bonus)) out[k] = (out[k] ?? 0) + v;
    if (slot === 'weapon' && it.reach) reach = it.reach;
  }

  for (const k of STAT_KEYS) out[k] = Math.max(1, out[k]);

  out.maxHp = Math.max(1, out.hp);
  out.maxMp = Math.max(0, out.mp);
  out.atk = atk;
  out.def = def;
  out.reach = reach;

  // derived combat numbers
  const w = ch.equip.weapon ? getItem(ch.equip.weapon) : null;
  const wstat = w ? WEAPON_TYPES[w.wtype].stat : 'str';
  out.power = Math.floor(out[wstat] * 1.5 + atk * 2);            // physical damage base
  out.magic = Math.floor(out.int * 1.6 + (atk * 0.4));           // magical damage base
  out.armor = Math.floor(out.vit * 1.1 + def * 1.8);             // physical mitigation
  out.ward = Math.floor(out.spr * 1.2 + def * 0.8);              // magical mitigation
  out.speed = out.agi;
  out.crit = Math.min(0.5, 0.03 + out.lck * 0.0035 + (el?.id === 'metal' ? 0.05 : 0));
  out.evade = Math.min(0.45, 0.02 + out.agi * 0.0025 + (el?.id === 'wind' ? 0.10 : 0));
  out.element = ch.elementId;
  return out;
}

export function statSummary(ch) {
  const s = stats(ch);
  return { hp: s.maxHp, mp: s.maxMp, str: s.str, vit: s.vit, agi: s.agi, int: s.int, spr: s.spr, lck: s.lck };
}

// ---------------------------------------------------------------------------
//  LEVELLING & PROMOTION
// ---------------------------------------------------------------------------

/** Apply `n` level-ups using the CURRENT class's growth. Returns the gains. */
export function grantLevels(ch, n) {
  const cls = getClass(ch.classId);
  const gained = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
  for (let i = 0; i < n && ch.level < MAX_LEVEL; i++) {
    ch.level++;
    for (const k of STAT_KEYS) {
      const before = Math.floor(ch.acc[k]);
      ch.acc[k] += cls.growth[k];
      gained[k] += Math.floor(ch.acc[k]) - before;
    }
  }
  refreshPromotion(ch);
  return gained;
}

/**
 * Award EXP. Returns {levels, gained, promo} where `promo` is a pending
 * promotion the UI must resolve (branching promotions need a player choice).
 */
export function awardExp(ch, amount) {
  if (!ch.alive && ch.hp <= 0) amount = Math.floor(amount * 0.5); // KO'd members still learn, slowly
  ch.exp += Math.max(0, Math.floor(amount));
  let levels = 0;
  const gained = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
  while (ch.level < MAX_LEVEL && ch.exp >= expForLevel(ch.level + 1)) {
    const g = grantLevels(ch, 1);
    for (const k of STAT_KEYS) gained[k] += g[k];
    levels++;
  }
  if (levels) {
    // level-ups top the character up, DQ style
    const s = stats(ch);
    ch.hp = Math.min(s.maxHp, ch.hp + gained.hp);
    ch.mp = Math.min(s.maxMp, ch.mp + gained.mp);
  }
  return { levels, gained, promo: ch.pendingPromo };
}

export function refreshPromotion(ch) {
  ch.pendingPromo = pendingPromotion(ch.classId, ch.level);
  return ch.pendingPromo;
}

export function canPromote(ch) {
  return !!refreshPromotion(ch);
}

/**
 * Commit a promotion. `toId` must be one of the pending promotion's choices;
 * for a linear (non-branching) promotion it may be omitted.
 */
export function promote(ch, toId = null) {
  const promo = refreshPromotion(ch);
  if (!promo) return null;
  const target = toId ?? promo.choices[0].id;
  if (!promo.choices.some((c) => c.id === target)) {
    throw new Error(`${target} is not a valid promotion from ${ch.classId}`);
  }
  const bonus = PROMOTION_BONUS[promo.tier];
  for (const k of STAT_KEYS) ch.acc[k] += bonus[k] ?? 0;
  ch.classId = target;
  ch.classHistory.push(target);
  const s = stats(ch);
  ch.hp = s.maxHp;      // promotions are a full restore, like a DQ class change
  ch.mp = s.maxMp;
  refreshPromotion(ch);
  return { to: getClass(target), bonus, tier: promo.tier };
}

/** The full ladder from root to here, with which nodes were actually taken. */
export function promotionPath(ch) {
  return classLineage(ch.classId).map((id) => ({
    ...getClass(id),
    taken: ch.classHistory.includes(id),
  }));
}

// ---------------------------------------------------------------------------
//  SKILLS
// ---------------------------------------------------------------------------
export function knownSkills(ch) {
  const cls = getClass(ch.classId);
  return skillsForSchools(cls.schools, ch.level);
}

export function usableSkills(ch) {
  const s = stats(ch);
  return knownSkills(ch).filter((k) => {
    if (ch.statuses.silence && ['mag', 'heal', 'buff', 'debuff'].includes(k.type)) return false;
    if (ch.statuses.fear && k.school === 'arcane') return false;
    if (k.mp > ch.mp) return false;
    if (k.ip && ch.ip < k.ip) return false;
    if (k.hpCost && ch.hp <= Math.floor(s.maxHp * k.hpCost)) return false;
    return true;
  });
}

/** Skills the character will unlock in the next few levels — used by the UI. */
export function upcomingSkills(ch, within = 6) {
  const cls = getClass(ch.classId);
  return skillsForSchools(cls.schools, ch.level + within)
    .filter((k) => k.lv > ch.level)
    .sort((a, b) => a.lv - b.lv);
}

/** Resolve a skill's element for this caster ('attuned' means "the caster's"). */
export function skillElement(ch, skill) {
  if (skill.element === 'attuned') return ch.elementId;
  return skill.element ?? 'none';
}

// ---------------------------------------------------------------------------
//  JOBS
// ---------------------------------------------------------------------------
export function jobRank(ch) { return jobRankFromExp(ch.jobExp); }

export function awardJobExp(ch, amount) {
  const before = jobRank(ch);
  ch.jobExp += Math.round(amount * jobAffinityBonus(ch.jobId, ch.elementId));
  const after = jobRank(ch);
  return after > before ? { rankUp: true, rank: after } : { rankUp: false, rank: after };
}

export function jobProgress(ch) {
  const rank = jobRank(ch);
  if (rank >= MAX_JOB_RANK) return { rank, ratio: 1, next: null };
  const floor = JOB_RANK_EXP[rank - 1];
  const ceil = JOB_RANK_EXP[rank];
  return { rank, ratio: (ch.jobExp - floor) / (ceil - floor), next: ceil - ch.jobExp };
}

export function jobInfo(ch) {
  const j = getJob(ch.jobId);
  const rank = jobRank(ch);
  return { ...j, rank, bonus: jobBonus(ch.jobId, rank) };
}

// ---------------------------------------------------------------------------
//  EQUIPMENT
// ---------------------------------------------------------------------------
export function equipItem(ch, itemId) {
  const item = getItem(itemId);
  const cls = getClass(ch.classId);
  if (!canEquip(cls, item)) return { ok: false, reason: `${cls.name} cannot equip that.` };
  const slot = item.slot ?? (item.kind === 'weapon' ? 'weapon' : null);
  if (!slot) return { ok: false, reason: 'Not equipment.' };
  const prev = ch.equip[slot];
  ch.equip[slot] = itemId;
  clampVitals(ch);
  return { ok: true, slot, removed: prev };
}

export function unequipSlot(ch, slot) {
  const prev = ch.equip[slot];
  ch.equip[slot] = null;
  clampVitals(ch);
  return prev;
}

export function clampVitals(ch) {
  const s = stats(ch);
  ch.hp = Math.max(0, Math.min(ch.hp, s.maxHp));
  ch.mp = Math.max(0, Math.min(ch.mp, s.maxMp));
  ch.alive = ch.hp > 0;
}

// ---------------------------------------------------------------------------
//  STATUS
// ---------------------------------------------------------------------------
export function applyStatus(ch, id, turns = null) {
  const def = STATUS[id];
  if (!def) return false;
  if (id === 'poison' && ch.elementId === 'poison') return false;   // Virulence
  let t = turns ?? def.turns;
  if (def.kind === 'bad' && ch.elementId === 'poison' && ['poison', 'burn'].includes(id)) t += 2;
  ch.statuses[id] = Math.max(ch.statuses[id] ?? 0, t);
  return true;
}

export function clearStatus(ch, id) { delete ch.statuses[id]; }

export function clearBadStatuses(ch) {
  for (const id of Object.keys(ch.statuses)) {
    if (STATUS[id]?.kind === 'bad') delete ch.statuses[id];
  }
}

export function tickStatuses(ch) {
  const log = [];
  const s = stats(ch);
  for (const id of Object.keys(ch.statuses)) {
    if (id === 'poison') { const d = Math.max(1, Math.floor(s.maxHp * 0.08)); ch.hp -= d; log.push(`${ch.name} takes ${d} from poison.`); }
    if (id === 'burn') { const d = Math.max(1, Math.floor(s.maxHp * 0.06)); ch.hp -= d; log.push(`${ch.name} takes ${d} from burns.`); }
    if (id === 'regen') { const h = Math.max(1, Math.floor(s.maxHp * 0.07)); ch.hp = Math.min(s.maxHp, ch.hp + h); log.push(`${ch.name} recovers ${h}.`); }
    if (id === 'doom') {
      ch.statuses[id] -= 1;
      if (ch.statuses[id] <= 0) { ch.hp = 0; log.push(`${ch.name} falls as the count reaches zero.`); }
      continue;
    }
    ch.statuses[id] -= 1;
    if (ch.statuses[id] <= 0) delete ch.statuses[id];
  }
  if (ch.hp <= 0) { ch.hp = 0; ch.alive = false; }
  return log;
}

export function canAct(ch) {
  if (!ch.alive || ch.hp <= 0) return false;
  if (ch.statuses.sleep || ch.statuses.freeze || ch.statuses.stone) return false;
  if (ch.statuses.paralyze && (ch.statuses.paralyze % 2 === 0)) return false;
  return true;
}

// ---------------------------------------------------------------------------
//  REST / RECOVERY
// ---------------------------------------------------------------------------
export function fullRestore(ch) {
  const s = stats(ch);
  ch.hp = s.maxHp;
  ch.mp = s.maxMp;
  ch.alive = true;
  ch.statuses = {};
  ch.ip = 0;
}

export function revive(ch, ratio = 0.5) {
  if (ch.alive && ch.hp > 0) return false;
  const s = stats(ch);
  const full = ch.elementId === 'light';    // Radiance
  ch.hp = full ? s.maxHp : Math.max(1, Math.floor(s.maxHp * ratio));
  ch.alive = true;
  delete ch.statuses.doom;
  return true;
}
