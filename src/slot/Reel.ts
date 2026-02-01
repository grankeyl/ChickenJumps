import * as PIXI from "pixi.js";

export class Reel extends PIXI.Container {
  symbols: PIXI.Text[] = [];
  speed = 25;
  spinning = false;

  constructor() {
    super();

    for (let i = 0; i < 3; i++) {
      const s = new PIXI.Text("🍗", { fontSize: 64 });
      s.y = i * 120;
      this.symbols.push(s);
      this.addChild(s);
    }

    PIXI.Ticker.shared.add(this.update);
  }

  start() {
    this.spinning = true;
  }

  stop(values: number[]) {
    this.spinning = false;
    this.symbols.forEach((s, i) => {
      s.text = ["🍗", "🐔", "🥚"][values[i]];
      s.y = i * 120;
    });
  }

  private update = () => {
    if (!this.spinning) return;

    for (const s of this.symbols) {
      s.y += this.speed;
      if (s.y >= 360) s.y -= 360;
    }
  };
}