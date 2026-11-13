/**
 * Le calque des effets de la table : un canvas posé sur tout l'écran, au-dessus
 * du plateau, et quelques cartes « fantômes » (la carte qui se résout). Les
 * positions se lisent sur les cartes de la table (`[data-obj]`) au moment de
 * l'effet : la table peut être inclinée, zoomée par la caméra ou à plat.
 *
 * Rien ici ne change l'état de la partie : un effet perdu (onglet caché, carte
 * introuvable) ne fait que manquer à l'image.
 */

import { MATTER_COLOR, type FxCommand, type FxStyle, type Matter } from "../engine/card-fx";

type Box = { x: number; y: number; w: number; h: number; l: number; t: number };
type Point = { x: number; y: number };
type Mark = { k: number; fn: () => void; done?: boolean };
type Effect = { t: number; dur: number; draw: (k: number) => void; marks: Mark[]; done: () => void };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  size: number;
  color: string | ((f: number) => string);
  drag: number;
  g: number;
  add: boolean;
  grow: number;
  alpha: number;
};

/** Ce que le calque doit savoir d'une carte pour la montrer. */
export type FxCardInfo = { name: string; image?: string; color: string; landscape?: boolean };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeIn = (k: number) => k * k;
const bez = (a: Point, c: Point, b: Point, k: number): Point => {
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
};

function rgba(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const hex = color.length === 4 ? [...color.slice(1)].map((c) => c + c).join("") : color.slice(1);
    const n = parseInt(hex, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const m = color.match(/[\d.]+/g) ?? ["255", "255", "255"];
  return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
}

function fire(f: number): string {
  return f < 0.12 ? "#fff7c2" : f < 0.3 ? "#fcd34d" : f < 0.55 ? "#f97316" : f < 0.78 ? "#b91c1c" : "#3f3a3a";
}

function bolt(x1: number, y1: number, x2: number, y2: number, spread: number): [number, number][] {
  let pts: [number, number][] = [
    [x1, y1],
    [x2, y2],
  ];
  let disp = spread;
  for (let i = 0; i < 6; i += 1) {
    const next: [number, number][] = [pts[0]];
    for (let j = 1; j < pts.length; j += 1) {
      const a = pts[j - 1];
      const b = pts[j];
      next.push([(a[0] + b[0]) / 2 + rnd(-disp, disp), (a[1] + b[1]) / 2 + rnd(-disp, disp) * 0.25], b);
    }
    pts = next;
    disp /= 2;
  }
  return pts;
}

export class FxEngine {
  private ctx: CanvasRenderingContext2D;
  private effects: Effect[] = [];
  private parts: Particle[] = [];
  private sprites = new Map<string, HTMLCanvasElement>();
  private frame = 0;
  private last = 0;
  private dpr = 1;
  private dead = false;
  /** Facteur de durée : la vitesse du récit (lent 1,6, normal 1, rapide 0,5). */
  scale = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private layer: HTMLElement,
    /** Où chercher les cartes de la table. */
    private root: () => ParentNode,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  }

  /**
   * Arrête tout : nouvelle partie, effets coupés. Les effets en cours ne
   * reprennent pas : leurs attentes restent pendantes au lieu de se résoudre,
   * sinon la suite d'une frappe se dessinerait d'un coup après l'arrêt.
   */
  clear() {
    this.effects = [];
    this.parts = [];
    this.layer.querySelectorAll("[data-fx-ghost]").forEach((ghost) => ghost.remove());
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() {
    this.dead = true;
    this.clear();
  }

  // -------------------------------------------------------------------------
  // La boucle

  private run() {
    if (this.frame || this.dead) return;
    this.last = performance.now();
    const tick = (now: number) => {
      // L'horodatage d'une image peut précéder `performance.now()` lu juste avant.
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)) / this.scale;
      this.last = now;
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = this.effects.length - 1; i >= 0; i -= 1) {
        const effect = this.effects[i];
        effect.t += dt * 1000;
        const k = Math.min(1, effect.t / effect.dur);
        ctx.save();
        effect.draw(k);
        ctx.restore();
        for (const mark of effect.marks) {
          if (!mark.done && k >= mark.k) {
            mark.done = true;
            mark.fn();
          }
        }
        if (k >= 1) {
          this.effects.splice(i, 1);
          effect.done();
        }
      }
      for (let i = this.parts.length - 1; i >= 0; i -= 1) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) {
          this.parts.splice(i, 1);
          continue;
        }
        const f = p.t / p.life;
        const drag = Math.pow(p.drag, dt * 60);
        p.vx *= drag;
        p.vy = p.vy * drag + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const r = Math.max(0.4, p.size * (p.grow ? 1 + p.grow * f : 1 - f * 0.6)) * 2;
        ctx.globalCompositeOperation = p.add ? "lighter" : "source-over";
        ctx.globalAlpha = Math.max(0, (1 - f) * p.alpha);
        ctx.drawImage(this.sprite(typeof p.color === "function" ? p.color(f) : p.color), p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (this.effects.length === 0 && this.parts.length === 0) {
        this.frame = 0;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        return;
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private fx(dur: number, draw: (k: number) => void, marks: Mark[] = []): Promise<void> {
    return new Promise((done) => {
      this.effects.push({ t: 0, dur, draw, marks, done });
      this.run();
    });
  }

  private wait(ms: number): Promise<void> {
    return this.fx(ms, () => undefined);
  }

  private particle(p: Partial<Particle> & { x: number; y: number }) {
    this.parts.push({ vx: 0, vy: 0, t: 0, life: 0.6, size: 3, color: "#fff", drag: 0.96, g: 0, add: true, grow: 0, alpha: 1, ...p });
    this.run();
  }

  /** Une particule est une tache douce : un dégradé radial, mis en cache par couleur. */
  private sprite(color: string): HTMLCanvasElement {
    const cached = this.sprites.get(color);
    if (cached) return cached;
    const out = document.createElement("canvas");
    out.width = out.height = 64;
    const x = out.getContext("2d");
    if (x) {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, rgba(color, 1));
      g.addColorStop(0.4, rgba(color, 0.85));
      g.addColorStop(1, rgba(color, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
    }
    this.sprites.set(color, out);
    return out;
  }

  // -------------------------------------------------------------------------
  // Dessin

  private glowLine(pts: [number, number][], color: string, width: number) {
    const ctx = this.ctx;
    const alpha = ctx.globalAlpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, a, c] of [
      [width * 4, 0.18, color],
      [width * 2, 0.45, color],
      [width * 0.8, 1, "#ffffff"],
    ] as const) {
      ctx.globalAlpha = a * alpha;
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
  }

  private disc(x: number, y: number, r: number, color: string, alpha = 1) {
    if (r <= 0 || alpha <= 0) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, color);
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private ring(x: number, y: number, color: string, maxR = 70, dur = 500, width = 3) {
    void this.fx(dur, (k) => {
      const ctx = this.ctx;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = color;
      ctx.lineWidth = width * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, maxR * easeOut(k), maxR * easeOut(k) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  private burst(x: number, y: number, colors: string[], n = 26, speed = 260, life = 0.6, size = 3, g = 0) {
    for (let i = 0; i < n; i += 1) {
      const a = rnd(0, Math.PI * 2);
      const v = rnd(speed * 0.3, speed);
      this.particle({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, life: rnd(life * 0.5, life), size: rnd(size * 0.6, size * 1.4), color: colors[i % colors.length], g });
    }
  }

  private flash(color: string, peak = 0.25, dur = 240) {
    const veil = document.createElement("div");
    veil.style.cssText = `position:absolute;inset:0;background:${color};opacity:0;pointer-events:none`;
    this.layer.appendChild(veil);
    veil
      .animate([{ opacity: peak }, { opacity: 0 }], { duration: dur * this.scale, easing: "ease-out" })
      .finished.finally(() => veil.remove())
      .catch(() => undefined);
  }

  private shake(px = 6, dur = 300) {
    const stage = document.querySelector<HTMLElement>(".play-stage");
    stage?.animate(
      [
        { translate: "0 0" },
        { translate: `${px}px ${-px / 2}px` },
        { translate: `${-px}px ${px / 2}px` },
        { translate: `${px / 2}px 0` },
        { translate: "0 0" },
      ],
      { duration: dur * this.scale },
    );
  }

  private floatText(b: Box, text: string, color: string) {
    void this.fx(1000, (k) => {
      const ctx = this.ctx;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1 - easeIn(k);
      ctx.font = "800 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      const y = b.t + b.h * 0.3 - 30 * easeOut(k);
      ctx.strokeText(text, b.x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, b.x, y);
    });
  }

  private star(x: number, y: number, r: number, color: string) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const t = (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      if (i) ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
      else ctx.moveTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  private snowflake(x: number, y: number, r: number, alpha: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i += 1) {
      const t = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r * 0.7);
      ctx.stroke();
      const mx = x + Math.cos(t) * r * 0.6;
      const my = y + Math.sin(t) * r * 0.42;
      for (const s of [-0.6, 0.6]) {
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(t + s) * r * 0.3, my + Math.sin(t + s) * r * 0.21);
        ctx.stroke();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Où sont les choses

  private box(el: Element): Box {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top };
  }

  /** La carte d'un objet sur la table (pas celle d'une fenêtre ou de la main d'un autre). */
  private objBox(obj: number): Box | null {
    const all = this.root().querySelectorAll(`[data-obj="${obj}"]`);
    for (const el of all) {
      const b = this.box(el);
      if (b.w > 0 && b.h > 0 && b.y > -b.h && b.y < window.innerHeight + b.h) return b;
    }
    return null;
  }

  private tableBox(): Box {
    const el = document.querySelector(".play-scene") ?? this.root().querySelector("[data-play-table]");
    if (el) return this.box(el);
    return { x: window.innerWidth / 2, y: window.innerHeight / 2, w: window.innerWidth, h: window.innerHeight, l: 0, t: 0 };
  }

  /** Où la carte qui se résout apparaît : au bord droit de la table, à hauteur des yeux. */
  private castSpot(): { left: number; top: number; w: number; h: number } {
    const table = this.tableBox();
    const w = Math.max(64, Math.min(150, table.w * 0.12));
    const h = w * 1.4;
    const top = Math.max(table.t, 0);
    const bottom = Math.min(table.t + table.h, window.innerHeight);
    const middle = bottom > top ? (top + bottom) / 2 : window.innerHeight / 2;
    return { left: table.l + table.w - w - Math.max(12, table.w * 0.03), top: middle - h * 0.75, w, h };
  }

  // -------------------------------------------------------------------------
  // Les commandes

  private castGhost: { el: HTMLElement; def: number; box: Box } | null = null;

  async play(command: FxCommand, card: (def: number) => FxCardInfo | null, me: number | null): Promise<void> {
    switch (command.kind) {
      case "cast":
        return this.cast(command.def, command.seat, command.source, card(command.def), me, command.spell);
      case "strike":
        return this.strike(command.style, command.targets, command.fromCast);
      case "clash":
        return this.clash(command.bf, command.targets);
      case "die":
        return this.die(command.obj, command.style);
      case "might":
        return this.might(command.obj, command.delta, command.style);
      case "stun":
        return this.stun(command.obj, command.style);
      case "shield":
        return this.shield(command.obj, command.style);
      case "heal":
        return this.heal(command.obj);
      case "move":
        return this.move(command.objs, command.style);
      case "vanish":
        return this.vanish(command.obj, command.banish, command.style);
      case "counter":
        return this.counter(command.def, command.seat, card(command.def), me, command.style);
      case "summon":
        return this.summon(command.obj, command.style);
      case "draw":
        return this.draw(command.count, command.style);
    }
  }

  private colorOf(style: FxStyle | null, fallback: string): string {
    if (!style) return fallback;
    return style.matter === "domaine" ? style.color : MATTER_COLOR[style.matter];
  }

  private ghost(info: FxCardInfo | null, spot: { left: number; top: number; w: number; h: number }): HTMLElement {
    const el = document.createElement("div");
    el.dataset.fxGhost = "";
    el.style.cssText = `position:absolute;left:${spot.left}px;top:${spot.top}px;width:${spot.w}px;height:${spot.h}px;border-radius:8px;overflow:hidden;pointer-events:none;background:#111;box-shadow:0 10px 30px rgb(0 0 0 / .7),0 0 0 2px ${info?.color ?? "#fff"},0 0 24px 4px ${rgba(info?.color ?? "#ffffff", 0.55)}`;
    if (info?.image) {
      const img = document.createElement("img");
      img.src = info.image;
      img.alt = "";
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
      el.appendChild(img);
    } else {
      el.textContent = info?.name ?? "";
      el.style.cssText += ";display:flex;align-items:center;justify-content:center;text-align:center;padding:6px;font:600 12px system-ui;color:#e8eef3";
    }
    this.layer.appendChild(el);
    return el;
  }

  private async retire(el: HTMLElement | null) {
    if (!el) return;
    await el
      .animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(16px) scale(.92)" }], { duration: 320 * this.scale, fill: "forwards" })
      .finished.catch(() => undefined);
    el.remove();
  }

  /** La carte qui se résout : un sort vient de la main de son joueur ; une capacité part de son unité. */
  private async cast(def: number, seat: number | null, source: number | null, info: FxCardInfo | null, me: number | null, spell: boolean) {
    const previous = this.castGhost;
    this.castGhost = null;
    void this.retire(previous?.el ?? null);
    const from = !spell && source !== null ? this.objBox(source) : null;
    if (from) {
      // Une capacité : son unité s'illumine, les effets partent d'elle.
      const color = info?.color ?? "#ffffff";
      this.castGhost = { el: document.createElement("div"), def, box: from };
      this.ring(from.x, from.y, color, from.w, 600, 3);
      this.burst(from.x, from.y, ["#ffffff", color], 16, 140, 0.5, 2);
      return;
    }
    const spot = this.castSpot();
    const el = this.ghost(info, spot);
    const box: Box = { x: spot.left + spot.w / 2, y: spot.top + spot.h / 2, w: spot.w, h: spot.h, l: spot.left, t: spot.top };
    this.castGhost = { el, def, box };
    const fromY = seat === me ? window.innerHeight - spot.top : -spot.top - spot.h;
    await el
      .animate(
        [
          { transform: `translate(${-spot.w}px, ${fromY}px) scale(.5) rotate(${seat === me ? -8 : 8}deg)`, opacity: 0.2 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 380 * this.scale, easing: "cubic-bezier(.2,.8,.2,1)" },
      )
      .finished.catch(() => undefined);
    // Elle reste le temps de ses effets, puis rejoint la défausse.
    window.setTimeout(() => {
      if (this.castGhost?.el === el) this.castGhost = null;
      void this.retire(el);
    }, 1900 * this.scale);
  }

  private origin(): Point {
    if (this.castGhost) return { x: this.castGhost.box.x, y: this.castGhost.box.y };
    const spot = this.castSpot();
    return { x: spot.left + spot.w / 2, y: spot.top + spot.h / 2 };
  }

  private async strike(style: FxStyle, targets: { obj: number; amount: number }[], fromCast: boolean) {
    const boxes = targets.map((target) => this.objBox(target.obj)).filter((b): b is Box => b !== null);
    if (boxes.length === 0) return;
    if (!fromCast) {
      // Des dégâts sans carte (un effet permanent) : un simple impact.
      for (const b of boxes) {
        this.burst(b.x, b.y, ["#ffffff", style.color], 18, 200, 0.45, 2.2);
        this.ring(b.x, b.y, style.color, 50, 380);
      }
      return;
    }
    await this.wait(140);
    const from = this.origin();
    const draw = MATTER_HIT[style.matter];
    await draw(this, from, boxes, style.color);
  }

  private async clash(bf: number | null, targets: { obj: number; amount: number }[]) {
    const field = bf === null ? null : this.root().querySelector(`[data-bf="${bf}"]`);
    const zone = field ? this.box(field) : null;
    if (zone) {
      this.shake(5, 260);
      void this.fx(420, (k) => {
        if (k < 0.3) {
          for (let j = 0; j < 8; j += 1) {
            this.particle({ x: zone.x + rnd(-zone.w * 0.25, zone.w * 0.25), y: zone.y + rnd(-6, 6), vx: rnd(-260, 260), vy: rnd(-200, 120), life: 0.35, size: 1.8, color: j % 2 ? "#fde68a" : "#ffffff", g: 500 });
          }
        }
        this.disc(zone.x, zone.y, 90 * (1 - k), "#fbbf24", 0.5);
      });
    }
    for (const target of targets) {
      const b = this.objBox(target.obj);
      if (b) this.burst(b.x, b.y, ["#ffffff", "#fca5a5"], 12, 160, 0.4, 2);
    }
  }

  private async die(obj: number, style: FxStyle | null) {
    const b = this.objBox(obj);
    if (!b) return;
    const color = this.colorOf(style, "#94a3b8");
    for (let i = 0; i < 34; i += 1) {
      this.particle({ x: rnd(b.l, b.l + b.w), y: rnd(b.t, b.t + b.h), vx: rnd(-20, 20), vy: rnd(-70, -20), life: rnd(0.6, 1.2), size: rnd(1.5, 3.5), color: i % 3 ? "#6b7280" : color, add: i % 3 === 0, g: -10 });
    }
  }

  private async might(obj: number, delta: number, style: FxStyle | null) {
    const b = this.objBox(obj);
    if (!b) return;
    const up = delta > 0;
    const color = this.colorOf(style, up ? "#fbbf24" : "#a78bfa");
    this.floatText(b, `${up ? "+" : "−"}${Math.abs(delta)}`, up ? "#4ade80" : "#c4b5fd");
    await this.fx(900, (k) => {
      if (up) {
        const ctx = this.ctx;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(b.x, b.t + b.h, b.w * (0.5 + k * 0.5), b.w * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else this.disc(b.x, b.y, 40, color, 0.5 * (1 - k));
      if (Math.random() < 0.9) {
        this.particle({ x: rnd(b.l, b.l + b.w), y: up ? b.t + b.h : b.t, vy: up ? rnd(-110, -60) : rnd(50, 100), life: 0.7, size: rnd(1.5, 3), color: Math.random() < 0.5 ? color : up ? "#fef3c7" : "#ede9fe", drag: 1 });
      }
    });
  }

  private async stun(obj: number, style: FxStyle | null) {
    const b = this.objBox(obj);
    if (!b) return;
    const color = this.colorOf(style, "#fbbf24");
    this.burst(b.x, b.t, ["#fde68a", color], 14, 120, 0.4, 2);
    await this.fx(1600, (k) => {
      for (let s = 0; s < 3; s += 1) {
        const a = k * 12 + (s * Math.PI * 2) / 3;
        this.ctx.globalAlpha = Math.min(1, (1 - k) * 3);
        this.star(b.x + Math.cos(a) * b.w * 0.55, b.t + 2 + Math.sin(a) * 8, 5.5, color);
      }
    });
  }

  private async shield(obj: number, style: FxStyle | null) {
    const b = this.objBox(obj);
    if (!b) return;
    const color = this.colorOf(style, "#67e8f9");
    await this.fx(1000, (k) => {
      const s = Math.min(1, k / 0.25);
      const a = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      const ctx = this.ctx;
      const r = b.h * 0.62 * (0.8 + 0.2 * s);
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i += 1) {
        const t = (i * Math.PI) / 3 + Math.PI / 6;
        if (i) ctx.lineTo(b.x + Math.cos(t) * r * 0.8, b.y + Math.sin(t) * r);
        else ctx.moveTo(b.x + Math.cos(t) * r * 0.8, b.y + Math.sin(t) * r);
      }
      ctx.stroke();
      ctx.globalAlpha = a * 0.18;
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  private async heal(obj: number) {
    const b = this.objBox(obj);
    if (!b) return;
    await this.fx(900, () => {
      if (Math.random() < 0.8) this.particle({ x: rnd(b.l, b.l + b.w), y: rnd(b.t, b.t + b.h), vy: -40, life: 0.6, size: 2.4, color: "#86efac" });
    });
  }

  private async move(objs: number[], style: FxStyle | null) {
    const color = this.colorOf(style, "#99f6e4");
    for (const obj of objs) {
      const b = this.objBox(obj);
      if (!b) continue;
      for (let j = 0; j < 18; j += 1) {
        const a = rnd(0, Math.PI * 2);
        this.particle({ x: b.x + Math.cos(a) * b.w * 0.7, y: b.y + Math.sin(a) * b.h * 0.5, vx: -Math.sin(a) * 120, vy: Math.cos(a) * 80, life: 0.5, size: 1.8, color });
      }
    }
  }

  private async vanish(obj: number, banish: boolean, style: FxStyle | null) {
    const b = this.objBox(obj);
    if (!b) return;
    const color = this.colorOf(style, banish ? "#c084fc" : "#99f6e4");
    await this.fx(900, (k) => {
      for (let j = 0; j < 5; j += 1) {
        const a = rnd(0, Math.PI * 2);
        const r = rnd(30, 80) * (1 - k * 0.5);
        this.particle({ x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 2 - Math.sin(a) * 140, vy: -Math.sin(a) * r * 1.2 + Math.cos(a) * 90, life: 0.4, size: 2, color: j % 2 ? color : banish ? "#3b0764" : "#ffffff" });
      }
      this.disc(b.x, b.y, 30 + 30 * k, color, 1 - k);
    });
  }

  /** Une carte contrée se brise en deux. */
  private async counter(def: number, seat: number | null, info: FxCardInfo | null, me: number | null, style: FxStyle) {
    let current = this.castGhost?.def === def && this.castGhost.el.isConnected ? this.castGhost.el : null;
    if (!current) {
      await this.cast(def, seat, null, info, me, true);
      current = this.castGhost?.el ?? null;
    }
    if (!current) return;
    this.castGhost = null;
    const b = this.box(current);
    current.remove();
    const halves = [
      ["polygon(0 0, 62% 0, 38% 100%, 0 100%)", -1],
      ["polygon(62% 0, 100% 0, 100% 100%, 38% 100%)", 1],
    ] as const;
    this.burst(b.x, b.y, ["#ffffff", "#e2e8f0", this.colorOf(style, "#94a3b8")], 30, 260, 0.6, 2, 300);
    await Promise.all(
      halves.map(([clip, side]) => {
        const half = this.ghost(info, { left: b.l, top: b.t, w: b.w, h: b.h });
        half.style.clipPath = clip;
        half.style.boxShadow = "none";
        return half
          .animate([{ transform: "none", opacity: 1 }, { transform: `translate(${side * 60}px, 70px) rotate(${side * 24}deg)`, opacity: 0 }], { duration: 800 * this.scale, easing: "cubic-bezier(.4,0,.8,.6)", fill: "forwards" })
          .finished.catch(() => undefined)
          .finally(() => half.remove());
      }),
    );
  }

  private async summon(obj: number, style: FxStyle | null) {
    const b = this.objBox(obj);
    if (!b) return;
    const color = this.colorOf(style, "#eab308");
    await this.fx(800, (k) => {
      const ctx = this.ctx;
      const r = b.w * 0.55 + 6 * Math.sin(k * 3);
      const cy = b.t + b.h * 0.9;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(b.x, cy, r * 2, r * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(b.x, cy, r * 1.6, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 16; i += 1) {
        const t = (i / 16) * Math.PI * 2 + k * 2.5;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(t) * r * 1.6, cy + Math.sin(t) * r * 0.55);
        ctx.lineTo(b.x + Math.cos(t) * r * 2, cy + Math.sin(t) * r * 0.7);
        ctx.stroke();
      }
      if (Math.random() < 0.7) this.particle({ x: b.x + rnd(-r * 2, r * 2), y: cy + rnd(-6, 6), vy: rnd(-90, -40), life: 0.6, size: 2, color });
    });
  }

  private async draw(count: number, style: FxStyle | null) {
    const hand = this.root().querySelector("[data-play-hand]");
    if (!hand) return;
    const to = this.box(hand);
    const from = { x: window.innerWidth - 24, y: Math.min(window.innerHeight - 24, to.y) };
    const color = this.colorOf(style, "#7cc4ff");
    const electric = style?.matter === "eclair";
    for (let n = 0; n < Math.min(count, 3); n += 1) {
      await this.fx(480, (k) => {
        const e = easeOut(k);
        const x = from.x + (to.x - from.x) * e;
        const y = from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * 60;
        if (electric && Math.random() < 0.5) this.glowLine(bolt(x - 10, y - 10, x + 10, y + 10, 14), color, 1);
        this.disc(x, y, 14, color);
        this.particle({ x, y, vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.35, size: 2, color });
      }, [{ k: 1, fn: () => this.burst(to.x, to.y, ["#ffffff", color], 14, 120, 0.4, 1.8) }]);
    }
  }

  // Ce dont les matières ont besoin.
  readonly api = {
    fx: (dur: number, draw: (k: number) => void, marks: Mark[] = []) => this.fx(dur, draw, marks),
    wait: (ms: number) => this.wait(ms),
    particle: (p: Partial<Particle> & { x: number; y: number }) => this.particle(p),
    burst: (x: number, y: number, colors: string[], n?: number, speed?: number, life?: number, size?: number, g?: number) =>
      this.burst(x, y, colors, n, speed, life, size, g),
    ring: (x: number, y: number, color: string, maxR?: number, dur?: number, width?: number) => this.ring(x, y, color, maxR, dur, width),
    disc: (x: number, y: number, r: number, color: string, alpha?: number) => this.disc(x, y, r, color, alpha),
    glowLine: (pts: [number, number][], color: string, width: number) => this.glowLine(pts, color, width),
    flash: (color: string, peak?: number, dur?: number) => this.flash(color, peak, dur),
    shake: (px?: number, dur?: number) => this.shake(px, dur),
    snowflake: (x: number, y: number, r: number, alpha: number) => this.snowflake(x, y, r, alpha),
    ctx: () => this.ctx,
  };
}

type Api = FxEngine["api"];
type Hit = (engine: FxEngine, from: Point, targets: Box[], color: string) => Promise<void>;

/** Chaque cible à son tour, un peu décalée. */
function each(engine: FxEngine, targets: Box[], gap: number, one: (b: Box, api: Api) => Promise<void>): Promise<void> {
  return Promise.all(
    targets.map(async (b, i) => {
      if (i) await engine.api.wait(i * gap);
      await one(b, engine.api);
    }),
  ).then(() => undefined);
}

/** Comment chaque matière frappe : de la carte qui se résout (`from`) vers chaque cible. */
const MATTER_HIT: Record<Matter, Hit> = {
  eclair: (engine, _from, targets) =>
    each(engine, targets, 160, (b, api) => {
      let pts: [number, number][] = [];
      let forks: [number, number][][] = [];
      let tick = -1;
      const top = b.x + rnd(-60, 60);
      return api.fx(
        800,
        (k) => {
          const f = Math.floor(k * 10);
          if (f !== tick) {
            tick = f;
            pts = bolt(top, -10, b.x, b.y, 90);
            forks = [0, 1].map(() => {
              const p = pts[Math.floor(rnd(0.3, 0.7) * pts.length)];
              return bolt(p[0], p[1], p[0] + rnd(-70, 70), p[1] + rnd(30, 80), 30).slice(0, 40);
            });
            if (f === 0 || f === 4) api.flash("#dff3ff", f ? 0.14 : 0.24, 200);
          }
          if ([0, 1, 2, 4, 5, 7].includes(f)) {
            api.ctx().globalAlpha = f > 5 ? 0.6 : 1;
            api.glowLine(pts, "#7cc4ff", 4.5);
            for (const fork of forks) api.glowLine(fork, "#7cc4ff", 1.8);
          }
          api.disc(b.x, b.y, 50 * (1 - k), "#a5d8ff", 0.9);
        },
        [{ k: 0.08, fn: () => { api.burst(b.x, b.y, ["#ffffff", "#a5d8ff", "#60a5fa"], 30, 300, 0.5, 2.2); api.ring(b.x, b.y, "#a5d8ff", 60, 420); } }],
      );
    }),
  astral: (engine, _from, targets) =>
    each(engine, targets, 260, (b, api) => {
      const s = { x: b.x - 360, y: -60 };
      return api.fx(700, (k) => {
        if (k >= 1) return;
        const e = easeIn(k);
        const x = s.x + (b.x - s.x) * e;
        const y = s.y + (b.y - s.y) * e;
        ["#fff7ed", "#fdba74", "#f472b6", "#fde68a"].forEach((color) =>
          api.particle({ x: x + rnd(-4, 4), y: y + rnd(-4, 4), vx: rnd(-30, 10) - 60, vy: rnd(-40, 0) - 50, life: rnd(0.25, 0.55), size: rnd(2, 5), color }),
        );
        api.disc(x, y, 26, "#fdba74");
        api.disc(x, y, 9, "#ffffff");
      }, [{ k: 1, fn: () => {
        api.flash("#ffe8c7", 0.16, 200);
        api.burst(b.x, b.y, ["#fff7ed", "#fdba74", "#fb923c", "#f472b6"], 44, 320, 0.8, 3, 120);
        api.ring(b.x, b.y, "#fdba74", 95, 600, 4);
        api.ring(b.x, b.y, "#f472b6", 60, 450, 2);
        api.shake(4, 240);
      } }]);
    }),
  feu: async (engine, from, targets) => {
    const api = engine.api;
    await api.fx(1300, (k) => {
      if (k < 0.82) {
        for (let j = 0; j < 16; j += 1) {
          const b = targets[Math.floor(Math.random() * targets.length)];
          const a = Math.atan2(b.y - from.y, b.x - from.x) + rnd(-0.16, 0.16);
          const v = (Math.hypot(b.x - from.x, b.y - from.y) + rnd(-10, 40)) / 0.42;
          api.particle({ x: from.x + rnd(-6, 6), y: from.y + rnd(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.4, 0.55), size: rnd(3, 6), grow: 3.2, drag: 0.985, color: fire, alpha: 0.75 });
        }
      }
      api.disc(from.x, from.y, 40, "#fb923c", 0.8 * (1 - k));
    }, targets.map((b, i) => ({ k: 0.42 + i * 0.08, fn: () => api.burst(b.x, b.y, ["#fde68a", "#fb923c", "#ef4444"], 18, 160, 0.7, 2.5, -80) })));
  },
  arcane: (engine, from, targets) =>
    each(engine, targets, 200, (b, api) =>
      api.fx(850, (k) => {
        const g = Math.min(1, k / 0.22);
        const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        api.ctx().globalAlpha = fade;
        api.glowLine([[from.x, from.y], [from.x + (b.x - from.x) * g, from.y + (b.y - from.y) * g]], "#22d3ee", 4 + 2 * Math.sin(k * 40));
        api.disc(from.x, from.y, 30, "#67e8f9", fade);
        if (g >= 1) {
          api.disc(b.x, b.y, 34 + 6 * Math.sin(k * 50), "#67e8f9", fade);
          if (Math.random() < 0.8) api.particle({ x: b.x, y: b.y, vx: rnd(-160, 160), vy: rnd(-160, 60), life: 0.4, size: 2, color: "#cffafe" });
        }
      }, [{ k: 0.24, fn: () => api.ring(b.x, b.y, "#67e8f9", 55, 400) }]),
    ),
  lumiere: (engine, _from, targets) =>
    each(engine, targets, 200, (b, api) =>
      api.fx(900, (k) => {
        const ctx = api.ctx();
        const w = (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * 46;
        if (w > 0) {
          const grad = ctx.createLinearGradient(b.x - w, 0, b.x + w, 0);
          grad.addColorStop(0, "rgba(253,230,138,0)");
          grad.addColorStop(0.5, "rgba(255,251,235,0.95)");
          grad.addColorStop(1, "rgba(253,230,138,0)");
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = grad;
          ctx.fillRect(b.x - w, 0, w * 2, b.y);
        }
        api.disc(b.x, b.y, 70 * (1 - k * 0.6), "#fde68a", 1 - k);
      }, [{ k: 0.18, fn: () => { api.flash("#fff8db", 0.18, 260); api.burst(b.x, b.y, ["#fffbeb", "#fde68a"], 26, 220, 0.8, 2, -40); api.ring(b.x, b.y, "#fde68a", 80, 600, 3); } }]),
    ),
  explosif: (engine, from, targets) =>
    each(engine, targets, 180, (b, api) => {
      const c = { x: (from.x + b.x) / 2, y: Math.min(from.y, b.y) - 170 };
      let prev: [number, number] = [from.x, from.y];
      return api.fx(650, (k) => {
        const p = bez(from, c, b, easeIn(k));
        api.particle({ x: p.x, y: p.y, vx: rnd(-15, 15), vy: rnd(-25, -5), life: 0.7, size: 4, grow: 2, color: "rgb(150,140,130)", add: false, alpha: 0.4 });
        api.particle({ x: p.x, y: p.y, vx: rnd(-40, 40), vy: rnd(-40, 40), life: 0.18, size: 2.5, color: "#fbbf24" });
        api.glowLine([prev, [p.x, p.y]], "#f59e0b", 2);
        api.disc(p.x, p.y, 10, "#fde68a");
        prev = [p.x, p.y];
      }, [{ k: 1, fn: () => {
        api.burst(b.x, b.y, ["#fff7ed", "#fbbf24", "#f97316", "#ef4444"], 46, 380, 0.55, 3);
        for (let j = 0; j < 14; j += 1) {
          api.particle({ x: b.x + rnd(-14, 14), y: b.y + rnd(-14, 14), vx: rnd(-60, 60), vy: rnd(-80, -10), life: rnd(0.8, 1.3), size: rnd(6, 10), grow: 2.4, add: false, color: "rgb(70,64,60)", alpha: 0.55 });
        }
        api.ring(b.x, b.y, "#fbbf24", 85, 450, 4);
        api.shake(6, 300);
      } }]);
    }),
  acier: (engine, _from, targets) =>
    each(engine, targets, 160, (b, api) => {
      const r = b.h * 0.75;
      return api.fx(620, (k) => {
        ([[-0.9, 0.55], [0.9, -0.5]] as const).forEach(([a0, tilt], j) => {
          const kk = Math.min(1, Math.max(0, (k - j * 0.22) / 0.22));
          if (kk <= 0) return;
          const side = j ? -1 : 1;
          const a1 = a0 + side * 1.1 * kk;
          const pts: [number, number][] = [];
          for (let s = 0; s <= 12; s += 1) {
            const a = a0 + (a1 - a0) * (s / 12);
            pts.push([b.x + Math.cos(a + tilt) * r * 0.55 - side * r * 0.1, b.y + Math.sin(a + tilt) * r * 0.55]);
          }
          api.ctx().globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
          api.glowLine(pts, j ? "#f43f5e" : "#e2e8f0", 2.6);
          if (kk < 1) {
            const p = pts[pts.length - 1];
            for (let q = 0; q < 3; q += 1) api.particle({ x: p[0], y: p[1], vx: rnd(-200, 200), vy: rnd(-200, 120), life: 0.3, size: 1.6, color: "#f8fafc", g: 400 });
          }
        });
      });
    }),
  poing: (engine, _from, targets) =>
    each(engine, targets, 200, (b, api) => {
      const lines = Array.from({ length: 14 }, () => ({ a: rnd(0, Math.PI * 2), r0: rnd(70, 120) }));
      return api.fx(560, (k) => {
        const ctx = api.ctx();
        if (k < 0.3) {
          const kk = k / 0.3;
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "#fecaca";
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.8;
          for (const line of lines) {
            const r1 = line.r0 * (1 - kk);
            ctx.beginPath();
            ctx.moveTo(b.x + Math.cos(line.a) * r1, b.y + Math.sin(line.a) * r1 * 0.7);
            ctx.lineTo(b.x + Math.cos(line.a) * (r1 + 30), b.y + Math.sin(line.a) * (r1 + 30) * 0.7);
            ctx.stroke();
          }
        } else api.disc(b.x, b.y, 70 * (1 - (k - 0.3) / 0.7), "#fca5a5", 1 - (k - 0.3) / 0.7);
      }, [{ k: 0.3, fn: () => { api.burst(b.x, b.y, ["#ffffff", "#fca5a5", "#f87171"], 24, 300, 0.4, 2.5); api.ring(b.x, b.y, "#fecaca", 70, 380, 6); api.shake(9, 260); } }]);
    }),
  glace: (engine, from, targets) =>
    each(engine, targets, 160, (b, api) => {
      const shards = Array.from({ length: 7 }, (_, j) => ({ d: j * 0.06, o: rnd(-40, 40) }));
      return api.fx(820, (k) => {
        const ctx = api.ctx();
        for (const shard of shards) {
          const kk = Math.min(1, Math.max(0, (k - shard.d) / 0.42));
          if (kk <= 0 || kk >= 1) continue;
          const sy = from.y + shard.o;
          const x = from.x + (b.x - from.x) * kk;
          const y = sy + (b.y - sy) * kk;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.atan2(b.y - sy, b.x - from.x));
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "#e0f2fe";
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(-10, -3.5);
          ctx.lineTo(-10, 3.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          api.particle({ x, y, vy: 10, life: 0.3, size: 1.6, color: "#bae6fd" });
        }
        if (k > 0.5) api.snowflake(b.x, b.y, 42 * easeOut((k - 0.5) / 0.5), 1 - (k - 0.5) / 0.5);
      }, [{ k: 0.5, fn: () => api.burst(b.x, b.y, ["#ffffff", "#bae6fd", "#7dd3fc"], 26, 180, 1, 2, 60) }]);
    }),
  neant: (engine, _from, targets) =>
    each(engine, targets, 200, (b, api) => {
      const spikes = Array.from({ length: 7 }, (_, j) => ({ x: b.l + (b.w * (j + 0.5)) / 7 + rnd(-4, 4), h: rnd(0.7, 1.25) * b.h, w: rnd(5, 9), d: rnd(0, 0.12) }));
      return api.fx(900, (k) => {
        const ctx = api.ctx();
        if (k < 0.35) {
          for (let j = 0; j < 5; j += 1) {
            const a = rnd(0, Math.PI * 2);
            const r = rnd(50, 90);
            api.particle({ x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r * 2.6 + Math.sin(a) * 90, vy: -Math.sin(a) * r * 1.5, life: 0.35, size: 2.2, color: j % 2 ? "#c084fc" : "#7e22ce" });
          }
        }
        const base = b.t + b.h + 8;
        for (const spike of spikes) {
          const kk = (k - 0.3 - spike.d) / 0.5;
          if (kk <= 0 || kk >= 1) continue;
          const h = spike.h * Math.sin(Math.PI * Math.min(1, kk * 1.4));
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.95;
          const g = ctx.createLinearGradient(0, base, 0, base - h);
          g.addColorStop(0, "rgba(88,28,135,0.9)");
          g.addColorStop(0.7, "#c084fc");
          g.addColorStop(1, "#f5d0fe");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(spike.x - spike.w, base);
          ctx.lineTo(spike.x, base - h);
          ctx.lineTo(spike.x + spike.w, base);
          ctx.closePath();
          ctx.fill();
        }
      }, [{ k: 0.45, fn: () => api.ring(b.x, b.y, "#c084fc", 75, 500, 3) }]);
    }),
  ombre: (engine, _from, targets) =>
    each(engine, targets, 180, (b, api) => {
      const tendrils = Array.from({ length: 5 }, (_, j) => ({ x: b.l + (b.w * (j + 0.5)) / 5, ph: rnd(0, 6), side: j % 2 ? 1 : -1 }));
      return api.fx(1000, (k) => {
        const grow = Math.min(1, k / 0.45);
        api.ctx().globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        for (const t of tendrils) {
          const pts: [number, number][] = [];
          const len = (b.h + 20) * grow;
          for (let s = 0; s <= 16; s += 1) {
            const f = s / 16;
            pts.push([t.x + Math.sin(f * 6 + t.ph + k * 8) * 9 * f + t.side * f * f * b.w * 0.35, b.t + b.h + 14 - len * f]);
          }
          api.glowLine(pts, "#22c55e", 1.6);
        }
        if (Math.random() < 0.6) api.particle({ x: rnd(b.l, b.l + b.w), y: b.t + b.h, vx: rnd(-10, 10), vy: rnd(-90, -40), life: 0.9, size: rnd(3, 6), grow: 1.5, color: "#86efac", alpha: 0.45 });
      }, [{ k: 0.45, fn: () => api.disc(b.x, b.y, 60, "#4ade80", 0.7) }]);
    }),
  vent: (engine, from, targets) =>
    each(engine, targets, 150, (b, api) =>
      api.fx(700, (k) => {
        const ctx = api.ctx();
        const a = Math.atan2(b.y - from.y, b.x - from.x);
        for (let j = 0; j < 3; j += 1) {
          const kk = Math.min(1, Math.max(0, (k - j * 0.1) / 0.6));
          if (kk <= 0 || kk >= 1) continue;
          const x = from.x + (b.x - from.x) * kk;
          const y = from.y + (b.y - from.y) * kk + Math.sin(kk * 6 + j) * 16;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a);
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "#ccfbf1";
          ctx.globalAlpha = 0.85 * (1 - kk * 0.4);
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(0, 0, 22, -1.1, 1.1);
          ctx.stroke();
          ctx.restore();
          api.particle({ x, y, vx: -Math.cos(a) * 80, vy: -Math.sin(a) * 80, life: 0.3, size: 1.5, color: "#99f6e4" });
        }
      }, [{ k: 0.62, fn: () => api.burst(b.x, b.y, ["#ccfbf1", "#5eead4"], 20, 220, 0.5, 1.8) }]),
    ),
  domaine: (engine, from, targets, color) =>
    each(engine, targets, 160, (b, api) =>
      api.fx(520, (k) => {
        const e = easeIn(k);
        const x = from.x + (b.x - from.x) * e;
        const y = from.y + (b.y - from.y) * e - Math.sin(k * Math.PI) * 50;
        api.disc(x, y, 18, color);
        api.particle({ x, y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.3, size: 3, color });
      }, [{ k: 1, fn: () => { api.burst(b.x, b.y, ["#ffffff", color], 26, 240, 0.5, 2.5); api.ring(b.x, b.y, color, 60, 420); } }]),
    ),
};
