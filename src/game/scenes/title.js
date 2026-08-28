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
      x: W / 2 - 40, y: 148, cellW: 96, cellH: 14, rows: 3,
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
    // horizon
    scr.vgrad(0, 92, W, 60, '#1a1038', '#0a0a18');
    for (let x = 0; x < W; x++) {
      const hgt = 12 + Math.round(10 * Math.sin(x * 0.05) + 6 * Math.sin(x * 0.13 + 2));
      scr.rect(x, 132 - hgt, 1, hgt + 20, '#12102a');
    }
    scr.rect(0, 152, W, H - 152, '#080810');

    // a wyrm silhouette drifting behind the logo
    const drift = Math.sin(this.t * 0.4) * 10;
    const cv = monsterSprite({ plan: 'dragon', palette: ['#241c3a', '#2e2448', '#181230'], scale: 2 }, 0);
    scr.ctx.globalAlpha = 0.8;
    scr.ctx.drawImage(cv, Math.round(W / 2 - cv.width / 2 + drift), 62);
    scr.ctx.globalAlpha = 1;

    // logo
    const bob = Math.round(Math.sin(this.t * 1.4) * 1.5);
    scr.textCenter('QUEST OF THE', W / 2, 26 + bob, PAL.textDim, { size: 10 });
    scr.textCenter('THIRTEEN', W / 2, 38 + bob, PAL.gold, { size: 22, bold: true });
    scr.rect(W / 2 - 66, 62 + bob, 132, 1, PAL.frame1);
    scr.textCenter('a wheel of nine, and four beside it', W / 2, 66 + bob, PAL.textDim, { size: 8 });

    if (this.mode === 'main') {
      scr.window(W / 2 - 56, 142, 112, 50);
      this.menu.draw(scr);
      scr.textCenter('Z / Enter — confirm    X / Esc — back', W / 2, H - 14, PAL.textDim);
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
