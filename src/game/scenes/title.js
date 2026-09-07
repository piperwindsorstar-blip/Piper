// ============================================================================
//  TITLE — logo, slot select, continue/new game.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu } from '../../engine/ui.js';
import { SLOTS, saveSummary, deleteSave } from '../../engine/save.js';
import { GameState, formatTime } from '../state.js';
import { monsterSprite, actorSprite } from '../../engine/sprites.js';
import { getTouchMode, cycleTouchMode, TOUCH_LABEL } from '../../engine/settings.js';
import { playMusic, sfx } from '../../engine/audio.js';
import { TITLE_THEME } from '../../data/music.js';
import { TITLE_ART_SRC } from '../titleArt.js';

const titleArt = new Image();
titleArt.src = TITLE_ART_SRC;

const STARS = Array.from({ length: 160 }, (_, i) => ({
  x: (i * 97) % W, y: (i * 53) % 150, s: (i % 3) * 0.4 + 0.3, p: (i % 7) / 7,
}));
const FIREFLIES = Array.from({ length: 18 }, (_, i) => ({
  x: 30 + (i * 73) % (W - 60),
  y: 150 + (i * 29) % 80,
  p: (i % 11) / 11,
  s: 1 + (i % 3) * 0.4,
}));
const WHEEL = [
  '#e85a3a', '#7ec8f0', '#5cb86a', '#c4a06a', '#c8c0d0',
  '#f0d24a', '#d8e8f0', '#8cc46a', '#4aa0d8',
  '#f4e6a8', '#5a3a80', '#d0b4e8', '#1a1220',
];

export class TitleScene {
  constructor(app) { this.app = app; }

  enter() {
    this.t = 0;
    this.mode = 'main';
    this.rebuild();
    playMusic('title', TITLE_THEME);
  }

  rebuild() {
    const any = SLOTS.some((s) => saveSummary(s));
    this.menu = new Menu({
      items: [
        { label: 'NEW GAME' },
        { label: 'CONTINUE', disabled: !any },
        { label: 'HOW TO PLAY' },
        { label: this.touchLabel() },
      ],
      x: W / 2 - 84, y: 174, cellW: 168, cellH: 17, rows: 4,
    });
    this.slotMenu = new Menu({
      items: SLOTS.map((s) => {
        const sum = saveSummary(s);
        return sum
          ? { label: `${s}. ${sum.leader} Lv${sum.level}`, note: formatTime(sum.playtime), slot: s, sum }
          : { label: `${s}. — empty —`, disabled: true, slot: s };
      }),
      x: W / 2 - 110, y: 112, cellW: 232, cellH: 28, rows: 3,
    });
  }

  touchLabel() { return `TOUCH CONTROLS: ${TOUCH_LABEL[getTouchMode()].toUpperCase()}`; }

  update(dt, input) {
    this.t += dt;
    this.menu.update(dt);
    this.slotMenu.update(dt);

    if (this.mode === 'main') {
      this.menu.handle(input);
      if (input.tap('confirm')) {
        if (this.menu.disabled()) { sfx.error(); return; }
        sfx.confirm();
        const i = this.menu.index;
        const pick = this.menu.current.label;
        if (pick === 'NEW GAME') this.app.push('creation');
        else if (pick === 'CONTINUE') this.mode = 'slots';
        else if (pick.startsWith('TOUCH CONTROLS')) {
          // cycle and rewrite this one label in place, so the cursor stays
          // put instead of jumping back to NEW GAME on a full rebuild
          cycleTouchMode();
          this.menu.items[i].label = this.touchLabel();
        } else this.mode = 'help';
      }
    } else if (this.mode === 'slots') {
      this.slotMenu.handle(input);
      if (input.tap('cancel')) { sfx.cancel(); this.mode = 'main'; }
      if (input.tap('confirm') && !this.slotMenu.disabled()) {
        sfx.confirm();
        const slot = this.slotMenu.current.slot;
        const g = GameState.load(slot);
        if (g) { this.app.game = g; this.app.replace('field'); }
      }
      if (input.tap('shift') && !this.slotMenu.disabled()) {
        sfx.cancel();
        deleteSave(this.slotMenu.current.slot);
        this.rebuild();
        this.mode = 'slots';
      }
    } else if (this.mode === 'help') {
      if (input.tap('cancel') || input.tap('confirm')) { sfx.cancel(); this.mode = 'main'; }
    }
  }

  draw(scr) {
    scr.setGrade('#3a5aa0', 0.05);
    scr.bloom = 0.22;
    scr.vignette = 0.18;
    scr.clear('#05060f');
    if (titleArt.complete && titleArt.naturalWidth) {
      this.drawPainting(scr);
      this.drawMenu(scr);
      return;
    }
    // night sky — a warm gold horizon so the title is not a flat navy slab
    scr.vgrad(0, 0, W, 170, '#070814', '#1a1436');
    scr.vgrad(0, 88, W, 90, 'rgba(40,24,80,0)', 'rgba(240,160,70,0.16)');
    // moon
    const mx = W * 0.82, my = 38;
    scr.light(mx, my, 34, 'rgba(220,230,255,0.55)', 0.45);
    scr.ctx.fillStyle = '#e8eefc';
    scr.ctx.beginPath();
    scr.ctx.arc(mx, my, 11, 0, Math.PI * 2);
    scr.ctx.fill();
    scr.ctx.fillStyle = '#05060f';
    scr.ctx.beginPath();
    scr.ctx.arc(mx + 4, my - 2, 9, 0, Math.PI * 2);
    scr.ctx.fill();
    // starfield
    for (const s of STARS) {
      const twinkle = 0.55 + 0.45 * Math.sin(this.t * 2 + s.p * 9);
      scr.px(s.x, s.y, `rgba(200,220,255,${(s.s * twinkle).toFixed(2)})`);
    }
    // the thirteen-element wheel, faint, under the logo
    {
      const cx = W / 2, cy = 78;
      for (let i = 0; i < 13; i++) {
        const a = -Math.PI / 2 + (i / 13) * Math.PI * 2 + this.t * 0.08;
        const r = 52 + Math.sin(this.t * 1.2 + i) * 1.5;
        const x = Math.round(cx + Math.cos(a) * r);
        const y = Math.round(cy + Math.sin(a) * r * 0.38);
        scr.ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.t * 2 + i);
        scr.px(x, y, WHEEL[i]);
        scr.px(x + 1, y, WHEEL[i]);
      }
      scr.ctx.globalAlpha = 1;
    }
    // The wyrm is drawn BEFORE the ridge so the hills cut it off at the waist:
    // it reads as standing behind them rather than floating over the menu.
    const drift = Math.round(Math.sin(this.t * 0.4) * 10);
    const flap = Math.floor(this.t * 1.6) % 2;
    const cv = monsterSprite({ plan: 'dragon', palette: ['#3c2f63', '#4e3f7c', '#281f47'], scale: 2.2 }, flap);
    scr.ctx.globalAlpha = 0.94;
    scr.ctx.drawImage(cv, Math.round(W / 2 - cv.width / 2 + drift), 90);
    scr.ctx.globalAlpha = 1;
    // an eye-glow so the silhouette reads as alive
    scr.light(W / 2 + drift + 14, 122, 16, 'rgba(255,180,80,0.95)', 0.7);
    scr.light(W / 2 + drift + 14, 122, 28, 'rgba(255,120,40,0.55)', 0.28);

    // three ridges receding into haze, the cheapest depth there is
    scr.vgrad(0, 118, W, 76, 'rgba(28,17,64,0)', '#1c1140');
    const ridge = (base, amp, freq, near, far, phase) => {
      for (let x = 0; x < W; x++) {
        const hgt = amp + Math.round(amp * 0.8 * Math.sin(x * freq + phase) + amp * 0.4 * Math.sin(x * freq * 3 + 1.7));
        scr.rect(x, base - hgt, 1, H - (base - hgt), near);
        scr.px(x, base - hgt, far);
      }
    };
    ridge(196, 16, 0.020, '#181240', '#2a2160', 0.4);
    ridge(216, 13, 0.033, '#120e2e', '#211a48', 2.1);
    ridge(238, 10, 0.047, '#0b0820', '#171132', 4.3);
    for (let i = 0; i < 60; i++) scr.px((i * 83) % W, 200 + ((i * 31) % 62), '#100c22');

    // the title party — same painter as the field, so the plate and the
    // game are one costume language
    {
      const bobWalk = Math.floor(this.t * 2.2) % 2 === 0 ? 0 : 5;
      const party = [
        { classId: 'warrior', raceId: 'human', elementId: 'fire', skin: 0, hair: 1, x: 28, face: 'right' },
        { classId: 'lancer', raceId: 'elf', elementId: 'wind', skin: 0, hair: 2, x: 64, face: 'right' },
        { classId: 'mage', raceId: 'human', elementId: 'lightning', skin: 1, hair: 3, x: W - 100, face: 'left' },
        { classId: 'cleric', raceId: 'elf', elementId: 'light', skin: 0, hair: 1, x: W - 64, face: 'left' },
      ];
      for (const p of party) {
        const spr = actorSprite({ ...p, frame: bobWalk });
        scr.ctx.drawImage(spr, p.x, 196);
      }
    }

    // fireflies over the near ridge
    for (const f of FIREFLIES) {
      const pulse = 0.25 + 0.75 * Math.abs(Math.sin(this.t * 2.2 + f.p * 8));
      const fx = f.x + Math.sin(this.t * 0.7 + f.p * 6) * 10;
      const fy = f.y + Math.cos(this.t * 0.9 + f.p * 4) * 4;
      scr.light(fx, fy, 7 * f.s, 'rgba(255,210,120,0.9)', pulse * 0.45);
      if (pulse > 0.55) scr.px(fx, fy, '#ffe9a8');
    }

    // logo
    const bob = Math.round(Math.sin(this.t * 1.4) * 1.5);
    scr.textCenter('QUEST OF THE', W / 2, 26 + bob, PAL.textDim, { size: 12 });
    const tw = scr.textWidth('THIRTEEN', 24);
    scr.textGlow('THIRTEEN', Math.round(W / 2 - tw / 2), 46 + bob, PAL.accent, '#ff9c2c', { size: 24 });
    scr.rect(W / 2 - 100, 84 + bob, 200, 1, 'rgba(240,180,76,0.40)');
    scr.rect(W / 2 - 40, 84 + bob, 80, 1, PAL.accent);
    scr.textCenter('a wheel of nine, and four beside it', W / 2, 92 + bob, PAL.textDim);

    if (this.mode === 'main') {
      scr.panel(W / 2 - 100, 164, 200, 84, { accent: true, accentWidth: 28 });
      this.menu.x = W / 2 - 84; this.menu.y = 174;
      this.menu.draw(scr);
      scr.textCenter('Z confirm  ·  X back', W / 2, H - 14, PAL.textFaint);
    } else if (this.mode === 'slots') {
      scr.panel(W / 2 - 128, 96, 256, 122, { accent: true });
      scr.heading('CONTINUE', W / 2 - 112, 106, 224);
      this.slotMenu.draw(scr);
      const cur = this.slotMenu.current;
      if (cur?.sum) {
        scr.rect(W / 2 - 112, 194, 224, 1, PAL.line);
        scr.text(`${cur.sum.map}   ${cur.sum.gold}G   ${cur.sum.members} in party`,
          W / 2 - 112, 200, PAL.textDim);
      }
      scr.textCenter('SHIFT deletes a slot', W / 2, H - 14, PAL.textFaint);
    } else {
      scr.panel(28, 40, W - 56, H - 76, { accent: true });
      let y = scr.heading('HOW TO PLAY', 44, 52, W - 88);
      y += 4;
      const keys = [
        ['Arrows / WASD', 'walk, move the cursor'],
        ['Z  or  Enter', 'confirm, talk, open chests'],
        ['X  or  Esc', 'cancel, close a window'],
        ['C  or  Tab', 'party menu'],
        ['Shift', 'context action'],
      ];
      keys.forEach(([k, v], i) => {
        scr.text(k, 44, y + i * 12, PAL.accent);
        scr.text(v, 168, y + i * 12, PAL.textDim);
      });
      y += keys.length * 12 + 8;
      scr.rect(44, y, W - 88, 1, PAL.line); y += 8;
      const body = [
        'Battles are fought on two facing 3x3 grids. Your COLUMN decides what you can reach:',
        'a sword strikes the enemy front rank, a spear reaches one column deeper, and a bow',
        'or any spell reaches anywhere. Kill the enemy front rank and the rank behind it',
        'becomes reachable.',
        '',
        'Promotions come at levels 5, 10, 15 and 20, then again at 40, 60 and 80. Every one',
        'of those except 5 and 15 is a choice between two paths.',
      ];
      body.forEach((l, i) => scr.text(l, 44, y + i * 11, PAL.text));
      scr.textCenter('X to go back', W / 2, H - 16, PAL.accent);
    }
  }

  drawPainting(scr) {
    const ctx = scr.ctx;
    const iw = titleArt.naturalWidth, ih = titleArt.naturalHeight;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(titleArt, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = prev;
  }

  drawMenu(scr) {
    if (this.mode === 'main') {
      scr.panel(W / 2 - 100, 164, 200, 84, { accent: true, accentWidth: 28 });
      this.menu.x = W / 2 - 84; this.menu.y = 174;
      this.menu.draw(scr);
      scr.textCenter('Z confirm  ·  X back', W / 2, H - 14, PAL.textFaint);
    } else if (this.mode === 'slots') {
      scr.panel(W / 2 - 128, 96, 256, 122, { accent: true });
      scr.heading('CONTINUE', W / 2 - 112, 106, 224);
      this.slotMenu.draw(scr);
      const cur = this.slotMenu.current;
      if (cur?.sum) {
        scr.rect(W / 2 - 112, 194, 224, 1, PAL.line);
        scr.text(`${cur.sum.map}   ${cur.sum.gold}G   ${cur.sum.members} in party`,
          W / 2 - 112, 200, PAL.textDim);
      }
      scr.textCenter('SHIFT deletes a slot', W / 2, H - 14, PAL.textFaint);
    } else {
      scr.panel(28, 40, W - 56, H - 76, { accent: true });
      let y = scr.heading('HOW TO PLAY', 44, 52, W - 88);
      y += 4;
      const keys = [
        ['Arrows / WASD', 'walk, move the cursor'],
        ['Z  or  Enter', 'confirm, talk, open chests'],
        ['X  or  Esc', 'cancel, close a window'],
        ['C  or  Tab', 'party menu'],
        ['Shift', 'context action'],
      ];
      keys.forEach(([k, v], i) => {
        scr.text(k, 44, y + i * 12, PAL.accent);
        scr.text(v, 168, y + i * 12, PAL.textDim);
      });
      y += keys.length * 12 + 8;
      scr.rect(44, y, W - 88, 1, PAL.line); y += 8;
      const body = [
        'Battles are fought on two facing 3x3 grids. Your COLUMN decides what you can reach:',
        'a sword strikes the enemy front rank, a spear reaches one column deeper, and a bow',
        'or any spell reaches anywhere. Kill the enemy front rank and the rank behind it',
        'becomes reachable.',
        '',
        'Promotions come at levels 5, 10, 15 and 20, then again at 40, 60 and 80. Every one',
        'of those except 5 and 15 is a choice between two paths.',
      ];
      body.forEach((l, i) => scr.text(l, 44, y + i * 11, PAL.text));
      scr.textCenter('X to go back', W / 2, H - 16, PAL.accent);
    }
  }
}
