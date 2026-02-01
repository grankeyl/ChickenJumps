import { Container, Text, Sprite, Assets, Graphics } from "pixi.js";
import { ASSETS } from "../config/assets.config";

export class CashButton extends Container {
    private bgSprite?: Sprite;
    private txt = new Text({
        text: "CASHOUT",
        style: {
            fontFamily: "Golos Text",
            fill: 0x483C1A,
            fontSize: 18,
            fontWeight: "800",
            letterSpacing: 0.08,
            align: "center"
        }
    });
    private amountTxt: Text;
    private dollarIcon = new Container();
    private _enabled = true;
    private targetAlpha = 0;

    constructor(onClick: () => void) {
        super();
        this.eventMode = "static";
        this.cursor = "pointer";
        this.visible = false;
        this.alpha = 0;
        this.scale.set(0.95);

        this.amountTxt = new Text({
            text: "0",
            style: {
                fontFamily: "Golos Text",
                fill: 0x483C1A,
                fontSize: 18,
                fontWeight: "800",
                align: "center"
            }
        });

        // Иконка доллара в кружке
        // const iconBg = new Graphics();
        // iconBg.circle(0, 0, 11).fill({ color: 0x483C1A, alpha: 0.2 });
        // const dollarSign = new Text({
        //     text: "$",
        //     style: {
        //         fontFamily: "Golos Text",
        //         fill: 0x483C1A,
        //         fontSize: 14,
        //         fontWeight: "bold",
        //         align: "center"
        //     }
        // });
        // dollarSign.anchor.set(0.5);
        // this.dollarIcon.addChild(iconBg, dollarSign);

        this.txt.anchor.set(0, 0.5);
        this.amountTxt.anchor.set(0, 0.5);

        this.on("pointertap", () => {
            if (!this._enabled) return;
            this.animateClick();
            onClick();
        });

        this.loadBackground();
    }

    setAmount(v: number) {
        this.amountTxt.text = v.toFixed(2);
        this.draw(390, 80);
    }

    show() {
        this.visible = true;
        this.targetAlpha = 1;
        this.animateTransition();
    }

    hide() {
        this.targetAlpha = 0;
        this.animateTransition(() => {
            if (this.alpha < 0.01) this.visible = false;
        });
    }

    private animateTransition(onComplete?: () => void) {
        const duration = 200;
        const startTime = performance.now();
        const startAlpha = this.alpha;
        const startScale = this.scale.x;
        const targetScale = this.targetAlpha === 1 ? 1 : 0.95;

        const anim = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            this.alpha = startAlpha + (this.targetAlpha - startAlpha) * progress;
            const s = startScale + (targetScale - startScale) * progress;
            this.scale.set(s);

            if (progress < 1) {
                requestAnimationFrame(anim);
            } else if (onComplete) {
                onComplete();
            }
        };
        requestAnimationFrame(anim);
    }

    setEnabled(v: boolean) {
        this._enabled = v;
        this.alpha = v ? (this.visible ? 1 : 0) : 0.5;
    }

    draw(w: number, h: number) {
        if (this.bgSprite) {
            this.bgSprite.width = w;
            this.bgSprite.height = h;
        }

        const gap = 8;
        // Центрируем CASHOUT + Сумма
        const totalW = this.txt.width + gap + this.amountTxt.width;
        const startX = (w - totalW) / 2;

        this.txt.position.set(startX, h / 2.18);
        this.amountTxt.position.set(startX + this.txt.width + gap, h / 2.18);
        // this.dollarIcon.position.set(startX + this.txt.width + gap + this.amountTxt.width + gap + 11, h / 2.18);

        this.pivot.set(w / 2, h / 2);
    }

    private animateClick() {
        const duration = 150;
        const scaleDown = 0.94;
        const startTime = performance.now();
        const startScale = this.scale.x;

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            if (progress < 0.5) {
                const t = progress * 2;
                this.scale.set(startScale + (scaleDown - startScale) * t);
            } else {
                const t = (progress - 0.5) * 2;
                this.scale.set(scaleDown + (startScale - scaleDown) * t);
            }

            if (progress < 1) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    private async loadBackground() {
        try {
            await Assets.load(ASSETS.cashoutIcon);
            const tex = Assets.get(ASSETS.cashoutIcon);
            if (tex) {
                this.bgSprite = new Sprite(tex);
                this.bgSprite.width = 390;
                this.bgSprite.height = 80;
                this.addChild(this.bgSprite);
                this.addChild(this.txt);
                this.addChild(this.amountTxt);
                // this.addChild(this.dollarIcon);
                this.draw(390, 80);
            }
        } catch (err) {
            console.warn("Failed to load cashout background:", err);
        }
    }
}
