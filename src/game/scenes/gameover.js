// ============================================================================
//  GAME OVER — Dragon Quest's mercy: you keep the levels, lose half the gold,
//  and wake up at the last town.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu } from '../../engine/ui.js';
import { stats } from '../character.js';

export class GameOverScene {
  constructor(app) { this.app = app; }

  enter() {
    this.g = this.app.game;
    this.t = 0;
    this.menu = new Menu({
      items: ['Wake in the last town', 'Return to title'],
      x: W / 2 - 60, y: 140, cellW: 140, cellH: 14, rows: 2,
    });
  }

  update(dt, input) {
    this.t += dt;
    this.menu.update(dt);
    if (this.t < 1.2) return;
    this.menu.handle(input);
    if (input.tap('confirm')) {
      if (this.menu.index === 0) {
        this.g.gold = Math.floor(this.g.gold / 2);
        this.g.mapId = 'wren';
        this.g.x = 12; this.g.y = 18;
        for (const ch of this.g.party) {
          ch.hp = stats(ch).maxHp;
          ch.mp = stats(ch).maxMp;
          ch.alive = true;
          ch.statuses = {};
          ch.ip = 0;
        }
        this.app.replace('field', { message: 'You wake in Wren\'s Ford, lighter by half a purse.' });
      } else {
        this.app.replace('title');
      }
    }
  }

  draw(scr) {
    scr.clear('#08060c');
    const a = Math.min(1, this.t / 1.2);
    scr.ctx.globalAlpha = a;
    scr.textCenter('THE PARTY HAS FALLEN', W / 2, 80, PAL.red, { size: 12 });
    scr.textCenter('Levels are kept. Half the gold is not.', W / 2, 104, PAL.textDim);
    scr.ctx.globalAlpha = 1;
    if (this.t >= 1.2) {
      scr.window(W / 2 - 76, 130, 152, 40);
      this.menu.draw(scr);
    }
  }
}
