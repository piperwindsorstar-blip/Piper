// ============================================================================
//  TITLE — logo, slot select, continue/new game.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu } from '../../engine/ui.js';
import { SLOTS, saveSummary, deleteSave } from '../../engine/save.js';
import { GameState, formatTime } from '../state.js';
import { monsterSprite } from '../../engine/sprites.js';

const STARS = Array.from({ length: 120 }, (_, i) => ({
  x: (i * 97) % W, y: (i * 53) % 150, s: (i % 3) * 0.4 + 0.3, p: (i % 7) / 7,
}));

export class TitleScene {
  constructor(app) { this.app = app; }

  enter() {
    this.t = 0;
    this.mode = 'main';
    this.rebuild();
  }

  rebuild() {
    const any = SLOTS.some((s) => saveSummary(s));
    this.menu = new Menu({
      items: [
        { label: 'NEW GAME' },
        { label: 'CONTINUE', disabled: !any },
        { label: 'HOW TO PLAY' },
      ],
      x: W / 2 - 46, y: 178, cellW: 104, cellH: 17, rows: 3,
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

  update(dt, input) {
    this.t += dt;
    this.menu.update(dt);
    this.slotMenu.update(dt);

    if (this.mode === 'main') {
      this.menu.handle(input);
      if (input.tap('confirm')) {
        const pick = this.menu.current.label;
        if (this.menu.disabled()) return;
        if (pick === 'NEW GAME') this.app.push('creation');
        else if (pick === 'CONTINUE') this.mode = 'slots';
        else this.mode = 'help';
      }
    } else if (this.mode === 'slots') {
      this.slotMenu.handle(input);
      if (input.tap('cancel')) this.mode = 'main';
      if (input.tap('confirm') && !this.slotMenu.disabled()) {
        const slot = this.slotMenu.current.slot;
        const g = GameState.load(slot);
        if (g) { this.app.game = g; this.app.replace('field'); }
      }
      if (input.tap('shift') && !this.slotMenu.disabled()) {
        deleteSave(this.slotMenu.current.slot);
        this.rebuild();
        this.mode = 'slots';
      }
    } else if (this.mode === 'help') {
      if (input.tap('cancel') || input.tap('confirm')) this.mode = 'main';
    }
  }

  draw(scr) {
    scr.setGrade('#3a5aa0', 0.14);
    scr.bloom = 0.62;
    scr.vignette = 0.62;
    scr.clear('#05060f');
    // starfield
    for (const s of STARS) {
      const tw = 0.55 + 0.45 * Math.sin(this.t * 2 + s.p * 9);
      scr.px(s.x, s.y, `rgba(200,220,255,${(s.s * tw).toFixed(2)})`);
    }
    // The wyrm is drawn BEFORE the ridge so the hills cut it off at the waist:
    // it reads as standing behind them rather than floating over the menu.
    const drift = Math.round(Math.sin(this.t * 0.4) * 10);
    const flap = Math.floor(this.t * 1.6) % 2;
    const cv = monsterSprite({ plan: 'dragon', palette: ['#3c2f63', '#4e3f7c', '#281f47'], scale: 2.2 }, flap);
    scr.ctx.globalAlpha = 0.9;
    scr.ctx.drawImage(cv, Math.round(W / 2 - cv.width / 2 + drift), 96);
    scr.ctx.globalAlpha = 1;
    // an eye-glow so the silhouette reads as alive
    scr.light(W / 2 + drift + 14, 128, 12, 'rgba(255,180,80,0.9)', 0.55);

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

    // logo
    const bob = Math.round(Math.sin(this.t * 1.4) * 1.5);
    scr.textCenter('QUEST OF THE', W / 2, 30 + bob, PAL.textDim, { size: 12 });
    const tw = scr.textWidth('THIRTEEN', 24);
    scr.textGlow('THIRTEEN', Math.round(W / 2 - tw / 2), 50 + bob, PAL.accent, '#ff9c2c', { size: 24 });
    scr.rect(W / 2 - 100, 88 + bob, 200, 1, 'rgba(240,180,76,0.40)');
    scr.rect(W / 2 - 40, 88 + bob, 80, 1, PAL.accent);
    scr.textCenter('a wheel of nine, and four beside it', W / 2, 96 + bob, PAL.textDim);

    if (this.mode === 'main') {
      scr.panel(W / 2 - 74, 168, 148, 62, { accent: true, accentWidth: 28 });
      this.menu.x = W / 2 - 46; this.menu.y = 178;
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
