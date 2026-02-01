import { Container, Graphics, Text, Sprite, Assets } from "pixi.js";
import { FONT_FAMILY } from "../utils/fonts";
import { ASSETS } from "../config/assets.config";

export class SpinButton extends Container {
  private bgSprite?: Sprite;
  private txt = new Text({
    text: "PLAY",
    style: {
      fontFamily: FONT_FAMILY,
      fill: 0x5FFFCB,
      fontSize: 18,
      fontWeight: "800",
      align: "center"
    }
  });
  private _enabled = true;

  constructor(onClick: () => void) {
    super();
    this.eventMode = "static";
    this.cursor = "pointer";

    this.txt.anchor.set(0.5);

    this.on("pointertap", () => {
      if (!this._enabled) return;
      this.animateClick();
      onClick();
    });

    this.loadBackground();
    this.draw(418, 80);
  }

  isEnabled() {
    return this._enabled;
  }

  setEnabled(v: boolean) {
    this._enabled = v;
    this.alpha = v ? 1 : 0.55;
  }

  setText(text: string) {
    this.txt.text = text;
  }

  draw(w: number, h: number) {
    if (this.bgSprite) {
      this.bgSprite.width = w;
      this.bgSprite.height = h;
    }

    this.txt.position.set(w / 2, h / 2.18);

    // Set pivot to center for proper scale animation
    this.pivot.set(w / 2, h / 2);
  }

  private animateClick() {
    const duration = 150; // milliseconds
    const scaleDown = 0.94;
    const startTime = performance.now();
    const startScale = this.scale.x;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 0.5) {
        // Scale down phase (first half)
        const t = progress * 2; // 0 to 1
        const scale = startScale + (scaleDown - startScale) * t;
        this.scale.set(scale);
      } else {
        // Scale up phase (second half)
        const t = (progress - 0.5) * 2; // 0 to 1
        const scale = scaleDown + (startScale - scaleDown) * t;
        this.scale.set(scale);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.scale.set(startScale);
      }
    };

    requestAnimationFrame(animate);
  }

  private async loadBackground() {
    try {
      await Assets.load(ASSETS.playIcon);
      const tex = Assets.get(ASSETS.playIcon);
      if (tex) {
        this.bgSprite = new Sprite(tex);
        this.bgSprite.width = 418;
        this.bgSprite.height = 80;
        this.addChild(this.bgSprite);
        this.addChild(this.txt);
        this.draw(418, 80);
      }
    } catch (err) {
      console.warn("Failed to load play background:", err);
    }
  }
}