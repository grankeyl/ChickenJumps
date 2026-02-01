import { Container, Graphics } from "pixi.js";

export function makePop(x: number, y: number) {
  const c = new Container();
  const g = new Graphics();
  g.circle(0, 0, 10).stroke({ color: 0xffffff, alpha: 0.9, width: 3 });
  c.addChild(g);
  c.position.set(x, y);
  return {
    node: c, update: (t: number) => {
      // t 0..1
      const r = 10 + t * 26;
      g.clear();
      g.circle(0, 0, r).stroke({ color: 0xffffff, alpha: (1 - t) * 0.9, width: 3 });
    }
  };
}

export function makeCrumble(x: number, y: number, w: number, h: number) {
  const c = new Container();
  const pieces: { g: Graphics, vx: number, vy: number, vr: number, isSmoke?: boolean, isSpark?: boolean }[] = [];

  // 1. Осколки платформы (20+ штук разного размера)
  const pieceCount = 20;
  for (let i = 0; i < pieceCount; i++) {
    const g = new Graphics();
    const pw = 4 + Math.random() * 20;
    const ph = 4 + Math.random() * 12;

    // Смесь серого и темно-синего
    const colors = [0x555555, 0x333333, 0x777777, 0x223344];
    const color = colors[Math.floor(Math.random() * colors.length)];
    g.roundRect(-pw / 2, -ph / 2, pw, ph, 2).fill({ color, alpha: 1 });

    g.position.set(Math.random() * w, Math.random() * h);
    c.addChild(g);

    pieces.push({
      g,
      vx: (Math.random() - 0.5) * 800,
      vy: -200 - Math.random() * 600,
      vr: (Math.random() - 0.5) * 20
    });
  }

  // 2. Яркие искры (желтые/оранжевые точки)
  for (let i = 0; i < 12; i++) {
    const g = new Graphics();
    const size = 2 + Math.random() * 3;
    g.circle(0, 0, size).fill({ color: 0xffaa00, alpha: 1 });

    g.position.set(Math.random() * w, Math.random() * h);
    c.addChild(g);

    pieces.push({
      g,
      vx: (Math.random() - 0.5) * 1200,
      vy: -Math.random() * 800,
      vr: 0,
      isSpark: true
    });
  }

  // 3. Дым (полупрозрачные облака)
  for (let i = 0; i < 8; i++) {
    const g = new Graphics();
    const r = 20 + Math.random() * 25;
    g.circle(0, 0, r).fill({ color: 0xcccccc, alpha: 0.4 });

    g.position.set(Math.random() * w, Math.random() * h);
    c.addChild(g);

    pieces.push({
      g,
      vx: (Math.random() - 0.5) * 200,
      vy: -100 - Math.random() * 150,
      vr: (Math.random() - 0.5) * 1,
      isSmoke: true
    });
  }

  c.position.set(x, y);

  return {
    node: c,
    update: (t: number) => {
      const dt = 1 / 60;
      for (const p of pieces) {
        if (p.isSmoke) {
          p.g.scale.set(1 + t * 4);
          p.vy -= 150 * dt;
          p.g.alpha = Math.max(0, 0.4 * (1 - t * 1.5));
        } else if (p.isSpark) {
          p.vy += 800 * dt;
          p.g.alpha = Math.max(0, 1 - t * 2.5);
          p.g.scale.set(Math.max(0, 1 - t));
        } else {
          p.vy += 1800 * dt;
          p.g.alpha = Math.max(0, 1 - t * 1.1);
        }

        p.g.x += p.vx * dt;
        p.g.y += p.vy * dt;
        p.g.rotation += p.vr * dt;
      }
    }
  };
}