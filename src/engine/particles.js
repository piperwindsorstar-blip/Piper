// ============================================================================
//  PARTICLES — one small pool, used for hit sparks, ambient motes, dust and
//  magic. Motion is the cheapest modernity there is: a static frame reads as
//  old no matter how it is lit.
// ============================================================================

export class Particles {
  constructor(limit = 320) {
    this.list = [];
    this.limit = limit;
  }

  clear() { this.list.length = 0; }

  spawn(o) {
    if (this.list.length >= this.limit) this.list.shift();
    this.list.push({
      x: o.x, y: o.y,
      vx: o.vx ?? 0, vy: o.vy ?? 0,
      ax: o.ax ?? 0, ay: o.ay ?? 0,
      life: o.life ?? 0.6, max: o.life ?? 0.6,
      size: o.size ?? 1,
      color: o.color ?? '#ffffff',
      glow: o.glow ?? false,
      fade: o.fade ?? true,
      shrink: o.shrink ?? false,
      drag: o.drag ?? 0,
    });
  }

  /** A burst of sparks, for a landed hit. */
  burst(x, y, color, count = 12, speed = 60) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
        ay: 150, life: 0.35 + Math.random() * 0.35,
        color, size: Math.random() < 0.3 ? 2 : 1, glow: true, drag: 1.4,
      });
    }
  }

  /** A soft upward plume, for healing and buffs. */
  rise(x, y, color, count = 10, spread = 10) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * spread * 2,
        y: y + Math.random() * 6,
        vx: (Math.random() - 0.5) * 8, vy: -18 - Math.random() * 22,
        life: 0.6 + Math.random() * 0.5,
        color, size: 1, glow: true,
      });
    }
  }

  /** Ground dust, for footfalls and impacts. */
  dust(x, y, color = '#8a8070', count = 6) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x, y, vx: (Math.random() - 0.5) * 34, vy: -6 - Math.random() * 10,
        ay: 40, life: 0.3 + Math.random() * 0.3, color, size: 1, drag: 3,
      });
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      if (p.drag) { p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt; }
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  draw(scr, ox = 0, oy = 0) {
    const c = scr.ctx;
    c.save();
    for (const p of this.list) {
      const t = p.life / p.max;
      c.globalAlpha = p.fade ? Math.max(0, Math.min(1, t)) : 1;
      c.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      c.fillStyle = p.color;
      const s = p.shrink ? Math.max(1, Math.round(p.size * t)) : p.size;
      c.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), s, s);
    }
    c.restore();
  }

  get count() { return this.list.length; }
}
