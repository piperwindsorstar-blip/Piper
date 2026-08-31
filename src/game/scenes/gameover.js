// ============================================================================
//  GAME OVER — Dragon Quest's mercy: you keep the levels, lose half the gold,
//  and wake up at the last town.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu } from '../../engine/ui.js';
import { Particles } from '../../engine/particles.js';
import { stats } from '../character.js';
import { sfx, playMusic } from '../../engine/audio.js';
import { GAMEOVER_THEME } from '../../data/music.js';

export class GameOverScene {
  constructor(app) { this.app = app; }

  enter() {
    this.g = this.app.game;
    this.t = 0;
    this.fxp = new Particles(120);
    this.emit = 0;
    this.menu = new Menu({
      items: ['Wake in the last town', 'Return to title'],
      x: W / 2 - 76, y: 178, cellW: 168, cellH: 18, rows: 2,
    });
    playMusic('gameover', GAMEOVER_THEME);
  }

  update(dt, input) {
    this.t += dt;
    this.fxp.update(dt);
    // embers drifting up out of the dark
    this.emit += dt;
    while (this.emit > 0.09) {
      this.emit -= 0.09;
      this.fxp.spawn({
        x: Math.random() * W, y: H + 4,
        vx: (Math.random() - 0.5) * 10, vy: -12 - Math.random() * 18,
        life: 2.4 + Math.random() * 2, color: '#8a3a4a', glow: true, size: 1,
      });
    }
    this.menu.update(dt);
    if (this.t < 1.4) return;
    this.menu.handle(input);
    if (input.tap('confirm')) {
      sfx.confirm();
      if (this.menu.index === 0) {
        this.g.gold = Math.floor(this.g.gold / 2);
        this.g.mapId = 'wren';
        this.g.x = 12; this.g.y = 18;
        for (const ch of this.g.party) {
          const s = stats(ch);
          ch.hp = s.maxHp;
          ch.mp = s.maxMp;
          ch.alive = true;
          ch.statuses = {};
          ch.ip = 0;
        }
        this.app.replace('field', { message: "You wake in Wren's Ford, lighter by half a purse." });
      } else {
        this.app.replace('title');
      }
    }
  }

  draw(scr) {
    scr.setGrade('#ff5a6a', 0.16);
    scr.bloom = 0.5;
    scr.vignette = 0.86;
    scr.clear('#08040a');
    scr.vgrad(0, H - 120, W, 120, 'rgba(70,14,24,0)', 'rgba(70,14,24,0.55)');
    this.fxp.draw(scr);

    const a = Math.min(1, this.t / 1.4);
    scr.ctx.save();
    scr.ctx.globalAlpha = a;
    const title = 'THE PARTY HAS FALLEN';
    const tw = scr.textWidth(title, 18);
    scr.textGlow(title, Math.round(W / 2 - tw / 2), 96, PAL.red, '#ff2a44', { size: 18 });
    scr.rect(W / 2 - 110, 122, 220, 1, 'rgba(255,90,110,0.35)');
    scr.textCenter('Levels are kept. Half the gold is not.', W / 2, 132, PAL.textDim);
    scr.ctx.restore();

    if (this.t >= 1.4) {
      scr.panel(W / 2 - 100, 166, 200, 48, { accent: PAL.red, accentWidth: 26 });
      this.menu.draw(scr);
    }
  }
}
