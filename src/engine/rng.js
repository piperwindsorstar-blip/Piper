// ============================================================================
//  RNG — a small, seedable, serialisable generator (mulberry32).
//  Battles and world generation both draw from it so a save can be replayed.
// ============================================================================

export class RNG {
  constructor(seed = Date.now() >>> 0) { this.s = seed >>> 0; }

  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(a = 1, b) { return b === undefined ? this.next() * a : a + this.next() * (b - a); }
  int(a, b) { return b === undefined ? Math.floor(this.next() * a) : a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Weighted pick from [[value, weight], ...] */
  weighted(pairs) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = this.next() * total;
    for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
    return pairs[pairs.length - 1][0];
  }
  save() { return this.s; }
  load(s) { this.s = s >>> 0; }
}

export const rng = new RNG();
