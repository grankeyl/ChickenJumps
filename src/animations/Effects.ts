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

export function makeWinEffect(x: number, y: number) {
  const c = new Container();
  const particles: { g: Graphics, vx: number, vy: number, baseRotation: number }[] = [];

  // Яркие цвета для праздника
  const colors = [0xFFD700, 0xFF6B00, 0xFFFF00, 0xFF1744, 0x00E5FF, 0x76FF03, 0xFFFFFF];

  // Создаём много ярких частиц
  for (let i = 0; i < 50; i++) {
    const g = new Graphics();
    const size = 4 + Math.random() * 6;
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Простые яркие кружки
    g.circle(0, 0, size).fill({ color, alpha: 1 });

    g.position.set(0, 0);
    c.addChild(g);

    // Разлетаются во все стороны
    const angle = Math.random() * Math.PI * 2;
    const speed = 200 + Math.random() * 200;

    particles.push({
      g,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseRotation: Math.random() * Math.PI * 2
    });
  }

  c.position.set(x, y);

  return {
    node: c,
    update: (t: number) => {
      const dt = 1 / 60;
      for (const p of particles) {
        // Простое движение наружу
        p.g.x += p.vx * dt;
        p.g.y += p.vy * dt;

        // Немного гравитации
        p.vy += 150 * dt;

        // Затухание скорости
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Уменьшение размера
        const scale = 1 - t * 0.7;
        p.g.scale.set(scale);

        // Затухание
        p.g.alpha = Math.max(0, 1 - t * 0.9);
      }
    }
  };
}

export function makeFireworks(x: number, y: number) {
  const c = new Container();
  const particles: { g: Graphics, vx: number, vy: number, color: number, trail?: Graphics[] }[] = [];

  // Яркие цвета для фейерверка
  const colors = [0xFF1744, 0xFFD700, 0x00E5FF, 0x76FF03, 0xFF6D00, 0xE040FB, 0xFFFFFF];

  // Создаем несколько взрывов
  for (let burst = 0; burst < 3; burst++) {
    const burstX = (Math.random() - 0.5) * 300;
    const burstY = -Math.random() * 200;

    // Каждый взрыв содержит много частиц
    for (let i = 0; i < 25; i++) {
      const g = new Graphics();
      const size = 3 + Math.random() * 4;
      const color = colors[Math.floor(Math.random() * colors.length)];

      g.circle(0, 0, size).fill({ color, alpha: 1 });
      g.position.set(burstX, burstY);
      c.addChild(g);

      // Случайное направление взрыва
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 250;

      particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        color
      });
    }
  }

  // Конфетти (разноцветные прямоугольники)
  for (let i = 0; i < 40; i++) {
    const g = new Graphics();
    const w = 6 + Math.random() * 8;
    const h = 3 + Math.random() * 5;
    const color = colors[Math.floor(Math.random() * colors.length)];

    g.roundRect(-w / 2, -h / 2, w, h, 1).fill({ color, alpha: 1 });
    g.position.set((Math.random() - 0.5) * 200, -Math.random() * 100);
    c.addChild(g);

    particles.push({
      g,
      vx: (Math.random() - 0.5) * 400,
      vy: -300 - Math.random() * 300,
      color
    });
  }

  c.position.set(x, y);

  return {
    node: c,
    update: (t: number) => {
      const dt = 1 / 60;
      for (const p of particles) {
        // Гравитация
        p.vy += 600 * dt;

        // Затухание
        p.g.alpha = Math.max(0, 1 - t * 0.8);

        // Движение
        p.g.x += p.vx * dt;
        p.g.y += p.vy * dt;

        // Вращение для конфетти
        p.g.rotation += (p.vx / 100) * dt;

        // Мерцание
        const flicker = Math.sin(t * 30 + p.g.x) * 0.3 + 0.7;
        p.g.alpha *= flicker;
      }
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