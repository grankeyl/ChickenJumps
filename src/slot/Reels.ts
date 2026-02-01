import * as PIXI from "pixi.js";
import { Reel } from "./Reel";

export class Reels extends PIXI.Container {
  reels: Reel[] = [];
  isSpinning = false;

  constructor() {
    super();

    for (let i = 0; i < 5; i++) {
      const reel = new Reel();
      reel.x = i * 140;
      this.reels.push(reel);
      this.addChild(reel);
    }
  }

  startSpin() {
    this.isSpinning = true;
    this.reels.forEach(r => r.start());
  }

  stopSpin(result: number[][]) {
    this.reels.forEach((r, i) => {
      r.stop(result[i]);
    });
    this.isSpinning = false;
  }
}