import { Ticker as PixiTicker } from "pixi.js";

export class Ticker {
  private t = PixiTicker.shared;

  bind(fn: (dt: number) => void) {
    this.t.add((ticker) => {
      // Pixi Ticker.deltaMS - время в миллисекундах с последнего кадра
      fn(ticker.deltaMS);
    });
  }
}