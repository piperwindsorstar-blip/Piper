// ============================================================================
//  TITLE — logo, slot select, continue/new game.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu } from '../../engine/ui.js';
import { SLOTS, saveSummary, deleteSave } from '../../engine/save.js';
import { GameState, formatTime } from '../state.js';
import { monsterSprite } from '../../engine/sprites.js';

const STARS = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 71) % W, y: (i * 37) % 90, s: (i % 3) * 0.4 + 0.3, p: (i % 7) / 7,
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
      x: W / 2 - 36, y: 161, cellW: 84, cellH: 14, rows: 3,
    });
    this.slotMenu = new Menu({
      items: SLOTS.map((s) => {
        const sum = saveSummary(s);
        return sum
          ? { label: `${s}. ${sum.leader} Lv${sum.level}`, note: formatTime(sum.playtime), slot: s, sum }
          : { label: `${s}. — empty —`, disabled: true, slot: s };
      }),
      x: 46, y: 96, cellW: 168, cellH: 24, rows: 3,
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
    scr.clear('#080814');
    // starfield
    for (const s of STARS) {
      const tw = 0.55 + 0.45 * Math.sin(this.t * 2 + s.p * 9);
      scr.px(s.x, s.y, `rgba(200,220,255,${(s.s * tw).toFixed(2)})`);
    }
    // The wyrm is drawn BEFORE the ridge so the hills cut it off at the waist:
    // it reads as standing behind them rather than floating over the menu.
    const drift = Math.round(Math.sin(this.t * 0.4) * 8);
    const flap = Math.floor(this.t * 1.6) % 2;
    const cv = monsterSprite({ plan: 'dragon', palette: ['#3c2f63', '#4e3f7c', '#281f47'], scale: 1.8 }, flap);
    scr.ctx.globalAlpha = 0.85;
    scr.ctx.drawImage(cv, Math.round(W / 2 - cv.width / 2 + drift), 92);
    scr.ctx.globalAlpha = 1;

    // horizon and ridge
    scr.vgrad(0, 150, W, 30, '#1a1038', '#0c0a1c');
    for (let x = 0; x < W; x++) {
      const hgt = 14 + Math.round(11 * Math.sin(x * 0.045) + 6 * Math.sin(x * 0.13 + 2));
      scr.rect(x, 168 - hgt, 1, hgt + 8, '#151230');
      scr.px(x, 168 - hgt, '#221d44');
    }
    scr.rect(0, 176, W, H - 176, '#080610');
    for (let i = 0; i < 40; i++) scr.px((i * 83) % W, 178 + ((i * 31) % 44), '#0e0b1a');

    // logo
    const bob = Math.round(Math.sin(this.t * 1.4) * 1.5);
    scr.textCenter('QUEST OF THE', W / 2, 22 + bob, PAL.textDim, { size: 12 });
    scr.textCenter('THIRTEEN', W / 2, 38 + bob, PAL.gold, { size: 22 });
    scr.rect(W / 2 - 70, 66 + bob, 140, 1, PAL.frame1);
    scr.textCenter('a wheel of nine, and four beside it', W / 2, 72 + bob, PAL.textDim);

    if (this.mode === 'main') {
      scr.window(W / 2 - 58, 154, 116, 50);
      this.menu.x = W / 2 - 36; this.menu.y = 161;
      this.menu.draw(scr);
      scr.textCenter('Z confirm · X back', W / 2, H - 12, PAL.textDim);
    } else if (this.mode === 'slots') {
      scr.window(34, 84, 188, 96);
      scr.text('CONTINUE', 42, 90, PAL.gold);
      this.slotMenu.draw(scr);
      const cur = this.slotMenu.current;
      if (cur?.sum) {
        scr.text(`${cur.sum.map}  ·  ${cur.sum.gold}G  ·  ${cur.sum.members} in party`,
          42, 160, PAL.textDim);
      }
      scr.textCenter('SHIFT deletes a slot', W / 2, H - 14, PAL.textDim);
    } else {
      scr.window(14, 40, W - 28, 168);
      scr.text('HOW TO PLAY', 22, 48, PAL.gold);
      const lines = [
        'Arrows / WASD  walk, move the cursor',
        'Z / Enter      confirm, talk, open chests',
        'X / Esc        cancel, close a window',
        'C / Tab        party menu',
        '',
        'Battles are fought on two facing 3x3 grids.',
        'Your COLUMN decides what you can reach: a sword',
        'strikes the enemy front rank, a spear reaches one',
        'column deeper, a bow and any spell reach anywhere.',
        'Kill the enemy front rank and the rank behind it',
        'becomes reachable.',
        '',
        'Promotions come at levels 5, 10, 15 and 20.',
        'At 10 and 20 you choose between two paths.',
      ];
      lines.forEach((l, i) => scr.text(l, 22, 62 + i * 10, l.startsWith('Arrows') || /^[A-Z]/.test(l) ? PAL.text : PAL.textDim));
      scr.textCenter('X to go back', W / 2, H - 14, PAL.gold);
    }
  }
}
