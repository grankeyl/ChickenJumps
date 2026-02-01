import { Application } from "pixi.js";
import { EventBus } from "./core/EventBus";
import { Ticker } from "./core/Ticker";
import { resizeToFit } from "./utils/resize";
import { loadFonts } from "./utils/fonts";

import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

export type Scene = {
  enter(): void;
  exit(): void;
  update(dt: number): void;
  resize(w: number, h: number, dpr: number): void;
};

export class Game {
  public readonly app: Application;
  public readonly bus = new EventBus();
  public readonly ticker = new Ticker();

  private current: Scene | null = null;

  constructor(private mount: HTMLElement) {
    this.app = new Application();
  }

  async start() {
    await this.app.init({
      antialias: true,
      autoDensity: true,
      resolution: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
      // resizeTo: this.mount, // будем ресайзить вручную для надежности
      backgroundColor: 0x0b0f16, // ✅ чтобы не было “прозрачно/бело”
      backgroundAlpha: 1
    });

    this.mount.appendChild(this.app.canvas);

    // Загружаем шрифты
    await loadFonts();

    const onResize = () => {
      const { width, height, dpr } = resizeToFit(this.mount, this.app);
      this.current?.resize(width, height, dpr);
    };
    window.addEventListener("resize", onResize);

    this.ticker.bind((dt) => {
      this.current?.update(dt);
    });

    const boot = new BootScene(this);
    const game = new GameScene(this);

    this.bus.on("scene:game", () => {
      this.setScene(game);
      onResize(); // ✅ чтобы GameScene получил размеры сразу
    });

    this.setScene(boot);

    // Делаем несколько проходов ресайза для уверенности, что CSS flex/min осели
    onResize();
    requestAnimationFrame(() => onResize());
    setTimeout(() => onResize(), 100);
  }

  setScene(scene: Scene) {
    if (this.current) this.current.exit();
    this.current = scene;
    this.current.enter();
  }
}