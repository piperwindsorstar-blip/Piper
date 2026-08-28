// ============================================================================
//  INPUT — keyboard, gamepad-ish key repeat, and on-screen touch controls.
//
//  Buttons: up down left right confirm cancel menu shift
// ============================================================================

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', Space: 'confirm', KeyZ: 'confirm',
  Escape: 'cancel', KeyX: 'cancel', Backspace: 'cancel',
  ShiftLeft: 'shift', ShiftRight: 'shift',
  Tab: 'menu', KeyC: 'menu',
};

const BUTTONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu', 'shift'];

const REPEAT_DELAY = 0.28;
const REPEAT_RATE = 0.07;

export class Input {
  constructor(target = window) {
    this.down = {};
    this.pressed = {};
    this.held = {};
    this.repeatT = {};
    for (const b of BUTTONS) { this.down[b] = false; this.pressed[b] = false; this.held[b] = 0; }

    target.addEventListener('keydown', (e) => {
      const b = KEYMAP[e.code];
      if (!b) return;
      e.preventDefault();
      if (!this.down[b]) { this.pressed[b] = true; this.repeatT[b] = REPEAT_DELAY; }
      this.down[b] = true;
    });
    target.addEventListener('keyup', (e) => {
      const b = KEYMAP[e.code];
      if (!b) return;
      e.preventDefault();
      this.down[b] = false;
      this.held[b] = 0;
    });
    target.addEventListener('blur', () => { for (const b of BUTTONS) this.down[b] = false; });
  }

  /** Virtual press, used by the touch pad. */
  press(b) { if (!this.down[b]) { this.pressed[b] = true; this.repeatT[b] = REPEAT_DELAY; } this.down[b] = true; }
  release(b) { this.down[b] = false; this.held[b] = 0; }

  update(dt) {
    for (const b of BUTTONS) {
      if (this.down[b]) {
        this.held[b] += dt;
        this.repeatT[b] -= dt;
        if (this.repeatT[b] <= 0) { this.pressed[b] = true; this.repeatT[b] = REPEAT_RATE; }
      }
    }
  }

  endFrame() { for (const b of BUTTONS) this.pressed[b] = false; }

  /** Consumed press — returns true once per press/repeat. */
  tap(b) {
    if (this.pressed[b]) { this.pressed[b] = false; return true; }
    return false;
  }

  isDown(b) { return !!this.down[b]; }

  /** Direction as -1/0/1 pair, consuming repeats. */
  dir() {
    let x = 0, y = 0;
    if (this.tap('left')) x = -1;
    else if (this.tap('right')) x = 1;
    if (this.tap('up')) y = -1;
    else if (this.tap('down')) y = 1;
    return { x, y };
  }

  /** Raw held direction, for continuous walking. */
  axis() {
    let x = 0, y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1;
    if (this.isDown('down')) y += 1;
    return { x, y };
  }
}
