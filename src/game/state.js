// ============================================================================
//  GAME STATE — party, inventory, gold, world flags, position, playtime.
// ============================================================================

import { createCharacter, fullRestore, clampVitals, stats, awardJobExp, jobRank } from './character.js';
import { getItem, isEquippable } from '../data/items.js';
import { getMap } from '../data/maps.js';
import { STAT_KEYS } from '../data/classes.js';
import { getJob } from '../data/jobs.js';
import { saveGame, loadGame } from '../engine/save.js';

// Octopath-style line: 4 rows down the right side, 2 columns (front / back).
export const GRID_ROWS = 4;
export const GRID_COLS = 2;
export const STARTING_PARTY = 4;
export const MAX_PARTY = 8;
export const MAX_ROSTER = 24;

export class GameState {
  constructor() {
    this.roster = [];               // everyone ever recruited (superset of party)
    this.party = [];                // the active battle formation, up to MAX_PARTY
    this.gold = 200;
    this.inventory = [];            // [{id, count}]
    this.flags = {};                // world flags: opened chests, defeated bosses
    this.mapId = 'wren';
    this.lastTownId = 'wren';       // wingfeather warps here — see field.js's enter/completeWarp
    this.x = 12; this.y = 18;
    this.facing = 'down';
    this.playtime = 0;
    this.steps = 0;
    this.stepsSinceBattle = 0;
    this.encounterMod = 1;          // Hunter's Track ability
    this.bestiary = {};
    this.mapped = {};               // cartographer: mapId -> true
    this.visitedMaps = {};          // every mapId the field scene has ever entered
    this.difficulty = 'normal';     // data/difficulty.js — chosen once at creation
    this.ngPlus = 0;                // New Game+ cycles completed — see startNewGamePlus
    this.deepestDepth = 0;          // best floor ever reached in the Shifting Depths
    this.slot = 1;
    this.companion = null;          // a Tamer's catch — { enemyId } — see data/jobs.js's tamer
  }

  get map() { return getMap(this.mapId); }
  get leader() { return this.party[0]; }

  // --- party ---------------------------------------------------------------
  /**
   * Adds a new character to the roster, and to the active battle party too
   * while there's room (so creation's initial members behave exactly as
   * before). A recruit met after the party is full joins the roster on the
   * bench, swappable in later via `benchSwap` — this is what lets the
   * roster grow well past the 4-wide battle formation without touching
   * combat balance or layout.
   */
  addMember(spec) {
    if (this.roster.length >= MAX_ROSTER) return null;
    const ch = createCharacter(spec);
    this.roster.push(ch);
    if (this.party.length < MAX_PARTY) {
      this.party.push(ch);
      this.autoFormation();
    }
    return ch;
  }

  /** Roster members not currently in the active battle party. */
  benched() { return this.roster.filter((c) => !this.party.includes(c)); }

  /** Bring a benched roster member into the active party at a grid cell —
   *  swapping out whoever's there, or taking a free slot if the party
   *  isn't full and the cell is empty. The DQ3-tavern-swap equivalent. */
  benchInto(benchedId, row, col) {
    const benched = this.roster.find((c) => c.id === benchedId);
    if (!benched || this.party.includes(benched)) return false;
    const occIdx = this.party.findIndex((c) => c.grid.row === row && c.grid.col === col);
    if (occIdx >= 0) {
      benched.grid = { ...this.party[occIdx].grid };
      this.party[occIdx] = benched;
    } else if (this.party.length < MAX_PARTY) {
      benched.grid = { row, col };
      this.party.push(benched);
    } else {
      return false;
    }
    return true;
  }

  /**
   * Put melee at the front column and ranged/casters behind, then place each
   * member in the nearest free cell to their preferred column. Greedy rather
   * than nudging, so two members can never end up sharing a cell.
   */
  autoFormation() {
    const taken = new Set();
    const rowOrder = [0, 1, 2, 3];
    for (const ch of this.party) {
      const s = stats(ch);
      const want = s.reach >= 9 ? 1 : 0;
      const cols = [want, want === 0 ? 1 : 0];
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
  // No carry limit — the pack holds as many distinct stacks as the party
  // ever picks up. addItem() always succeeds; nothing needs to check its
  // return value for "pack full" anymore, but it still returns true for
  // callers that pre-date this and haven't been cleaned up.
  addItem(id, count = 1) {
    getItem(id);
    const slot = this.inventory.find((i) => i.id === id);
    if (slot) { slot.count += count; return true; }
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

  buyPrice(id) {
    // Herbalist's greenhands: "Antidotes are free" — flat, not rank-scaled.
    if (id === 'antidote' && this.jobRankOf('herbalist')) return 0;
    return Math.max(1, Math.round(getItem(id).price * this.priceMod(true)));
  }
  sellPrice(id) { return Math.max(1, Math.round(getItem(id).price * 0.5 * this.priceMod(false))); }

  innCost(base) {
    const prov = this.party
      .filter((c) => c.jobId === 'provisioner')
      .reduce((m, c) => Math.max(m, jobRank(c)), 0);
    // Used to be a flat 20% off from rank 1 on — now it climbs with rank
    // (4% per rank, the same 20% ceiling at max rank 5) so Deep Pack still
    // has something to grow into now that the carry limit it also used to
    // scale is gone entirely.
    const perHead = Math.round(base * (1 - 0.04 * prov));
    return perHead * this.party.length;
  }

  spend(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    return true;
  }

  /**
   * New Game+: roster, their levels/gear, gold, inventory, bestiary and
   * trophies all carry over untouched — only the story itself resets, so
   * the campaign plays again from the top rather than dropping the player
   * back at creation. Offered once the epilogue finishes (see field.js).
   * Battle scenes read `ngPlus` to scale enemies up further each cycle
   * (data/difficulty.js's own multiplier stacks on top, unchanged).
   */
  startNewGamePlus() {
    this.ngPlus += 1;
    this.flags = {};
    this.visitedMaps = {};
    this.mapped = {};
    this.mapId = 'wren';
    this.lastTownId = 'wren';
    this.x = 12; this.y = 18; this.facing = 'down';
    this.stepsSinceBattle = 0;
    for (const ch of this.roster) fullRestore(ch);
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

  /** A Tamer's catch replaces any earlier one — only one companion fights
   *  at a time, the "fifth grid cell" the job's own text promises, not a
   *  second roster. */
  setCompanion(enemyId) { this.companion = { enemyId }; }

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
      // greenhands: "1 HP per step outdoors per rank" — was healing indoors too.
      if (herb && this.map.outdoor) regen += herb;
      if (regen) ch.hp = Math.min(s.maxHp, ch.hp + regen);
    }
  }

  // --- serialisation -------------------------------------------------------
  toJSON() {
    return {
      roster: this.roster.map((c) => ({
        id: c.id, name: c.name, classId: c.classId, raceId: c.raceId,
        elementId: c.elementId, jobId: c.jobId,
        level: c.level, exp: c.exp, acc: c.acc, jobExp: c.jobExp, lp: c.lp, equip: c.equip,
        grid: c.grid, ip: c.ip, statuses: c.statuses, hp: c.hp, mp: c.mp,
        classHistory: c.classHistory, skin: c.skin, hair: c.hair, alive: c.hp > 0,
        runeProgress: c.runeProgress, scrollSkill: c.scrollSkill ?? null,
      })),
      partyIds: this.party.map((c) => c.id),
      gold: this.gold,
      inventory: this.inventory,
      flags: this.flags,
      mapId: this.mapId,
      lastTownId: this.lastTownId,
      mapName: this.map.name,
      x: this.x, y: this.y, facing: this.facing,
      playtime: Math.round(this.playtime),
      steps: this.steps,
      bestiary: this.bestiary,
      mapped: this.mapped,
      visitedMaps: this.visitedMaps,
      difficulty: this.difficulty,
      ngPlus: this.ngPlus,
      deepestDepth: this.deepestDepth,
      companion: this.companion,
    };
  }

  static fromJSON(d) {
    const g = new GameState();
    // pre-roster saves only ever had `party` (everyone was active, since
    // MAX_PARTY was the only cap) — treat that as the roster too
    const rosterData = d.roster ?? d.party ?? [];
    g.roster = rosterData.map((c) => {
      const ch = createCharacter({
        id: c.id, name: c.name, classId: c.classId, raceId: c.raceId ?? 'human',
        elementId: c.elementId, jobId: c.jobId, skin: c.skin, hair: c.hair,
      });
      ch.level = c.level ?? 1;
      ch.exp = c.exp ?? 0;
      for (const k of STAT_KEYS) ch.acc[k] = c.acc?.[k] ?? ch.acc[k];
      ch.jobExp = c.jobExp ?? 0;
      ch.runeProgress = c.runeProgress ?? {};
      if (c.scrollSkill) ch.scrollSkill = c.scrollSkill;
      // Learning Points used to be one pool shared across the whole roster
      // (`d.lp`); a save from before it became per-character had no `c.lp`
      // of its own, so every returning character picks up that old shared
      // total rather than starting back over at zero.
      ch.lp = c.lp ?? d.lp ?? 0;
      ch.equip = { weapon: null, offhand: null, body: null, head: null, accessory: null, rune: null, ...(c.equip ?? {}) };
      ch.grid = c.grid ?? { row: 1, col: 0 };
      ch.ip = c.ip ?? 0;
      ch.statuses = c.statuses ?? {};
      ch.classHistory = c.classHistory ?? [c.classId];
      ch.hp = c.hp ?? 1;
      ch.mp = c.mp ?? 0;
      clampVitals(ch);
      return ch;
    });
    g.party = d.partyIds
      ? d.partyIds.map((id) => g.roster.find((c) => c.id === id)).filter(Boolean)
      : g.roster.slice(0, MAX_PARTY);
    g.gold = d.gold ?? 0;
    g.inventory = d.inventory ?? [];
    g.flags = d.flags ?? {};
    g.mapId = d.mapId ?? 'wren';
    g.lastTownId = d.lastTownId ?? (getMap(g.mapId)?.town ? g.mapId : 'wren');
    g.x = d.x ?? 12; g.y = d.y ?? 18;
    g.facing = d.facing ?? 'down';
    g.playtime = d.playtime ?? 0;
    g.steps = d.steps ?? 0;
    g.bestiary = d.bestiary ?? {};
    g.mapped = d.mapped ?? {};
    g.visitedMaps = d.visitedMaps ?? {};
    g.difficulty = d.difficulty ?? 'normal';
    g.ngPlus = d.ngPlus ?? 0;
    g.deepestDepth = d.deepestDepth ?? 0;
    g.companion = d.companion ?? null;
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
