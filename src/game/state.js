// ============================================================================
//  GAME STATE — party, inventory, gold, world flags, position, playtime.
// ============================================================================

import { createCharacter, fullRestore, clampVitals, stats, awardJobExp, jobRank } from './character.js';
import { getItem, isEquippable } from '../data/items.js';
import { getMap } from '../data/maps.js';
import { STAT_KEYS } from '../data/classes.js';
import { getJob } from '../data/jobs.js';
import { saveGame, loadGame } from '../engine/save.js';

export const MAX_PARTY = 4;
export const BASE_CARRY = 30;

export class GameState {
  constructor() {
    this.party = [];
    this.gold = 200;
    this.inventory = [];            // [{id, count}]
    this.flags = {};                // world flags: opened chests, defeated bosses
    this.mapId = 'wren';
    this.x = 12; this.y = 18;
    this.facing = 'down';
    this.playtime = 0;
    this.steps = 0;
    this.stepsSinceBattle = 0;
    this.encounterMod = 1;          // Hunter's Track ability
    this.bestiary = {};
    this.mapped = {};               // cartographer: mapId -> true
    this.slot = 1;
  }

  get map() { return getMap(this.mapId); }
  get leader() { return this.party[0]; }

  // --- party ---------------------------------------------------------------
  addMember(spec) {
    if (this.party.length >= MAX_PARTY) return null;
    const ch = createCharacter(spec);
    this.party.push(ch);
    this.autoFormation();
    return ch;
  }

  /**
   * Put melee at the front column and ranged/casters behind, then place each
   * member in the nearest free cell to their preferred column. Greedy rather
   * than nudging, so two members can never end up sharing a cell.
   */
  autoFormation() {
    const taken = new Set();
    const rowOrder = [1, 0, 2];
    for (const ch of this.party) {
      const s = stats(ch);
      const want = s.reach >= 9 ? 2 : s.reach === 3 ? 1 : 0;
      // try the preferred column first, then drift outward
      const cols = [want, ...[0, 1, 2].filter((c) => c !== want)
        .sort((a, b) => Math.abs(a - want) - Math.abs(b - want))];
      let placed = false;
      for (const col of cols) {
        for (const row of rowOrder) {
          const key = `${row},${col}`;
          if (taken.has(key)) continue;
          ch.grid.row = row; ch.grid.col = col;
          taken.add(key);
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
  }

  livingParty() { return this.party.filter((c) => c.hp > 0); }
  isWiped() { return this.livingParty().length === 0; }

  restParty() {
    for (const ch of this.party) fullRestore(ch);
  }

  // --- inventory -----------------------------------------------------------
  carryLimit() {
    const prov = this.party
      .filter((c) => c.jobId === 'provisioner')
      .reduce((m, c) => Math.max(m, jobRank(c)), 0);
    return BASE_CARRY + prov * 10;
  }

  addItem(id, count = 1) {
    getItem(id);
    const slot = this.inventory.find((i) => i.id === id);
    if (slot) { slot.count += count; return true; }
    if (this.inventory.length >= this.carryLimit()) return false;
    this.inventory.push({ id, count });
    return true;
  }

  removeItem(id, count = 1) {
    const i = this.inventory.findIndex((s) => s.id === id);
    if (i < 0) return false;
    this.inventory[i].count -= count;
    if (this.inventory[i].count <= 0) this.inventory.splice(i, 1);
    return true;
  }

  countItem(id) { return this.inventory.find((s) => s.id === id)?.count ?? 0; }

  itemsOfKind(kind) {
    return this.inventory.filter((s) => getItem(s.id).kind === kind);
  }

  usableInBattle() {
    return this.inventory.filter((s) => {
      const it = getItem(s.id);
      return it.kind === 'consumable' && !it.camp && !it.warpTown;
    });
  }

  equipmentFor(ch, slot) {
    return this.inventory.filter((s) => {
      const it = getItem(s.id);
      if (!isEquippable(it)) return false;
      const isl = it.slot ?? (it.kind === 'weapon' ? 'weapon' : null);
      return isl === slot;
    });
  }

  // --- economy -------------------------------------------------------------
  priceMod(buying) {
    const rank = this.party
      .filter((c) => c.jobId === 'merchant')
      .reduce((m, c) => Math.max(m, jobRank(c)), 0);
    if (!rank) return 1;
    return buying ? 1 - 0.08 * rank : 1 + 0.08 * rank;
  }

  buyPrice(id) { return Math.max(1, Math.round(getItem(id).price * this.priceMod(true))); }
  sellPrice(id) { return Math.max(1, Math.round(getItem(id).price * 0.5 * this.priceMod(false))); }

  innCost(base) {
    const prov = this.party
      .filter((c) => c.jobId === 'provisioner')
      .reduce((m, c) => Math.max(m, jobRank(c)), 0);
    const perHead = Math.round(base * (prov ? 0.8 : 1));
    return perHead * this.party.length;
  }

  spend(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  earn(amount) { this.gold = Math.min(9999999, this.gold + Math.max(0, amount)); }

  // --- jobs ----------------------------------------------------------------
  /** Award job exp for a field action, and to everyone for finishing a battle. */
  jobTick(ch, amount) {
    const r = awardJobExp(ch, amount);
    return r.rankUp ? `${ch.name} is now a rank ${r.rank} ${getJob(ch.jobId).name}!` : null;
  }

  jobTickAll(amount) {
    const msgs = [];
    for (const ch of this.party) {
      const m = this.jobTick(ch, amount);
      if (m) msgs.push(m);
    }
    return msgs;
  }

  /** Highest rank of `jobId` in the party, or 0 if nobody has it. */
  jobRankOf(jobId) {
    return this.party
      .filter((c) => c.jobId === jobId)
      .reduce((m, c) => Math.max(m, jobRank(c)), 0);
  }

  hasJob(jobId) { return this.jobRankOf(jobId) > 0; }

  // --- world ---------------------------------------------------------------
  setFlag(k, v = true) { this.flags[k] = v; }
  flag(k) { return !!this.flags[k]; }

  /** Encounter chance per step, modified by jobs and the Hunter's Track. */
  encounterChance() {
    const m = this.map;
    if (!m.encounter || !m.rate) return 0;
    let rate = m.rate * this.encounterMod;
    const scout = this.jobRankOf('scout');
    if (scout) rate *= 1 - 0.04 * scout;
    if (this.jobRankOf('fisher') && m.outdoor) rate *= 0.95;
    // a short grace period after each fight, so you are not chain-ambushed
    if (this.stepsSinceBattle < 6) return 0;
    return Math.min(0.25, rate);
  }

  stepTaken() {
    this.steps++;
    this.stepsSinceBattle++;
    // Verdant / Herbalist regeneration
    const herb = this.jobRankOf('herbalist');
    for (const ch of this.party) {
      if (ch.hp <= 0) continue;
      const s = stats(ch);
      let regen = 0;
      if (ch.elementId === 'nature' && this.map.outdoor) regen += Math.max(1, Math.floor(s.maxHp * 0.01));
      if (herb) regen += herb;
      if (regen) ch.hp = Math.min(s.maxHp, ch.hp + regen);
    }
  }

  // --- serialisation -------------------------------------------------------
  toJSON() {
    return {
      party: this.party.map((c) => ({
        id: c.id, name: c.name, classId: c.classId, elementId: c.elementId, jobId: c.jobId,
        level: c.level, exp: c.exp, acc: c.acc, jobExp: c.jobExp, equip: c.equip,
        grid: c.grid, ip: c.ip, statuses: c.statuses, hp: c.hp, mp: c.mp,
        classHistory: c.classHistory, skin: c.skin, hair: c.hair, alive: c.hp > 0,
      })),
      gold: this.gold,
      inventory: this.inventory,
      flags: this.flags,
      mapId: this.mapId,
      mapName: this.map.name,
      x: this.x, y: this.y, facing: this.facing,
      playtime: Math.round(this.playtime),
      steps: this.steps,
      bestiary: this.bestiary,
      mapped: this.mapped,
    };
  }

  static fromJSON(d) {
    const g = new GameState();
    g.party = (d.party ?? []).map((c) => {
      const ch = createCharacter({
        id: c.id, name: c.name, classId: c.classId,
        elementId: c.elementId, jobId: c.jobId, skin: c.skin, hair: c.hair,
      });
      ch.level = c.level ?? 1;
      ch.exp = c.exp ?? 0;
      for (const k of STAT_KEYS) ch.acc[k] = c.acc?.[k] ?? ch.acc[k];
      ch.jobExp = c.jobExp ?? 0;
      ch.equip = { weapon: null, offhand: null, body: null, head: null, accessory: null, ...(c.equip ?? {}) };
      ch.grid = c.grid ?? { row: 1, col: 0 };
      ch.ip = c.ip ?? 0;
      ch.statuses = c.statuses ?? {};
      ch.classHistory = c.classHistory ?? [c.classId];
      ch.hp = c.hp ?? 1;
      ch.mp = c.mp ?? 0;
      clampVitals(ch);
      return ch;
    });
    g.gold = d.gold ?? 0;
    g.inventory = d.inventory ?? [];
    g.flags = d.flags ?? {};
    g.mapId = d.mapId ?? 'wren';
    g.x = d.x ?? 12; g.y = d.y ?? 18;
    g.facing = d.facing ?? 'down';
    g.playtime = d.playtime ?? 0;
    g.steps = d.steps ?? 0;
    g.bestiary = d.bestiary ?? {};
    g.mapped = d.mapped ?? {};
    return g;
  }

  save(slot = this.slot) {
    this.slot = slot;
    return saveGame(slot, this.toJSON());
  }

  static load(slot) {
    const s = loadGame(slot);
    if (!s) return null;
    const g = GameState.fromJSON(s.data);
    g.slot = slot;
    return g;
  }
}

export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}
