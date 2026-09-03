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
import { installAudioUnlock } from './engine/audio.js';

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

// A short screen-wipe between scenes: fade the old frame to black, mutate the
// stack once it is fully covered, then fade the new scene back in. push/pop/
// replace queue the mutation rather than applying it immediately, so a scene
// swap is never an instant, jarring cut — no caller relies on the stack
// having already changed by the time push/pop/replace returns.
const WIPE_OUT = 0.14, WIPE_IN = 0.18;

class App {
  constructor(canvas) {
    this.screen = new Screen(canvas);
    this.input = new Input(window);
    this.stack = [];
    this.game = null;
    this.last = performance.now();
    this.acc = 0;
    this.transition = null;
    this.push('title');
    this.bindTouch();
    installAudioUnlock();
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

  // --- public stack API — each queues a wipe rather than swapping instantly
  push(id, opts = {}) { this.queueTransition({ type: 'push', id, opts }); }

  pop(result) {
    if (this.stack.length <= 1) return;
    this.queueTransition({ type: 'pop', result });
  }

  replace(id, opts = {}) { this.queueTransition({ type: 'replace', id, opts }); }

  queueTransition(action) {
    // Batch onto an in-flight wipe only while it's still fading OUT — that's
    // the same-tick case (e.g. battle popping itself then pushing promotion),
    // where both mutations should land behind one cut. A wipe already fading
    // back IN has already applied its own actions and emptied its intent;
    // tacking a new one onto that stale array would just discard it once the
    // fade-in finishes, leaving the scene silently stuck. Start a fresh wipe
    // instead — a rare back-to-back nav restarts the cut, which is visible
    // but correct, instead of invisible and wrong.
    if (this.transition && this.transition.phase === 'out') {
      // a handful of same-tick actions is real (pop then push a follow-up
      // scene); anything past that means a caller is looping on a stack
      // length that only changes once the wipe actually applies — refuse
      // rather than let the queue grow without bound
      if (this.transition.actions.length < 8) this.transition.actions.push(action);
      return;
    }
    this.transition = { phase: 'out', t: 0, actions: [action] };
  }

  // --- the actual, immediate stack mutations, run once a wipe is fully black
  applyPush(id, opts) {
    const s = this.make(id);
    this.stack.push(s);
    s.enter(opts);
    return s;
  }

  applyPop(result) {
    if (this.stack.length <= 1) return;
    this.stack.pop().dispose3D?.();
    this.current?.onResume?.(result);
  }

  applyReplace(id, opts) {
    this.stack.pop().dispose3D?.();
    return this.applyPush(id, opts);
  }

  frame = (now) => {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;                 // a backgrounded tab must not fast-forward

    this.input.update(dt);

    const tr = this.transition;
    if (tr) {
      // frozen on both sides of the cut: the old scene holds its last frame
      // while fading out, the new one doesn't animate until it's fading in
      tr.t += dt;
      if (tr.phase === 'out' && tr.t >= WIPE_OUT) {
        for (const a of tr.actions) {
          if (a.type === 'push') this.applyPush(a.id, a.opts);
          else if (a.type === 'pop') this.applyPop(a.result);
          else if (a.type === 'replace') this.applyReplace(a.id, a.opts);
        }
        tr.actions = [];
        tr.phase = 'in';
        tr.t = 0;
      } else if (tr.phase === 'in' && tr.t >= WIPE_IN) {
        this.transition = null;
      }
    } else {
      try {
        this.current?.update(dt, this.input);
      } catch (e) {
        console.error('update failed', e);
        this.error = e;
      }
    }
    this.input.endFrame();

    try {
      this.current?.draw(this.screen);
    } catch (e) {
      console.error('draw failed', e);
      this.error = e;
    }
    if (this.error) this.drawError();
    if (this.transition) {
      const t2 = this.transition;
      const alpha = t2.phase === 'out' ? Math.min(1, t2.t / WIPE_OUT) : Math.max(0, 1 - t2.t / WIPE_IN);
      this.screen.fade(alpha, '#000');
    }
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
