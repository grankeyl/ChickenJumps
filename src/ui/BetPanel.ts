import { Container, Graphics, Text, Sprite, BlurFilter, Rectangle, Assets, Texture } from "pixi.js";
import { ASSETS } from "../config/assets.config";
import type { Difficulty } from "../config/game.config";
import { GAME_CFG } from "../config/game.config";
import { clamp, formatMoney } from "../utils/math";
import { FONT_FAMILY } from "../utils/fonts";

type Handlers = {
  onDifficulty: (d: Difficulty) => void;
  onBet: (bet: number) => void;
};

export class BetPanel extends Container {
  private blurredBg = new Sprite();
  private card = new Graphics();
  private diffButtonsContainer = new Container();
  private diffButtonsBg = new Graphics();
  private betRowBg = new Graphics();
  private betContainer = new Container();
  private dollarIconBet = new Container();

  private inputElement: HTMLInputElement | null = null;

  private winContainer = new Container();
  private winBg = new Sprite();
  private winMask = new Graphics();
  private winFrame = new Graphics();
  private winGlow = new Graphics(); // Эффект свечения

  // $ ICON (кружок)
  private winDollar = new Container();
  private winDollarBg = new Graphics();
  // @ts-ignore
  private winDollarText = new Text({
    text: "$",
    style: {
      fontFamily: "Golos Text",
      fill: 0x000000,
      fontSize: 20, // визуально ок внутри 34px круга
      fontWeight: "800",
      align: "center",
      stroke: { color: 0x000000, width: 0.7 },
    },
  });

  // @ts-ignore
  private winTitle = new Text({
    text: "Your Win!",
    style: {
      fontFamily: "Golos Text",
      fill: 0xffffff,
      fontSize: 18,
      fontWeight: "700",
      align: "center",
      lineHeight: 24, // 120%
      letterSpacing: 0.068,
      stroke: { color: 0x000000, width: 4 },
    },
  });

  // @ts-ignore
  private winAmount = new Text({
    text: "0",
    style: {
      fontFamily: "Golos Text",
      fill: 0xffffff,
      fontSize: 38,
      fontWeight: "800",
      align: "center",
      letterSpacing: 0.068,
      stroke: { color: 0x000000, width: 4 },
    },
  });

  private diffTitle = new Text({
    text: "Dificulty",
    style: {
      fontFamily: FONT_FAMILY,
      fill: 0xffffff,
      fontSize: 18,
      fontWeight: "500",
    },
  });

  private diffSubtitle = new Text({
    text: "Chance of being shot down",
    style: {
      fontFamily: FONT_FAMILY,
      fill: 0x7a8a9a,
      fontSize: 18,
      fontWeight: "500",
    },
  });

  private diffButtons: { key: Difficulty; container: Container; bg: Graphics; text: Text }[] = [];

  private betValueText = new Text({
    text: "0.5",
    style: {
      fontFamily: "Golos Text",
      fill: 0xffffff,
      fontSize: 20,
      fontWeight: "600",
      lineHeight: 24,
      letterSpacing: 0.068,
      align: "center",
    },
  });

  private btnMin!: Container;
  private btnMax!: Container;

  private quickBets: { node: Container; bg: Graphics; text: Text; icon: Container }[] = [];

  private _difficulty: Difficulty = "easy";
  private _bet = 0.5;
  private _maxBet = 5000;
  private _lift = 0;

  constructor(private handlers: Handlers) {
    super();

    this.blurredBg.filters = [new BlurFilter({ strength: 20, quality: 4 })];
    this.addChild(this.blurredBg);

    this.addChild(this.card);
    this.addChild(this.diffTitle, this.diffSubtitle);

    this.makeDiffButtons();
    this.makeBetRow();
    this.makeQuickBets();
    this.makeWinBlock();

    void this.initWinBg();
    this.initInputElement();

    this.layout(504, 729);
    this.setDifficulty("easy");
    this.setBet(1);
  }

  private async initWinBg() {
    try {
      const cached = Assets.get(ASSETS.cashoutBg) as Texture | undefined;
      const tex = cached ?? (await Assets.load(ASSETS.cashoutBg));
      this.winBg.texture = tex as any;
      this.winBg.visible = true;
      // чтобы не замыливалось при ресайзе
      (this.winBg.texture.baseTexture as any).scaleMode = "linear";
    } catch {
      this.winBg.visible = false;
    }
  }

  setDifficulty(d: Difficulty) {
    this._difficulty = d;

    const containerPadding = 4;
    const innerHeight = 52 - containerPadding * 2;
    const diffTotalW = this.diffButtonsContainer.width || 504 - 34 * 2;
    const diffBtnW = (diffTotalW - containerPadding * 2) / 4;

    for (let i = 0; i < this.diffButtons.length; i++) {
      const item = this.diffButtons[i];
      const isActive = item.key === d;
      item.bg.clear();

      if (isActive) {
        item.bg.roundRect(0, 0, diffBtnW, innerHeight, 12).fill({ color: 0xffffff, alpha: 0.1 });
      }

      item.text.style.fill = 0xffffff;
      item.text.alpha = isActive ? 1 : 0.3;
    }
  }

  setBet(v: number) {
    this._bet = clamp(v, GAME_CFG.bet.min, this._maxBet);
    this.betValueText.text = `${formatMoney(this._bet)}`;
    this.updateBetLayout();
  }

  setMaxBet(v: number) {
    this._maxBet = v;
    // Если текущая ставка стала больше нового максимума - корректируем
    if (this._bet > this._maxBet) {
      this.setBet(this._maxBet);
    }
  }

  setLift(y: number) {
    this._lift = y;
    this.layout(this.blurredBg.width, this.blurredBg.height);
  }

  set enabled(v: boolean) {
    this.eventMode = v ? "static" : "none";
    this.alpha = v ? 1 : 0.6;
  }

  private updateBetLayout() {
    const betRowW = this.betRowBg.width;
    const betRowH = this.betRowBg.height;
    if (betRowW === 0) return;

    const iconSize = 23;
    const gap = 4;
    const totalContentW = this.betValueText.width + gap + iconSize;

    this.betValueText.anchor.set(0.5, 0.5);
    this.betValueText.position.set(betRowW / 2, betRowH / 2);

    // this.dollarIconBet.position.set(
    //   this.betValueText.x + this.betValueText.width + gap + iconSize / 2,
    //   betRowH / 2
    // );

    if (this.inputElement && this.inputElement.style.display !== "none") {
      this.updateInputPosition();
    }
  }

  private initInputElement() {
    this.inputElement = document.createElement("input");
    this.inputElement.type = "text";
    this.inputElement.style.position = "absolute";
    this.inputElement.style.display = "none";
    this.inputElement.style.background = "transparent";
    this.inputElement.style.border = "none";
    this.inputElement.style.outline = "none";
    this.inputElement.style.color = "white";
    this.inputElement.style.fontFamily = "Golos Text, sans-serif";
    this.inputElement.style.fontSize = "20px";
    this.inputElement.style.fontWeight = "600";
    this.inputElement.style.textAlign = "center";
    this.inputElement.style.zIndex = "1000";
    this.inputElement.style.padding = "0";
    this.inputElement.style.margin = "0";
    this.inputElement.style.boxSizing = "border-box";
    this.inputElement.style.overflow = "visible";
    this.inputElement.style.lineHeight = "normal";

    this.inputElement.addEventListener("input", () => {
      if (this.inputElement && this.betValueText) {
        let val = parseFloat(this.inputElement.value.replace(/[^0-9.]/g, ""));

        // Проактивное ограничение при вводе
        if (!isNaN(val) && val > this._maxBet) {
          val = this._maxBet;
          this.inputElement.value = formatMoney(val);
        }

        this.betValueText.text = this.inputElement.value;
        this.updateBetLayout();
        this.updateInputPosition(); // Сдвигаем инпут вслед за меняющимся текстом
      }
    });

    this.inputElement.addEventListener("blur", () => this.hideInput());
    this.inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.hideInput();
      if (e.key === "Escape") {
        if (this.inputElement) this.inputElement.value = formatMoney(this._bet);
        this.hideInput();
      }
    });

    document.body.appendChild(this.inputElement);
  }

  private showInput() {
    if (!this.inputElement) return;

    this.inputElement.style.display = "block";
    this.inputElement.value = formatMoney(this._bet);
    this.updateInputPosition();

    // Скрываем PIXI текст через альфу на время редактирования (чтобы bounds работали)
    this.betValueText.alpha = 0;

    setTimeout(() => this.inputElement?.focus(), 10);
  }

  private hideInput() {
    if (!this.inputElement || this.inputElement.style.display === "none") return;

    this.inputElement.style.display = "none";
    this.betValueText.alpha = 1;

    const val = parseFloat(this.inputElement.value.replace(/[^0-9.]/g, ""));
    if (!isNaN(val)) {
      this.handlers.onBet(val);
    }
  }

  private updateInputPosition() {
    if (!this.inputElement) return;

    // Получаем позицию и размеры текста в мировых координатах (экранных)
    const bounds = this.betValueText.getBounds();
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();

    // Используем текущий масштаб компонента для точного совпадения размера шрифта
    const currentScale = this.scale.y;

    // Даем небольшой запас по ширине, чтобы текст никогда не обрезался при наборе
    const inputW = Math.max(bounds.width + 40 * currentScale, 100 * currentScale);
    const inputH = Math.max(bounds.height, 40 * currentScale);

    // Центрируем инпут по центру оригинального текста
    const centerX = canvasRect.left + (bounds.x + bounds.width / 2);
    const centerY = canvasRect.top + (bounds.y + bounds.height / 2);

    this.inputElement.style.left = `${centerX - inputW / 2}px`;
    this.inputElement.style.top = `${centerY - inputH / 2}px`;
    this.inputElement.style.width = `${inputW}px`;
    this.inputElement.style.height = `${inputH}px`;

    // Используем тот же размер шрифта, что и в PIXI, умноженный на масштаб
    this.inputElement.style.fontSize = `${20 * currentScale}px`;
    this.inputElement.style.caretColor = "white";
  }

  setBackgroundTexture(texture: any) {
    if (texture) this.blurredBg.texture = texture;
  }

  showWin(amount: number) {
    this.winContainer.visible = true;
    this.winContainer.alpha = 0;
    this.winContainer.scale.set(0.5);
    this.winContainer.rotation = -0.1; // Небольшой наклон в начале

    // Убираем любую прозрачность с фона
    this.winBg.alpha = 1;

    // сумма БЕЗ "$" — знак доллара отдельной иконкой
    this.winAmount.text = `${formatMoney(amount)}`;

    const duration = 400; // Увеличили длительность для более драматичного эффекта
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const p = Math.min(elapsed / duration, 1);

      // Elastic bounce эффект для масштаба - усилен
      let scaleEase;
      if (p < 0.5) {
        // Первая половина: быстрый рост
        const t = p * 2;
        scaleEase = t * t * (3 - 2 * t); // Smoothstep
      } else {
        // Вторая половина: bounce с большей амплитудой
        const t = (p - 0.5) * 2;
        scaleEase = 1 + Math.sin(t * Math.PI * 2.5) * 0.15 * (1 - t); // Более выраженный bounce
      }

      // Плавное появление альфы
      const alphaEase = Math.min(p * 2, 1);

      // Вращение возвращается к 0
      const rotationEase = 1 - Math.pow(1 - p, 3);

      // Эффект свечения - яркая вспышка в начале
      const glowIntensity = p < 0.3 ? (p / 0.3) : (1 - (p - 0.3) / 0.7);
      this.winGlow.alpha = glowIntensity * 0.4;

      this.winContainer.alpha = alphaEase;
      this.winContainer.scale.set(0.5 + scaleEase * 0.5);
      this.winContainer.rotation = -0.1 * (1 - rotationEase);

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        // Финальное состояние
        this.winContainer.alpha = 1;
        this.winContainer.scale.set(1);
        this.winContainer.rotation = 0;
        this.winGlow.alpha = 0;
      }
    };
    requestAnimationFrame(animate);

    this.layout(this.blurredBg.width, this.blurredBg.height);
  }

  hideWin() {
    this.winContainer.visible = false;
  }

  layout(w: number, h: number) {
    const pad = 34;

    this.blurredBg.width = w;
    this.blurredBg.height = h;

    this.card.clear();
    this.card.roundRect(0, 0, w, h, 56).fill({ color: 0x292238, alpha: 0.6 });
    this.card.roundRect(0, 0, w, h, 56).stroke({ color: 0x504569, width: 1 });

    const diffY = h * 0.46 + this._lift;
    this.diffTitle.position.set(pad, diffY);
    this.diffSubtitle.position.set(pad + this.diffTitle.width + 8, diffY);

    // ===== WIN BLOCK =====
    const winW = w - pad * 2;
    const winH = 96;
    const winRadius = 22;

    if (this.winContainer.visible) {
      this.winContainer.position.set(w / 2, diffY - 40 - winH / 2 + 20);
      this.winContainer.pivot.set(winW / 2, winH / 2);

      this.winBg.anchor.set(0, 0);
      this.winBg.position.set(0, 0);
      this.winBg.width = winW;
      this.winBg.height = winH;

      this.winMask.clear();
      this.winMask.roundRect(0, 0, winW, winH, winRadius).fill({ color: 0xffffff, alpha: 1 });
      this.winBg.mask = this.winMask; // Маскируем только фон

      // Эффект свечения - желтое свечение вокруг блока
      this.winGlow.clear();
      this.winGlow.roundRect(-8, -8, winW + 16, winH + 16, winRadius + 8).fill({ color: 0xffcc33, alpha: 0.6 });
      this.winGlow.position.set(0, 0);

      // рамка (можешь убрать/поменять цвет)
      this.winFrame.clear();
      this.winFrame.roundRect(0, 0, winW, winH, winRadius).stroke({ color: 0xffcc33, width: 4, alpha: 1 });

      // текст
      this.winTitle.anchor.set(0.5);
      this.winAmount.anchor.set(0.5);
      this.winTitle.alpha = 1; // Гарантируем непрозрачность
      this.winAmount.alpha = 1;

      this.winTitle.position.set(winW / 2, 22);

      // ===== центрирование: сумма + кружок $ как единый блок =====
      // const gap = 4;
      // const d = 34.286; // размер кружка
      // const totalW = this.winAmount.width + gap + d;

      // const startX = (winW - totalW) / 2;
      // const amountCenterX = startX + this.winAmount.width / 2;

      this.winAmount.position.set(winW / 2, 58);

      // const dollarCenterX = startX + this.winAmount.width + gap + d / 2;
      // this.winDollar.position.set(dollarCenterX, 58);
    }
    // =====================

    const diffBtnY = diffY + 38;
    const containerPadding = 4;
    const diffBtnH = 52;
    const innerHeight = diffBtnH - containerPadding * 2;
    const diffTotalW = w - pad * 2;
    const diffBtnW = (diffTotalW - containerPadding * 2) / 4;

    this.diffButtonsBg.clear();
    this.diffButtonsBg.roundRect(0, 0, diffTotalW, diffBtnH, 16).fill({ color: 0xffffff, alpha: 0.05 });

    for (let i = 1; i < 4; i++) {
      const dividerX = containerPadding + i * diffBtnW;
      this.diffButtonsBg.rect(dividerX - 0.5, containerPadding, 1, innerHeight).fill({ color: 0xffffff, alpha: 0.02 });
    }

    this.diffButtonsContainer.position.set(pad, diffBtnY);
    this.diffButtonsContainer.removeChildren();
    this.diffButtonsContainer.addChild(this.diffButtonsBg);

    let dx = containerPadding;
    for (const item of this.diffButtons) {
      item.container.position.set(dx, containerPadding);
      item.text.position.set(diffBtnW / 2, innerHeight / 2);
      item.container.hitArea = new Rectangle(0, 0, diffBtnW, innerHeight);
      this.diffButtonsContainer.addChild(item.container);
      dx += diffBtnW;
    }

    this.setDifficulty(this._difficulty);

    const betRowY = diffBtnY + 74;
    const betRowH = 64;
    const betRowW = diffTotalW;

    this.betRowBg.clear();
    this.betRowBg.roundRect(0, 0, betRowW, betRowH, 12).fill({ color: 0xffffff, alpha: 0.05 });

    this.betContainer.position.set(pad, betRowY);

    const btnW = 100;
    const btnH = 48;
    const btnMargin = 8;

    this.btnMin.position.set(btnMargin, (betRowH - btnH) / 2);
    this.btnMax.position.set(betRowW - btnW - btnMargin, (betRowH - btnH) / 2);

    this.updateButton(this.btnMin, btnW, btnH);
    this.updateButton(this.btnMax, btnW, btnH);

    this.updateBetLayout();

    const quickY = betRowY + 84;
    const quickW = (betRowW - 4 * 6) / 4;
    const quickH = 60;
    const quickGap = 8;
    let qx = pad;

    for (const qb of this.quickBets) {
      qb.bg.clear();
      qb.bg.roundRect(0, 0, quickW, quickH, 10).fill({ color: 0xffffff, alpha: 0.05 });

      // const textGap = 2;
      // const totalContentW = qb.text.width + textGap + qb.icon.width;
      // const startX = (quickW - totalContentW) / 2;

      qb.text.position.set(quickW / 2, quickH / 2);
      // qb.icon.position.set(startX + qb.text.width + textGap + qb.icon.width / 2, quickH / 2);

      qb.node.position.set(qx, quickY);
      qx += quickW + quickGap;
    }
  }

  private updateButton(btn: Container, w: number, h: number) {
    const bg = btn.getChildAt(0) as Graphics;
    const text = btn.getChildAt(1) as Text;

    bg.clear();
    bg.roundRect(0, 0, w, h, 10).fill({ color: 0xffffff, alpha: 0.05 });

    text.style.fontFamily = "Golos Text";
    text.style.fontSize = 16;
    text.style.fontWeight = "600";
    text.style.lineHeight = 24;
    text.style.letterSpacing = 0.068;
    text.style.align = "center";

    text.position.set(w / 2, h / 2);
  }

  private makeDiffButtons() {
    const items: Array<[Difficulty, string]> = [
      ["easy", "Easy"],
      ["medium", "Medium"],
      ["hard", "Hard"],
      ["hardcore", "Hardcore"],
    ];

    this.addChild(this.diffButtonsContainer);

    for (const [key, label] of items) {
      const container = new Container();
      container.eventMode = "static";
      container.cursor = "pointer";

      const bg = new Graphics();
      // @ts-ignore
      const text = new Text({
        text: label,
        style: {
          fontFamily: FONT_FAMILY,
          fill: 0xffffff,
          fontSize: 16,
          fontWeight: "700",
        },
      });
      text.anchor.set(0.5);

      container.addChild(bg, text);
      container.on("pointertap", () => this.handlers.onDifficulty(key));

      this.diffButtons.push({ key, container, bg, text });
      this.diffButtonsContainer.addChild(container);
    }
  }

  private makeBetRow() {
    this.addChild(this.betContainer);
    this.betContainer.addChild(this.betRowBg);
    this.betContainer.addChild(this.betValueText);

    this.betRowBg.eventMode = "static";
    this.betRowBg.cursor = "pointer";
    this.betRowBg.on("pointertap", () => this.showInput());

    this.betValueText.eventMode = "static";
    this.betValueText.cursor = "text";
    this.betValueText.on("pointertap", (e) => {
      e.stopPropagation();
      this.showInput();
    });

    // const iconBg = new Graphics();
    // iconBg.circle(0, 0, 11.5).fill({ color: 0xffffff, alpha: 0.3 });

    // // @ts-ignore
    // const dollarText = new Text({
    //   text: "$",
    //   style: {
    //     fontFamily: "Golos Text",
    //     fill: 0xffffff,
    //     fontSize: 16.5,
    //     fontWeight: "bold",
    //     align: "center",
    //   },
    // });
    // dollarText.anchor.set(0.5);

    // iconBg.y = 0.5;
    // dollarText.y = 0;

    // this.dollarIconBet.addChild(iconBg, dollarText);
    // this.betContainer.addChild(this.dollarIconBet);

    this.btnMin = this.makeButton("MIN", () => this.handlers.onBet(GAME_CFG.bet.min));
    this.btnMax = this.makeButton("MAX", () => this.handlers.onBet(GAME_CFG.bet.max));

    this.betContainer.addChild(this.btnMin, this.btnMax);
  }

  private makeQuickBets() {
    const amounts = [0.5, 1, 2, 7];

    for (const amount of amounts) {
      const node = new Container();
      node.eventMode = "static";
      node.cursor = "pointer";

      const bg = new Graphics();

      // @ts-ignore
      const text = new Text({
        text: `${amount}`,
        style: {
          fontFamily: "Golos Text",
          fill: 0xffffff,
          fontSize: 20,
          fontWeight: "600",
          lineHeight: 24,
          letterSpacing: 0.068,
          align: "center",
        },
      });
      text.alpha = 0.3;
      text.anchor.set(0.5);

      // const icon = new Graphics();
      // icon.circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.3 });
      // icon.y = 1;

      // // @ts-ignore
      // const dollarText = new Text({
      //   text: "$",
      //   style: {
      //     fontFamily: "Golos Text",
      //     fill: 0xffffff,
      //     fontSize: 13,
      //     fontWeight: "bold",
      //     align: "center",
      //   },
      // });
      // dollarText.anchor.set(0.5);
      // dollarText.y = 1;

      const iconContainer = new Container();
      // iconContainer.addChild(icon, dollarText);
      // iconContainer.alpha = 0.4;

      node.addChild(bg, text);
      node.on("pointertap", () => this.handlers.onBet(amount));

      this.quickBets.push({ node, bg, text, icon: iconContainer });
      this.addChild(node);
    }
  }

  private makeButton(label: string, onTap: () => void) {
    const root = new Container();
    root.eventMode = "static";
    root.cursor = "pointer";

    const g = new Graphics();
    g.roundRect(0, 0, 100, 48, 10).fill({ color: 0xffffff, alpha: 0.05 });

    // @ts-ignore
    const t = new Text({
      text: label,
      style: {
        fontFamily: "Golos Text",
        fill: 0xffffff,
        fontSize: 20,
        fontWeight: "600",
        lineHeight: 24,
        letterSpacing: 0.068,
        align: "center",
      },
    });
    t.anchor.set(0.5);
    t.position.set(50, 24);

    root.addChild(g, t);
    root.on("pointertap", onTap);

    return root;
  }

  private makeWinBlock() {
    this.winContainer.visible = false;

    // ===== $ ICON =====
    const d = 34.286;
    const r = d / 2;

    this.winDollarBg.clear();
    // fill #fff
    this.winDollarBg.circle(0, 0, r).fill({ color: 0xffffff, alpha: 1 });
    // stroke #000 3.571
    this.winDollarBg.circle(0, 0, r).stroke({ color: 0x000000, width: 2.5 });

    this.winDollarText.anchor.set(0.5);
    this.winDollarText.position.set(0, 0); // чуть ниже визуально приятнее

    this.winDollar.removeChildren();
    this.winDollar.addChild(this.winDollarBg, this.winDollarText);
    // ==================

    // слои
    this.winContainer.addChild(this.winGlow); // Свечение под всем
    this.winContainer.addChild(this.winBg);
    this.winContainer.addChild(this.winMask);
    this.winContainer.addChild(this.winFrame);
    this.winContainer.addChild(this.winTitle, this.winAmount);

    this.addChild(this.winContainer);
  }
}