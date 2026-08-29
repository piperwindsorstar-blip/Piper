// ============================================================================
//  MAIN — scene stack, fixed-step game loop, touch controls.
// ============================================================================

import { Screen, PAL, W, H } from './engine/screen.js';
import { Input } from './engine/input.js';
import { TitleScene } from './game/scenes/title.js';
import { CreationScene } from './game/scenes/creation.js';
import { FieldScene } from './game/scenes/field.js';
import { BattleScene } from './game/scenes/battle.js';
import { MenuScene } from './game/scenes/menu.js';
import { ShopScene } from './game/scenes/shop.js';
import { PromotionScene } from './game/scenes/promotion.js';
import { GameOverScene } from './game/scenes/gameover.js';
import { applyTouchVisibility } from './engine/settings.js';

const SCENES = {
  title: TitleScene,
  creation: CreationScene,
  field: FieldScene,
  battle: BattleScene,
  menu: MenuScene,
  shop: ShopScene,
  promotion: PromotionScene,
  gameover: GameOverScene,
};

class App {
  constructor(canvas) {
    this.screen = new Screen(canvas);
    this.input = new Input(window);
    this.stack = [];
    this.game = null;
    this.last = performance.now();
    this.acc = 0;
    this.push('title');
    this.bindTouch();
    requestAnimationFrame(this.frame);
  }

  get current() { return this.stack[this.stack.length - 1]; }

  make(id) {
    const Cls = SCENES[id];
    if (!Cls) throw new Error(`unknown scene: ${id}`);
    const s = new Cls(this);
    s.sceneId = id;
    return s;
  }

  push(id, opts = {}) {
    const s = this.make(id);
    this.stack.push(s);
    s.enter(opts);
    return s;
  }

  pop(result) {
    if (this.stack.length <= 1) return;
    this.stack.pop();
    this.current?.onResume?.(result);
  }

  replace(id, opts = {}) {
    this.stack.pop();
    return this.push(id, opts);
  }

  frame = (now) => {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;                 // a backgrounded tab must not fast-forward

    this.input.update(dt);
    try {
      this.current?.update(dt, this.input);
    } catch (e) {
      console.error('update failed', e);
      this.error = e;
    }
    this.input.endFrame();

    try {
      this.current?.draw(this.screen);
    } catch (e) {
      console.error('draw failed', e);
      this.error = e;
    }
    if (this.error) this.drawError();
    this.screen.present();
    requestAnimationFrame(this.frame);
  };

  drawError() {
    const scr = this.screen;
    scr.window(6, 6, W - 12, 60);
    scr.text('Something broke:', 14, 12, PAL.red);
    scr.textWrap(String(this.error?.message ?? this.error), 14, 24, W - 28, PAL.text,
      { lineHeight: 9, maxLines: 4 });
  }

  bindTouch() {
    const pad = document.getElementById('touch');
    if (!pad) return;
    const bind = (el, button) => {
      if (!el) return;
      const down = (e) => { e.preventDefault(); this.input.press(button); el.classList.add('on'); };
      const up = (e) => { e.preventDefault(); this.input.release(button); el.classList.remove('on'); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    };
    for (const b of ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu', 'shift']) {
      bind(pad.querySelector(`[data-btn="${b}"]`), b);
    }
    // 'auto' (the default) shows the pad only where touch is the primary
    // input; a player can force it on or off from the title or party menu.
    // Resize right after: the pad reserves gutters so it never sits on top
    // of canvas content, and the very first resize() ran before #touch had
    // its 'visible' class, so it didn't know to reserve them yet.
    applyTouchVisibility();
    this.screen.resize();
  }
}

const canvas = document.getElementById('screen');
window.app = new App(canvas);
