import { Container, Graphics, Text, Assets } from "pixi.js";
import type { Game } from "../Game";
import { ASSETS } from "../config/assets.config";
import { FONT_FAMILY } from "../utils/fonts";

export class BootScene implements import("../Game").Scene {
  private root = new Container();
  private bg = new Graphics();
  private t = new Text({ text: "Loading…", style: { fontFamily: FONT_FAMILY, fill: 0xffffff, fontSize: 22 } });

  private w = 0;
  private h = 0;

  constructor(private game: Game) {}

  enter() {
    this.game.app.stage.addChild(this.root);
    this.t.anchor.set(0.5);
    this.root.addChild(this.bg, this.t);
    this.redraw();

    (async () => {
      // ✅ загрузка
      await Assets.load(Object.values(ASSETS));
      this.game.bus.emit("scene:game");
    })().catch((e) => {
      console.error(e);
      this.t.text = "Load error (см. console)";
    });
  }

  exit() {
    this.root.removeFromParent();
    this.root.destroy({ children: true });
  }

  update() {}

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.redraw();
  }

  private redraw() {
    const w = this.w || 800;
    const h = this.h || 600;

    this.bg.clear();
    this.bg.rect(0, 0, w, h).fill({ color: 0x0b0f16, alpha: 1 });

    this.t.position.set(w / 2, h / 2);
  }
}