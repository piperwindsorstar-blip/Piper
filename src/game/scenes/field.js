// ============================================================================
//  FIELD — walking the overworld, towns and dungeons.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Dialogue, Menu, hpColor } from '../../engine/ui.js';
import { tileSprite, actorSprite, npcSprite, TS } from '../../engine/sprites.js';
import { groundSprite, massSprite, hasMass, isOutdoor } from '../../engine/terrain.js';
import { buildingSprite, hasStructure, isStructure } from '../../engine/building.js';
import { Particles } from '../../engine/particles.js';
import {
  getMap, tileAt, isSolid, mapSize, warpAt, npcAt, chestAt, signAt, bossAt, BOSS_SLOTS, SHOPS,
} from '../../data/maps.js';
import { formationsForRegion } from '../../data/enemies.js';
import { getItem } from '../../data/items.js';
import { stats, canPromote } from '../character.js';
import { getJob } from '../../data/jobs.js';
import { rng } from '../../engine/rng.js';
import { STORY } from '../../data/story.js';

const STEP_TIME = 0.15;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export class FieldScene {
  constructor(app) { this.app = app; }

  enter(opts = {}) {
    this.g = this.app.game;
    this.dlg = new Dialogue();
    this.fxp = new Particles(220);
    this.ambientT = 0;
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
    if (!this.g.flag('story.intro') && this.g.mapId === 'wren') {
      this.g.setFlag('story.intro');
      for (const line of STORY.intro) this.dlg.say(line);
    } else if (this.g.flag('boss.thirteenth') && !this.g.flag('story.epilogue')) {
      this.g.setFlag('story.epilogue');
      for (const line of STORY.epilogue) this.dlg.say(line);
    }
  }

  get map() { return this.g.map; }

  /** Look for the current map, driving grade, lights and ambient particles. */
  get look() {
    const m = this.map;
    if (m.town) return { grade: '#ffb46a', amount: 0.09, vignette: 0.40, motes: '#ffd9a0', warm: true };
    if (m.outdoor) return { grade: '#9ecdff', amount: 0.07, vignette: 0.36, motes: '#dff2ff' };
    if (m.encounter === 'abyss') return { grade: '#a06cff', amount: 0.22, vignette: 0.74, motes: '#c8a0ff', dark: true };
    return { grade: '#5a7cc0', amount: 0.17, vignette: 0.68, motes: '#9ab4e0', dark: true };
  }

  spawnAmbient(dt) {
    this.ambientT += dt;
    const rate = this.map.outdoor ? 0.10 : 0.16;
    while (this.ambientT > rate) {
      this.ambientT -= rate;
      const look = this.look;
      this.fxp.spawn({
        x: Math.random() * W, y: H * 0.15 + Math.random() * H * 0.8,
        vx: (Math.random() - 0.4) * 7, vy: -3 - Math.random() * 7,
        life: 2.4 + Math.random() * 2.4, color: look.motes, glow: true, size: 1,
      });
    }
  }

  // --- update --------------------------------------------------------------
  update(dt, input) {
    this.animT += dt;
    this.fxp.update(dt);
    this.spawnAmbient(dt);
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
      if (input.tap('confirm') || input.tap('cancel')) {
        const emptied = this.dlg.skipOrAdvance();
        if (emptied && this.pendingBoss) {
          const boss = this.pendingBoss;
          this.pendingBoss = null;
          this.app.push('battle', { formationId: boss.formation, bossFlag: boss.flag });
        }
      }
      return;
    }

    if (input.tap('menu')) { this.app.push('menu'); return; }

    if (this.moving) {
      this.stepT += dt;
      if (this.stepT >= STEP_TIME) {
        const cam = this.camera();
        this.fxp.dust(this.g.x * TS + TS / 2 - cam.x, this.g.y * TS + TS - 2 - cam.y,
          this.map.outdoor ? '#6a8a58' : '#7a7284', 3);
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
    const keenScent = this.g.party.some((c) => c.raceId === 'lupine');
    const preemptive = rng.chance(Math.min(0.5, 0.06 + 0.08 * scout + (keenScent ? 0.08 : 0)));
    const ambushed = !preemptive && scout < 5 && !keenScent && rng.chance(0.06);
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
      case 'recruit': {
        const flag = `story.recruited.${npc.id}`;
        if (this.g.flag(flag)) { this.dlg.say(npc.text, npc.name); break; }
        this.choice = {
          title: `${npc.name}: "${npc.hook}"`,
          options: ['Recruit', 'Not yet'],
          onPick: (i) => {
            if (i !== 0) { this.dlg.say('"The offer stands, whenever you\'re ready."', npc.name); return; }
            const ch = this.g.addMember(npc.recruit);
            this.g.setFlag(flag);
            if (!ch) { this.dlg.say('The roster has no room left.'); return; }
            if (this.g.party.includes(ch)) { this.dlg.say(`${ch.name} joins the party.`); return; }
            // The active party is already full (it always is, past creation's
            // starting four), so addMember() only benched them — ask right
            // here who to swap out instead of leaving a new recruit invisible
            // on the bench with no clear way to notice they exist.
            const party = this.g.party;
            this.choice = {
              title: `${ch.name} joins the roster. Who do they take the field for?`,
              options: [...party.map((p) => `${p.name} (Lv${p.level})`), "No one — bench them for now"],
              onPick: (j) => {
                if (j < party.length) {
                  const out = party[j];
                  this.g.benchInto(ch.id, out.grid.row, out.grid.col);
                  this.dlg.say(`${ch.name} takes the field for ${out.name}.`);
                } else {
                  this.dlg.say(`${ch.name} waits on the bench — swap them in anytime from the party menu's Formation page.`);
                }
              },
            };
          },
        };
        break;
      }
      default:
        this.dlg.say(this.reactionLine(npc), npc.name);
    }
  }

  /** An NPC's normal line, unless a `reactions` entry for an already-set
   *  boss flag names a different one — the minimal version of conditional
   *  dialogue this project needs, not a full branching-dialogue system. */
  reactionLine(npc) {
    if (npc.reactions) {
      for (const [flag, text] of Object.entries(npc.reactions)) {
        if (this.g.flag(`boss.${flag}`)) return text;
      }
    }
    return npc.text;
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
        items: this.choice.options, x: 44, y: 0, cellW: W - 100, cellH: 14,
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
    // The battle scene already showed the spoils, level-ups and drops in its own
    // message box. Replaying them here made you read every line twice.
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
    const look = this.look;
    scr.setGrade(look.grade, look.amount);
    scr.vignette = look.vignette;
    scr.bloom = look.dark ? 0.62 : 0.22;
    scr.clear(m.bg ?? '#0b0e18');
    const cam = this.camera();
    const { w, h } = mapSize(m);

    const x0 = Math.max(0, Math.floor(cam.x / TS));
    const y0 = Math.max(0, Math.floor(cam.y / TS));
    const x1 = Math.min(w - 1, Math.ceil((cam.x + W) / TS));
    const y1 = Math.min(h - 1, Math.ceil((cam.y + H) / TS));
    const theme = m.theme ?? 'green';

    // Two passes. Ground first for the whole view, then the masses on top of it
    // — a peak that spills into the cell above must not be painted over by that
    // cell's own ground.
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = tileAt(m, x, y);
        if (!t) continue;
        const px = x * TS - cam.x, py = y * TS - cam.y;
        if (isOutdoor(t.tile)) {
          scr.ctx.drawImage(groundSprite(`${m.id}|${x}|${y}`, x * TS, y * TS, sampler(m, x, y), theme), px, py);
        } else if (isStructure(t.tile)) {
          // A house stands on ground, so lay ground under it first. The building
          // itself reads as grass, but its neighbours are sampled for real, so a
          // house beside a road still gets the road running up to its wall.
          scr.ctx.drawImage(groundSprite(`${m.id}|${x}|${y}`, x * TS, y * TS,
            groundUnder(m, x, y), theme), px, py);
        } else {
          scr.ctx.drawImage(tileSprite(t.tile), px, py);
        }
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = tileAt(m, x, y);
        if (!t) continue;
        const px2 = x * TS - cam.x, py2 = y * TS - cam.y;
        const smp = sampler(m, x, y);
        // buildings draw over the ground, and over the cells they overhang
        if (hasStructure(smp)) {
          scr.ctx.drawImage(buildingSprite(`${m.id}|${x}|${y}`, smp, theme), px2, py2);
        }
        if (!isOutdoor(t.tile)) continue;
        const sample = smp;
        const px = x * TS - cam.x, py = y * TS - cam.y;
        if (hasMass(sample)) {
          scr.ctx.drawImage(massSprite(`${m.id}|${x}|${y}`, x * TS, y * TS, sample), px, py);
        }
        // features that belong to this cell alone still use their own stamp
        if (FEATURE.has(t.tile)) scr.ctx.drawImage(tileSprite(t.tile), px, py);
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
      drawNpc(scr, px, py, n, this.animT, this.g);
    }

    // boss markers
    for (const key of BOSS_SLOTS) {
      const b = m[key];
      if (!b || this.g.flag(`boss.${b.flag}`)) continue;
      const px = b.x * TS - cam.x, py = b.y * TS - cam.y;
      const pulse = 0.5 + 0.5 * Math.sin(this.animT * 3);
      scr.light(px + TS / 2, py + TS / 2, 18 + pulse * 6, 'rgba(255,70,90,0.6)', 0.35 + pulse * 0.25);
      scr.outline(px + 5, py + 5, TS - 10, TS - 10, PAL.red);
    }

    // player
    const px = this.playerPixel();
    const cv = actorSprite({
      classId: this.g.leader.classId, elementId: this.g.leader.elementId,
      skin: this.g.leader.skin, hair: this.g.leader.hair,
      frame: this.moving ? (Math.floor(this.animT * 8) % 2) : 0,
    });
    scr.ctx.drawImage(cv, Math.round(px.x - cam.x - (cv.width - TS) / 2), Math.round(px.y - cam.y - (cv.height - TS) - 4));

    // lighting: a warm pool on the player, torches in the dark, ambient motes
    const lx = Math.round(px.x - cam.x + TS / 2), ly = Math.round(px.y - cam.y + TS / 2);
    if (look.dark) {
      scr.ctx.save();
      scr.ctx.globalCompositeOperation = 'multiply';
      const g = scr.ctx.createRadialGradient(lx, ly, 20, lx, ly, 150);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, look.dark ? '#404058' : '#8890a8');
      scr.ctx.fillStyle = g;
      scr.ctx.fillRect(0, 0, W, H);
      scr.ctx.restore();
      const flick = 0.42 + Math.sin(this.animT * 9) * 0.05 + Math.sin(this.animT * 21) * 0.03;
      scr.light(lx, ly, 74, 'rgba(255,190,110,0.55)', flick);
    } else if (look.warm) {
      scr.light(lx, ly - 6, 46, 'rgba(255,214,150,0.30)', 0.35);
    }
    this.fxp.draw(scr);

    this.drawHud(scr);
    if (this.banner > 0) this.drawBanner(scr);
    if (this.choice) this.drawChoice(scr);
    else this.dlg.draw(scr);
    if (this.fade > 0) scr.fade(this.fade);
  }

  drawHud(scr) {
    const g = this.g;
    const rows = g.party.length;
    const pw = 116, ph = 12 + rows * 17;
    scr.panel(W - pw - 8, 8, pw, ph, { alpha: 0.94 });
    g.party.forEach((ch, i) => {
      const y = 16 + i * 17;
      const s = stats(ch);
      const ratio = ch.hp / s.maxHp;
      scr.text(ch.name.slice(0, 8), W - pw, y, ch.hp > 0 ? PAL.text : PAL.grey);
      scr.textRight(`${ch.hp}`, W - 16, y, hpColor(ratio));
      scr.bar(W - pw, y + 10, pw - 24, 3, ratio, hpColor(ratio));
      scr.bar(W - pw, y + 14, pw - 24, 2, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
    });
    scr.panel(8, H - 30, 118, 22, { alpha: 0.94 });
    scr.text('G', 18, H - 23, PAL.accentDim);
    scr.text(`${g.gold}`, 28, H - 23, PAL.accent);
    scr.textRight(`Lv ${g.leader.level}`, 118, H - 23, PAL.text);
  }

  drawBanner(scr) {
    const a = Math.min(1, this.banner / 0.5);
    const name = this.map.name;
    const w = Math.max(140, scr.textWidth(name) + 56);
    scr.ctx.save();
    scr.ctx.globalAlpha = a;
    scr.panel(W / 2 - w / 2, 12, w, 26, { accent: true, accentWidth: 20 });
    scr.textCenter(name, W / 2, 22, PAL.text);
    scr.rect(W / 2 - w / 2 + 10, 32, w - 20, 1, 'rgba(240,180,76,0.30)');
    scr.ctx.restore();
  }

  drawChoice(scr) {
    const opts = this.choice.options;
    const h = 20 + opts.length * 14;
    const y = H - h - 12;
    scr.panel(24, y - 40, W - 48, 36, { accent: true, accentWidth: 24 });
    scr.textWrap(this.choice.title, 36, y - 31, W - 72, PAL.text, { maxLines: 2, lineHeight: 11 });
    scr.panel(24, y, W - 48, h);
    if (this.choiceMenu) {
      this.choiceMenu.x = 44; this.choiceMenu.y = y + 10;
      this.choiceMenu.cellW = W - 100; this.choiceMenu.cellH = 14;
      this.choiceMenu.draw(scr);
    }
  }
}

/** Tiles that still want their own stamp drawn over the terrain. */
const FEATURE = new Set(['town', 'cave', 'bridge', 'flower', 'well', 'stall', 'lamp']);

/**
 * A neighbourhood reader for the terrain layer: `sample(dx, dy)` gives the tile
 * name that many cells away, or null off the map. Terrain uses it to work out
 * what it borders, which is the whole reason boundaries can curve.
 */
const sampler = (m, x, y) => (dx, dy) => tileAt(m, x + dx, y + dy)?.tile ?? null;

/** The same, but with building cells reading as the ground they were built on. */
const groundUnder = (m, x, y) => (dx, dy) => {
  const t = tileAt(m, x + dx, y + dy)?.tile ?? null;
  return isStructure(t) ? 'grass' : t;
};

function drawNpc(scr, x, y, npc, t, g) {
  // a slow two-frame idle, offset per NPC so a street does not breathe in unison
  const frame = Math.floor(t * 1.6 + npc.x * 0.7 + npc.y * 0.3) % 2;
  const cv = npcSprite(npc.kind, (npc.x + npc.y) % 4, frame);
  scr.ctx.drawImage(cv, Math.round(x + (TS - cv.width) / 2), Math.round(y + TS - cv.height));
  // a small marker over service NPCs, or a still-recruitable ally
  if (npc.kind === 'recruit') {
    if (!g.flag(`story.recruited.${npc.id}`)) {
      scr.text('*', x + 6, y - 7 + Math.round(Math.sin(t * 3)), PAL.accent);
    }
  } else if (npc.kind !== 'talk') {
    const gm = { shop: '$', inn: 'Z', temple: '+', guild: '!' }[npc.kind] ?? '';
    scr.text(gm, x + 6, y - 7 + Math.round(Math.sin(t * 3)), PAL.gold);
  }
}
