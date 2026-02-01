import { Container, Graphics, Text } from "pixi.js";
import { formatMoney } from "../utils/math";
import { FONT_FAMILY } from "../utils/fonts";

export class BalanceUI extends Container {
  private bg = new Graphics();
  private valueText = new Text({
    text: "0",
    style: {
      fontFamily: "Golos Text",
      fill: 0xffffff,
      fontSize: 20,
      fontWeight: "600"
    }
  });

  constructor() {
    super();
    this.addChild(this.bg, this.valueText);
    this.valueText.anchor.set(0, 0.5); // Center left
    this.setBalance(5000);
  }

  setBalance(v: number) {
    this.valueText.text = formatMoney(v);
    this.draw();
  }

  private draw() {
    const w = 110;
    const h = 45;
    const pad = 12;
    const gap = 6;
    const iconSize = 25;

    this.bg.clear();
    // background: rgba(44, 188, 142, 0.40);
    this.bg.roundRect(0, 0, w, h, 12).fill({ color: 0x2cbc8e, alpha: 0.4 });
    // border: 1px solid #5DFAC9;
    this.bg.roundRect(0, 0, w, h, 12).stroke({ color: 0x5dfac9, alpha: 1, width: 1 });

    // Calculate total content width for centering
    const totalW = this.valueText.width + gap + iconSize;
    const startX = (w - totalW) / 2;

    this.valueText.position.set(startX, h / 2);

    // иконка плюса
    const circleX = startX + this.valueText.width + gap + iconSize / 2;
    // fill: #5DFAC9; width/height: 25px;
    this.bg.circle(circleX, h / 2, 12.5).fill({ color: 0x5dfac9, alpha: 1 });

    // Plus sign (simple rects)
    const plusColor = 0x0b5a43;
    this.bg.rect(circleX - 5, h / 2 - 1, 10, 2).fill({ color: plusColor, alpha: 1 });
    this.bg.rect(circleX - 1, h / 2 - 5, 2, 10).fill({ color: plusColor, alpha: 1 });
  }
}