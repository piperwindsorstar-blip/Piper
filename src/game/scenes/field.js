// ============================================================================
//  FIELD — walking the overworld, towns and dungeons.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Dialogue, Menu, hpColor } from '../../engine/ui.js';
import { tileSprite, heroSprite, npcSprite, TS } from '../../engine/sprites.js';
import {
  getMap, tileAt, isSolid, mapSize, warpAt, npcAt, chestAt, signAt, bossAt, SHOPS,
} from '../../data/maps.js';
import { formationsForRegion } from '../../data/enemies.js';
import { getItem } from '../../data/items.js';
import { stats, canPromote } from '../character.js';
import { getJob } from '../../data/jobs.js';
import { rng } from '../../engine/rng.js';

const STEP_TIME = 0.15;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export class FieldScene {
  constructor(app) { this.app = app; }

  enter(opts = {}) {
    this.g = this.app.game;
    this.dlg = new Dialogue();
    this.moving = null;
    this.stepT = 0;
    this.animT = 0;
    this.banner = 2.2;
    this.pendingWarp = null;
    this.fade = opts.fadeIn ? 1 : 0;
    this.fadeDir = opts.fadeIn ? -1 : 0;
    this.choice = null;
    this.encounterCooldown = 0;
    if (opts.message) this.dlg.say(opts.message);
    // returning from a battle we won on a boss tile
    if (opts.afterBossFlag) this.g.setFlag(opts.afterBossFlag);
  }

  get map() { return this.g.map; }

  // --- update --------------------------------------------------------------
  update(dt, input) {
    this.animT += dt;
    this.banner = Math.max(0, this.banner - dt);
    this.g.playtime += dt;
    this.dlg.update(dt);
    if (this.fadeDir) {
      this.fade = Math.max(0, Math.min(1, this.fade + this.fadeDir * dt * 3));
      if (this.fade === 0) this.fadeDir = 0;
      if (this.fade === 1 && this.fadeDir > 0) { this.fadeDir = 0; this.completeWarp(); }
      return;
    }

    if (this.choice) return this.updateChoice(input);

    if (this.dlg.active) {
      if (input.tap('confirm') || input.tap('cancel')) this.dlg.skipOrAdvance();
      return;
    }

    if (input.tap('menu')) { this.app.push('menu'); return; }

    if (this.moving) {
      this.stepT += dt;
      if (this.stepT >= STEP_TIME) {
        this.g.x = this.moving.tx;
        this.g.y = this.moving.ty;
        this.moving = null;
        this.stepT = 0;
        this.onArrive();
      }
      return;
    }

    if (input.tap('confirm')) { this.interact(); return; }

    // held direction walks continuously; a quick tap still takes one step
    let ax = input.axis();
    if (!ax.x && !ax.y) {
      const d = input.dir();
      ax = { x: d.x, y: d.y };
    }
    if (ax.x || ax.y) {
      const dir = ax.x ? (ax.x < 0 ? 'left' : 'right') : (ax.y < 0 ? 'up' : 'down');
      this.g.facing = dir;
      const [dx, dy] = DIRS[dir];
      const tx = this.g.x + dx, ty = this.g.y + dy;
      if (!this.blocked(tx, ty)) { this.moving = { tx, ty, dir }; this.stepT = 0; }
    }
  }

  blocked(x, y) {
    const m = this.map;
    const { w, h } = mapSize(m);
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    if (isSolid(m, x, y)) return true;
    if (npcAt(m, x, y)) return true;
    const c = chestAt(m, x, y);
    if (c && !this.g.flag(`chest.${c.id}`)) return true;
    return false;
  }

  onArrive() {
    this.g.stepTaken();
    const m = this.map;
    const wp = warpAt(m, this.g.x, this.g.y);
    if (wp) { this.pendingWarp = wp; this.fadeDir = 1; return; }

    const boss = bossAt(m, this.g.x, this.g.y);
    if (boss && !this.g.flag(`boss.${boss.flag}`)) {
      if (boss.requires && !this.g.flag(`boss.${boss.requires}`)) {
        this.dlg.say('The way is sealed. Something further in has not been dealt with.');
        return;
      }
      this.dlg.say(boss.intro);
      this.pendingBoss = boss;
      this.dlg.queue.push({ text: '__BOSS__', speaker: null });
      return;
    }

    if (this.encounterCooldown > 0) { this.encounterCooldown -= 1; return; }
    const chance = this.g.encounterChance();
    if (chance > 0 && rng.chance(chance)) this.startEncounter();
  }

  startEncounter() {
    const m = this.map;
    const pool = formationsForRegion(m.encounter);
    if (!pool.length) return;
    const f = rng.pick(pool);
    const scout = this.g.jobRankOf('scout');
    const preemptive = rng.chance(Math.min(0.5, 0.06 + 0.08 * scout));
    const ambushed = !preemptive && scout < 5 && rng.chance(0.06);
    this.g.stepsSinceBattle = 0;
    this.app.push('battle', { formationId: f.id, preemptive, ambushed });
  }

  // --- interaction ---------------------------------------------------------
  interact() {
    const m = this.map;
    const [dx, dy] = DIRS[this.g.facing];
    const x = this.g.x + dx, y = this.g.y + dy;

    const sign = signAt(m, x, y);
    if (sign) { this.dlg.say(sign.text); return; }

    const chest = chestAt(m, x, y) ?? chestAt(m, this.g.x, this.g.y);
    if (chest && !this.g.flag(`chest.${chest.id}`)) { this.openChest(chest); return; }

    const npc = npcAt(m, x, y);
    if (npc) { this.talkTo(npc); return; }

    // standing on the exit of a town
    const wp = warpAt(m, this.g.x, this.g.y);
    if (wp) { this.pendingWarp = wp; this.fadeDir = 1; }
  }

  openChest(chest) {
    const locked = chest.locked && !this.g.hasJob('locksmith');
    if (locked) { this.dlg.say('Locked. A Locksmith could open this.'); return; }
    this.g.setFlag(`chest.${chest.id}`);
    if (chest.gold) {
      this.g.earn(chest.gold);
      this.dlg.say(`${chest.gold} gold.`);
    } else if (chest.item) {
      const it = getItem(chest.item);
      if (this.g.addItem(chest.item)) this.dlg.say(`Found ${it.name}.`);
      else { this.g.setFlag(`chest.${chest.id}`, false); this.dlg.say('The pack is full.'); }
    }
    if (chest.locked) {
      const smith = this.g.party.find((c) => c.jobId === 'locksmith');
      if (smith) { const m = this.g.jobTick(smith, 12); if (m) this.dlg.say(m); }
    }
  }

  talkTo(npc) {
    switch (npc.kind) {
      case 'inn': {
        const cost = this.g.innCost(npc.cost ?? 10);
        this.choice = {
          title: `${npc.name}: "${cost} gold for the night."`,
          options: ['Rest', 'Not now'],
          onPick: (i) => {
            if (i !== 0) { this.dlg.say('"Come back when you\'re tired enough."'); return; }
            if (!this.g.spend(cost)) { this.dlg.say('"You are short."'); return; }
            this.g.restParty();
            this.dlg.say('The party sleeps. Everyone wakes whole.');
            const chef = this.g.party.find((c) => c.jobId === 'chef');
            if (chef) { const m = this.g.jobTick(chef, 8); if (m) this.dlg.say(m); }
          },
        };
        break;
      }
      case 'temple': {
        const fallen = this.g.party.filter((c) => c.hp <= 0);
        const promo = this.g.party.filter((c) => canPromote(c));
        const opts = [];
        if (promo.length) opts.push('Take a promotion');
        if (fallen.length) opts.push(`Revive the fallen (${this.reviveCost()}G)`);
        opts.push('Leave');
        this.choice = {
          title: `${npc.name}: "${npc.text}"`,
          options: opts,
          onPick: (i) => {
            const pick = opts[i];
            if (pick === 'Take a promotion') this.app.push('promotion');
            else if (pick && pick.startsWith('Revive')) {
              const cost = this.reviveCost();
              if (!this.g.spend(cost)) { this.dlg.say('"Not enough. The rite is not free."'); return; }
              for (const c of this.g.party) if (c.hp <= 0) { c.hp = stats(c).maxHp; c.alive = true; c.statuses = {}; }
              this.dlg.say('The fallen open their eyes.');
              const pil = this.g.party.find((c) => c.jobId === 'pilgrim');
              if (pil) { const m = this.g.jobTick(pil, 15); if (m) this.dlg.say(m); }
            }
          },
        };
        break;
      }
      case 'shop':
        this.app.push('shop', { shopId: npc.shop, name: SHOPS[npc.shop]?.name ?? npc.name });
        break;
      case 'guild':
        this.dlg.say(npc.text, npc.name);
        this.dlg.say('(Open the party menu with C or TAB for Formation, Jobs and the class ladder.)');
        break;
      default:
        this.dlg.say(npc.text, npc.name);
    }
  }

  reviveCost() {
    const fallen = this.g.party.filter((c) => c.hp <= 0);
    const rank = this.g.jobRankOf('pilgrim');
    const base = fallen.reduce((s, c) => s + c.level * 22, 0);
    return Math.max(10, Math.round(base * (1 - 0.3 * rank / 5 * 5 / 5) * (rank ? 1 - 0.3 * rank / 5 : 1)));
  }

  updateChoice(input) {
    if (!this.choiceMenu) {
      this.choiceMenu = new Menu({
        items: this.choice.options, x: 22, y: 0, cellW: 200, cellH: 12,
        rows: this.choice.options.length,
      });
    }
    this.choiceMenu.update(1 / 60);
    this.choiceMenu.handle(input);
    if (input.tap('confirm')) {
      const i = this.choiceMenu.index;
      const cb = this.choice.onPick;
      this.choice = null; this.choiceMenu = null;
      cb?.(i);
    } else if (input.tap('cancel')) {
      this.choice = null; this.choiceMenu = null;
    }
  }

  completeWarp() {
    const wp = this.pendingWarp;
    this.pendingWarp = null;
    if (!wp) return;
    this.g.mapId = wp.to;
    this.g.x = wp.tx;
    this.g.y = wp.ty;
    this.g.stepsSinceBattle = 0;
    this.encounterCooldown = 3;
    this.banner = 2.2;
    this.fade = 1;
    this.fadeDir = -1;
    const cart = this.g.party.find((c) => c.jobId === 'cartographer');
    if (cart && !this.g.mapped[wp.to]) {
      this.g.mapped[wp.to] = true;
      const m = this.g.jobTick(cart, 10);
      if (m) this.dlg.say(m);
    }
  }

  /** The scene stack calls this when a pushed scene pops back to us. */
  onResume(result) {
    if (result?.outcome) this.onBattleResult(result);
  }

  // called by the app when a battle finishes
  onBattleResult(result) {
    if (result.outcome === 'defeat') {
      this.app.replace('gameover');
      return;
    }
    this.g.stepsSinceBattle = 0;
    this.encounterCooldown = 4;
    if (result.bossFlag) this.g.setFlag(`boss.${result.bossFlag}`);
    if (result.messages?.length) this.dlg.sayAll(result.messages);
  }

  // --- draw ----------------------------------------------------------------
  camera() {
    const { w, h } = mapSize(this.map);
    const px = this.playerPixel();
    let cx = px.x + TS / 2 - W / 2;
    let cy = px.y + TS / 2 - H / 2;
    cx = w * TS <= W ? (w * TS - W) / 2 : Math.max(0, Math.min(cx, w * TS - W));
    cy = h * TS <= H ? (h * TS - H) / 2 : Math.max(0, Math.min(cy, h * TS - H));
    return { x: Math.round(cx), y: Math.round(cy) };
  }

  playerPixel() {
    if (!this.moving) return { x: this.g.x * TS, y: this.g.y * TS };
    const t = Math.min(1, this.stepT / STEP_TIME);
    return {
      x: (this.g.x + (this.moving.tx - this.g.x) * t) * TS,
      y: (this.g.y + (this.moving.ty - this.g.y) * t) * TS,
    };
  }

  draw(scr) {
    const m = this.map;
    scr.clear(m.bg ?? '#101018');
    const cam = this.camera();
    const { w, h } = mapSize(m);

    const x0 = Math.max(0, Math.floor(cam.x / TS));
    const y0 = Math.max(0, Math.floor(cam.y / TS));
    const x1 = Math.min(w - 1, Math.ceil((cam.x + W) / TS));
    const y1 = Math.min(h - 1, Math.ceil((cam.y + H) / TS));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = tileAt(m, x, y);
        if (!t) continue;
        const px = x * TS - cam.x, py = y * TS - cam.y;
        scr.ctx.drawImage(tileSprite(tileVariant(m, x, y, t.tile)), px, py);
        if (t.water) drawShore(scr, m, x, y, px, py);
      }
    }

    // chests still closed
    for (const c of m.chests ?? []) {
      if (this.g.flag(`chest.${c.id}`)) continue;
      scr.ctx.drawImage(tileSprite('chest'), c.x * TS - cam.x, c.y * TS - cam.y);
    }

    // NPCs
    for (const n of m.npcs ?? []) {
      const px = n.x * TS - cam.x, py = n.y * TS - cam.y;
      if (px < -TS || py < -TS || px > W || py > H) continue;
      drawNpc(scr, px, py, n, this.animT);
    }

    // boss markers
    for (const key of ['boss', 'boss2']) {
      const b = m[key];
      if (!b || this.g.flag(`boss.${b.flag}`)) continue;
      const px = b.x * TS - cam.x, py = b.y * TS - cam.y;
      const pulse = 0.5 + 0.5 * Math.sin(this.animT * 3);
      scr.rect(px + 3, py + 3, 10, 10, `rgba(200,40,60,${(0.35 + pulse * 0.4).toFixed(2)})`);
      scr.outline(px + 2, py + 2, 12, 12, PAL.red);
    }

    // player
    const px = this.playerPixel();
    const cv = heroSprite({
      classId: this.g.leader.classId, elementId: this.g.leader.elementId,
      skin: this.g.leader.skin, hair: this.g.leader.hair,
      frame: this.moving ? (Math.floor(this.animT * 8) % 2) : 0,
    });
    scr.ctx.drawImage(cv, Math.round(px.x - cam.x - (cv.width - TS) / 2), Math.round(px.y - cam.y - (cv.height - TS) - 2));

    this.drawHud(scr);
    if (this.banner > 0) this.drawBanner(scr);
    if (this.choice) this.drawChoice(scr);
    else this.dlg.draw(scr);
    if (this.fade > 0) scr.fade(this.fade);
  }

  drawHud(scr) {
    const g = this.g;
    const rows = g.party.length;
    const hh = 10 + rows * 13;
    scr.window(W - 88, 4, 84, hh, { alpha: 0.92 });
    g.party.forEach((ch, i) => {
      const y = 9 + i * 13;
      const s = stats(ch);
      const ratio = ch.hp / s.maxHp;
      scr.text(ch.name.slice(0, 7), W - 82, y, ch.hp > 0 ? PAL.text : PAL.grey, { size: 8 });
      scr.bar(W - 40, y + 1, 32, 5, ratio, hpColor(ratio));
      scr.bar(W - 40, y + 7, 32, 3, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
    });
    scr.window(4, H - 22, 92, 18, { alpha: 0.92 });
    scr.text(`${g.gold}G`, 10, H - 17, PAL.gold);
    scr.textRight(`Lv${g.leader.level}`, 92, H - 17, PAL.text);
  }

  drawBanner(scr) {
    const a = Math.min(1, this.banner / 0.5);
    scr.ctx.globalAlpha = a;
    const name = this.map.name;
    const w = Math.max(90, name.length * 6 + 24);
    scr.window(W / 2 - w / 2, 8, w, 20);
    scr.textCenter(name, W / 2, 14, PAL.gold);
    scr.ctx.globalAlpha = 1;
  }

  drawChoice(scr) {
    const opts = this.choice.options;
    const h = 22 + opts.length * 12;
    const y = H - h - 6;
    scr.window(6, y - 30, W - 12, 30);
    scr.textWrap(this.choice.title, 14, y - 23, W - 28, PAL.text, { maxLines: 2, lineHeight: 10 });
    scr.window(6, y, W - 12, h);
    if (this.choiceMenu) {
      this.choiceMenu.x = 24; this.choiceMenu.y = y + 8;
      this.choiceMenu.draw(scr);
    }
  }
}

const charAt = (m, x, y) => (m.tiles[y]?.[x]) ?? null;

/**
 * Pick a continuation variant from a tile's neighbours: a mountain flanked by
 * mountains becomes ridge, a tree with a tree above it becomes closed canopy.
 */
function tileVariant(m, x, y, name) {
  if (name === 'mountain') {
    const up = charAt(m, x, y - 1) === '^';
    const l = charAt(m, x - 1, y) === '^', r = charAt(m, x + 1, y) === '^';
    if (up) return 'rock';                 // buried inside the mass: no skyline
    return l && r ? 'ridge' : 'mountain';
  }
  if (name === 'tree') {
    return charAt(m, x, y - 1) === 'T' ? 'forest' : 'tree';
  }
  return name;
}

/** Lay a sand lip along each edge of a water tile that meets land. */
function drawShore(scr, m, x, y, px, py) {
  const isWater = (dx, dy) => {
    const t = tileAt(m, x + dx, y + dy);
    return !t || t.water;
  };
  const c = scr.ctx;
  const lip = tileSprite('shore');
  const put = (rot) => {
    c.save();
    c.translate(px + TS / 2, py + TS / 2);
    c.rotate(rot);
    c.drawImage(lip, -TS / 2, -TS / 2);
    c.restore();
  };
  if (!isWater(0, -1)) put(0);
  if (!isWater(1, 0)) put(Math.PI / 2);
  if (!isWater(0, 1)) put(Math.PI);
  if (!isWater(-1, 0)) put(-Math.PI / 2);
}

function drawNpc(scr, x, y, npc, t) {
  // a slow two-frame idle, offset per NPC so a street does not breathe in unison
  const frame = Math.floor(t * 1.6 + npc.x * 0.7 + npc.y * 0.3) % 2;
  const cv = npcSprite(npc.kind, (npc.x + npc.y) % 4, frame);
  scr.ctx.drawImage(cv, Math.round(x + (TS - cv.width) / 2), Math.round(y + TS - cv.height));
  // a small marker over service NPCs
  if (npc.kind !== 'talk') {
    const g = { shop: '$', inn: 'Z', temple: '+', guild: '!' }[npc.kind] ?? '';
    scr.text(g, x + 6, y - 7 + Math.round(Math.sin(t * 3)), PAL.gold);
  }
}
