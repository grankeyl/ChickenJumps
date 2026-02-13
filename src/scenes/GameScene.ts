import { Container, Graphics, Text, Sprite, Assets, TilingSprite, Texture, RenderTexture } from "pixi.js";
import type { Game, Scene } from "../Game";
import type { Difficulty } from "../config/game.config";
import { GAME_CFG } from "../config/game.config";
import { chance, clamp, formatX, rnd } from "../utils/math";
import { ChickenPuppet } from "../animations/ChickenPuppet";
import { makePop, makeCrumble, makeWinEffect } from "../animations/Effects";
import { BalanceUI } from "../ui/Balance";
import { BetPanel } from "../ui/BetPanel";
import { SpinButton } from "../ui/SpinButton";
import { CashButton } from "../ui/CashButton";
import { StateMachine } from "../core/StateMachine";
import { ASSETS } from "../config/assets.config";
import { FONT_FAMILY } from "../utils/fonts";
import { SoundManager } from "../utils/sound";

type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  mult: number;
  container: Container;
  sprite: Sprite;
  indicator: Sprite;
  label: Text;
  nest?: Sprite;
  baseX: number;
  baseY: number;
  isLevitating: boolean;
  levitationPhase: number;
};

export class GameScene implements Scene {
  private static readonly DESIGN_W = 1280;
  private static readonly DESIGN_H = 832;

  private view = new Container();
  private bgLayer = new Container();      // Фиксированный слой: только небо
  private cloudLayer = new Container();   // Скроллящийся слой: облака
  private landscapeLayer = new Container(); // Скроллящийся слой: дорога, трава, деревья, лампы
  private world = new Container();        // Скроллящийся слой: только платформы
  private chickenLayer = new Container(); // Фиксированный слой: курица

  private bg?: Sprite;
  private clouds: Sprite[] = [];
  private cloudData: Array<{ sprite: Sprite; startX: number; startY: number; amplitudeX: number; amplitudeY: number; speed: number; time: number }> = [];

  private ground?: TilingSprite;
  private groundBg?: Graphics;
  private grass?: TilingSprite;
  private trees: Sprite[] = [];
  private lamps: Sprite[] = [];
  private platforms: Platform[] = [];

  private chicken = new ChickenPuppet();
  private chickenVelY = 0;
  private target: { x: number; y: number; platform?: Platform } | null = null;
  private jumpT = 0;
  private jumpStartY = 0; // Сохраняем начальную Y позицию прыжка
  private jumpStartX = 0; // Сохраняем начальную X позицию прыжка
  private currentPlatformIndex = -1; // Начинаем с -1 (на земле)

  // Win animation tracking
  private winStartTime = 0;
  private winData?: { startX: number, startY: number, targetX: number, targetY: number, startScale: number, targetScale: number, direction: number };
  private winEffects: Array<{ node: Container, update: (t: number) => void, startTime: number }> = [];
  private deathStartTime = 0;
  private deathStartX = 0;
  private deathWorldY = 0; // Сохраняем высоту камеры в момент смерти
  private deathFx?: { node: Container, update: (t: number) => void };

  private isDragging = false;
  private lastY = 0;

  private ui = new Container();
  private balanceUI = new BalanceUI();
  private panel!: BetPanel;
  private playBtn!: SpinButton;
  private cashBtn!: CashButton;

  private balance = 5000;
  private bet = 0.5;
  private difficulty: Difficulty = "easy";

  // дизайн-размеры
  private w = GameScene.DESIGN_W;
  private h = GameScene.DESIGN_H;

  private sm = new StateMachine();
  private currentLiftY = 0;
  private targetLiftY = 0;

  // Sound manager
  private soundManager = new SoundManager();
  private soundtrackStarted = false;
  private isCashingOut = false; // Флаг для предотвращения повторных cashout
  private lastJumpTime = 0; // Время последнего прыжка
  private jumpCooldown = 250; // Задержка между прыжками в миллисекундах (0.25 секунды)
  private isShaking = false; // Флаг для анимации покачивания

  constructor(private game: Game) {
    // Порядок слоёв: небо → облака → ландшафт → платформы + курица → UI
    this.view.addChild(this.bgLayer);        // Фиксированный фон (только небо)
    this.view.addChild(this.cloudLayer);     // Скроллящиеся облака
    this.view.addChild(this.landscapeLayer); // Скроллящийся ландшафт (дорога, трава, деревья, лампы)
    this.view.addChild(this.world);          // Скроллящиеся платформы + курица
    this.view.addChild(this.chickenLayer);   // Пустой слой (оставляем для совместимости)
    this.view.addChild(this.ui);             // Фиксированный UI

    this.world.addChild(this.chicken); // Курица теперь в world вместе с платформами

    // Добавляем обработчик клавиши пробела
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Предотвращаем прокрутку страницы
        this.onPlay();
      }
    });

    this.panel = new BetPanel({
      onDifficulty: (d) => {
        this.difficulty = d;
        this.panel.setDifficulty(d);
        // Rebuild level with new coefficients if we're not currently playing
        if (this.currentPlatformIndex === -1) {
          this.buildLevel();
          this.layoutPlatforms();
        }
      },
      onBet: (b) => {
        const maxAllowed = Math.min(GAME_CFG.bet.max, this.balance);
        this.bet = clamp(b, GAME_CFG.bet.min, maxAllowed);
        this.panel.setBet(this.bet);
      }
    });

    this.playBtn = new SpinButton(() => this.onPlay());
    this.cashBtn = new CashButton(() => this.onCashout());
    this.cashBtn.visible = false; // Скрыта по умолчанию
    this.ui.addChild(this.panel, this.playBtn, this.cashBtn, this.balanceUI as any);

    this.panel.setMaxBet(Math.min(GAME_CFG.bet.max, this.balance));
    this.panel.setBet(1);

    this.sm
      .add({ name: "idle" })
      .add({
        name: "jump",
        enter: () => {
          this.jumpT = 0;
          this.jumpStartY = this.chicken.y; // Сохраняем начальную позицию
          this.jumpStartX = this.chicken.x; // Сохраняем начальную X позицию
        },
        update: (dt) => this.updateJump(dt)
      })
      .add({
        name: "dead",
        enter: () => {
          this.deathStartTime = performance.now();
          this.deathStartX = this.chicken.x; // Запоминаем точку смерти
          this.deathWorldY = this.world.y;    // Запоминаем высоту камеры в момент смерти
          this.playBtn.setText("PLAY");
          this.playBtn.setEnabled(false); // Не даем начать новую игру пока падаем
          this.cashBtn.hide();
          this.panel.enabled = false; // Блокируем панель во время падения

          // Начинаем плавно возвращать камеру к земле сразу
          this.targetLiftY = 0;

          // Эффект разрушения платформы
          if (this.currentPlatformIndex >= 0) {
            const p = this.platforms[this.currentPlatformIndex];
            p.container.visible = false; // Скрываем саму платформу

            this.deathFx = makeCrumble(p.x, p.y, p.w, p.h);
            this.world.addChild(this.deathFx.node);
          }
        },
        update: (dt) => {
          const elapsed = performance.now() - this.deathStartTime;
          const duration = 1200; // 1.2 секунды - чуть медленнее
          const t = Math.min(elapsed / duration, 1);

          if (this.deathFx) {
            this.deathFx.update(Math.min(t * 2, 1)); // Эффект разрушения быстрее чем основная анимация
          }

          // UI re-enables позже
          if (elapsed > 1200 && !this.playBtn.isEnabled()) {
            this.playBtn.setEnabled(true);
            this.playBtn.setText("PLAY");
            this.panel.enabled = true;
          }

          // Плавное движение камеры
          const easeT = t * t * (3 - 2 * t); // Smoothstep easing
          const camY = this.deathWorldY * (1 - easeT);

          this.world.y = camY;
          this.landscapeLayer.y = camY;
          this.cloudLayer.y = camY;

          // Масштаб остается постоянным
          this.chicken.scale.set(this.chicken.baseScaleValue * Math.abs(Math.sign(this.chicken.scale.x)), this.chicken.baseScaleValue);

          // Плавная физика падения
          const dtSec = dt / 60;
          const gravityEase = t * t * (3 - 2 * t); // Smoothstep для плавного нарастания
          const gravity = 120 * gravityEase; // Более медленная гравитация с плавным нарастанием

          this.chickenVelY += gravity * dtSec;
          this.chickenVelY *= 0.98; // Больше сопротивление для плавности

          this.chicken.y += this.chickenVelY * dtSec;

          // Курица падает прямо вниз без смещения по X
          this.chicken.x = this.deathStartX;

          // Плавное вращение - замедляется к концу
          const rotationEase = t * t * (3 - 2 * t); // Smoothstep для плавности
          const rotationSpeed = 2; // Меньше оборотов для более плавного вращения
          this.chicken.rotation = rotationEase * Math.PI * 2 * rotationSpeed * Math.sign(this.chicken.scale.x);

          // Затухание в конце
          if (t > 0.85) {
            const fadeT = (t - 0.85) / 0.15;
            this.chicken.alpha = 1 - fadeT * 0.4;
          }

          if (t >= 1) {
            this.chicken.alpha = 1; // Восстанавливаем альфу
            this.resetGame();
          }
        }
      })
      .add({
        name: "celebrate",
        enter: () => {
          this.winStartTime = performance.now();
        },
        update: (dt) => {
          const elapsed = performance.now() - this.winStartTime;
          const duration = 2000; // 2 секунды празднования
          const t = Math.min(elapsed / duration, 1);

          // Плавное увеличение размера курицы
          const scaleEase = t * t * (3 - 2 * t); // Smoothstep
          const startScale = this.chicken.baseScaleValue;
          const targetScale = this.chicken.baseScaleValue * 1.5; // Увеличивается в 1.5 раза
          const currentScale = startScale + (targetScale - startScale) * scaleEase;
          this.chicken.scale.set(currentScale * Math.sign(this.chicken.scale.x), currentScale);

          // Летает влево-вправо
          const platform = this.platforms[this.currentPlatformIndex];
          // На последней платформе центр в гнезде
          const centerX = platform.x + 145; // Позиция гнезда
          const amplitude = 40; // Меньшая амплитуда для гнезда
          const frequency = 2; // Частота
          const offsetX = Math.sin(t * Math.PI * frequency) * amplitude;
          this.chicken.x = centerX + offsetX;

          // Немного поднимается и опускается
          const baseY = platform.y - 13; // Позиция в гнезде
          const verticalAmplitude = 20;
          const offsetY = Math.sin(t * Math.PI * frequency * 1.5) * verticalAmplitude;
          this.chicken.y = baseY + offsetY - 10; // Немного поднята над гнездом

          // Легкий наклон в сторону движения
          const tilt = Math.cos(t * Math.PI * frequency) * 0.1;
          this.chicken.rotation = tilt;

          // Анимация полета
          this.chicken.setPoseFly(dt);
        }
      })
      .add({
        name: "win",
        update: (dt) => {
          this.chicken.setPoseFly(dt);

          if (!this.winData) return;

          const duration = 3500; // 3.5 секунды на полет (медленнее)
          const elapsed = performance.now() - this.winStartTime;
          const t = Math.min(elapsed / duration, 1);

          // Движение (линейное или с легким ускорением)
          const ease = t;
          this.chicken.x = this.winData.startX + (this.winData.targetX - this.winData.startX) * ease;
          this.chicken.y = this.winData.startY + (this.winData.targetY - this.winData.startY) * ease;

          // Рост (быстрее чем полет)
          const scaleT = Math.min(t * 2.5, 1);
          const currentScale = this.winData.startScale + (this.winData.targetScale - this.winData.startScale) * scaleT;
          this.chicken.scale.set(currentScale * this.winData.direction, currentScale);

          // Наклон в сторону полета (плавный наклон в начале полета)
          const tiltLimit = -0.2; // Максимальный наклон вверх (уменьшили)
          const tiltEase = Math.min(t * 4, 1); // Полный наклон за первые 25% времени
          this.chicken.rotation = tiltLimit * tiltEase * this.winData.direction;

          if (t >= 1) {
            this.finishWin();
          }
        }
      });

    this.sm.set("idle");
  }

  enter() {
    this.game.app.stage.addChild(this.view);

    this.balanceUI.setBalance(this.balance);
    this.panel.setDifficulty(this.difficulty);
    this.panel.setBet(this.bet);

    this.buildLevel();
    this.layoutUI(); // Вызывает syncUIPositions
    this.drawGround();
    this.layoutPlatforms();

    this.ensureBgAndClouds();
    this.ensureTreesAndLamps();
  }

  exit() {
    this.view.removeFromParent();

    this.bg?.destroy();
    this.clouds.forEach(c => c.destroy());
    this.clouds = [];
    this.cloudData = [];
    this.trees.forEach(t => t.destroy());
    this.trees = [];
    this.lamps.forEach(l => l.destroy());
    this.lamps = [];
    this.bg = undefined;
  }

  update(dt: number) {
    this.sm.update(dt);

    // Плавная анимация подъема UI
    const isPlaying = this.currentPlatformIndex !== -1 && this.sm.getCurrent() !== "dead";
    this.targetLiftY = isPlaying ? -90 : 0;

    if (Math.abs(this.currentLiftY - this.targetLiftY) > 0.1) {
      this.currentLiftY += (this.targetLiftY - this.currentLiftY) * 0.1;
      this.syncUIPositions();
    }

    // Анимация дыхания курицы в idle состоянии
    if (this.sm.getCurrent() === "idle" && !this.isShaking) {
      this.chicken.setPoseIdle(dt);
    }

    // Плавное движение камеры - держим курицу в видимой зоне (только в idle/jump)
    if (this.sm.getCurrent() !== "dead") {
      let targetWorldY = 0;
      if (this.currentPlatformIndex >= 3) {
        targetWorldY = this.h * 0.6 - this.chicken.y;
      }

      const camEase = 0.05;
      this.world.y += (targetWorldY - this.world.y) * camEase;
      this.landscapeLayer.y += (targetWorldY - this.landscapeLayer.y) * camEase;
      this.cloudLayer.y += (targetWorldY - this.cloudLayer.y) * camEase;
    }

    // Анимация облаков - плавное покачивание с вертикальным движением
    for (const cloudInfo of this.cloudData) {
      cloudInfo.time += cloudInfo.speed;

      // Плавное движение с easing для более естественного эффекта
      const easeX = Math.sin(cloudInfo.time);
      const easeY = Math.sin(cloudInfo.time * 1.3);

      // Применяем smoothing для более плавного движения
      const smoothX = easeX * easeX * easeX; // кубический easing
      const smoothY = easeY * easeY * easeY;

      const offsetX = smoothX * cloudInfo.amplitudeX;
      const offsetY = smoothY * cloudInfo.amplitudeY;

      cloudInfo.sprite.x = cloudInfo.startX + offsetX;
      cloudInfo.sprite.y = cloudInfo.startY + offsetY;
    }

    // Левитация платформ
    for (const p of this.platforms) {
      if (p.isLevitating) {
        p.levitationPhase += dt * 0.002; // Очень медленная левитация

        // Плавное движение влево-вправо (x) и немного вверх-вниз (y)
        const offsetX = Math.sin(p.levitationPhase) * 6; // 6px амплитуда (еще меньше диапазон)
        const offsetY = Math.cos(p.levitationPhase * 0.8) * 1.5; // Минимальное движение по Y

        p.x = p.baseX + offsetX;
        p.y = p.baseY + offsetY;

        p.container.x = p.x;
        p.container.y = p.y;

        // Если курица стоит на этой платформе, двигаем её вместе с платформой
        if (this.sm.getCurrent() === "idle" && this.currentPlatformIndex !== -1 && !this.isShaking) {
          if (this.platforms[this.currentPlatformIndex] === p) {
            const isLastPlatform = this.currentPlatformIndex === this.platforms.length - 1;
            if (isLastPlatform) {
              // На последней платформе курица в гнезде
              this.chicken.x = p.x + 145;
              this.chicken.y = p.y;
            } else {
              // На обычных платформах - в центре
              this.chicken.x = p.x + p.w / 2;
              this.chicken.y = p.y + 24; // Еще ниже (было +14)
            }
          }
        }
      }
    }

    // Обновляем эффекты победы
    const now = performance.now();
    for (let i = this.winEffects.length - 1; i >= 0; i--) {
      const effect = this.winEffects[i];
      const elapsed = now - effect.startTime;
      const t = Math.min(elapsed / 1500, 1); // 1.5 секунды на эффект

      effect.update(t);

      if (t >= 1) {
        effect.node.destroy({ children: true });
        this.winEffects.splice(i, 1);
      }
    }
  }

  resize(screenW: number, screenH: number) {
    // ✅ масштабируем под экран, сохраняя аспект 1280×832
    const sx = screenW / this.w;
    const sy = screenH / this.h;
    const s = Math.min(sx, sy);

    this.view.scale.set(s);
    this.view.position.set(
      Math.floor((screenW - this.w * s) / 2),
      Math.floor((screenH - this.h * s) / 2)
    );

    if (this.bg) {
      this.bg.width = this.w;
      this.bg.height = this.h;
    }

    this.drawGround();
    this.layoutUI();
    this.layoutPlatforms();
  }

  // ---------- BG + CLOUDS ----------

  private ensureBgAndClouds() {
    (async () => {
      await Assets.load([
        ASSETS.sky,
        ASSETS.cloud1,
        ASSETS.cloud2,
        ASSETS.cloud3,
        ASSETS.grass,
        ASSETS.platform,
        ASSETS.platformFinish,
        ASSETS.platformEnd,
        ASSETS.nest,
        ASSETS.indicator,
        ASSETS.indicatorGreen,
        ASSETS.indicatorEnd
      ]);

      const skyTex = Assets.get(ASSETS.sky);
      if (!skyTex) throw new Error(`Sky texture not loaded: ${ASSETS.sky}`);

      this.bg?.destroy();
      this.bg = new Sprite(skyTex);
      this.bg.anchor.set(0);
      this.bg.width = this.w;
      this.bg.height = this.h;
      this.bgLayer.addChildAt(this.bg, 0); // Фон в отдельный фиксированный слой

      // Удаляем старые облака
      this.clouds.forEach(c => c.destroy());
      this.clouds = [];
      this.cloudData = [];

      // Конфигурация облаков: [texture, x%, y%, width, height, amplitudeX, amplitudeY, speed]
      const cloudConfigs: [string, number, number, number, number, number, number, number][] = [
        // Нижние облака (видны сразу)
        [ASSETS.cloud1, 0.58, 0.12, 211, 128, 15, 8, 0.018],
        [ASSETS.cloud2, 0.88, 0.28, 141.65, 70, 20, 10, 0.020],
        [ASSETS.cloud3, 0.50, 0.44, 117, 77, 12, 6, 0.016],
        [ASSETS.cloud1, 0.20, 0.35, 190, 115, 17, 9, 0.017],
        [ASSETS.cloud3, 0.75, 0.50, 140, 90, 14, 7, 0.019],

        // Средние облака
        [ASSETS.cloud2, 0.35, -0.10, 170, 85, 16, 8, 0.018],
        [ASSETS.cloud1, 0.65, -0.20, 200, 120, 18, 10, 0.016],
        [ASSETS.cloud3, 0.15, -0.25, 150, 95, 15, 8, 0.017],
        [ASSETS.cloud2, 0.85, -0.35, 160, 80, 17, 9, 0.019],

        // Верхние облака
        [ASSETS.cloud1, 0.25, -0.45, 180, 110, 18, 9, 0.017],
        [ASSETS.cloud2, 0.70, -0.55, 150, 75, 16, 8, 0.019],
        [ASSETS.cloud3, 0.45, -0.65, 130, 85, 14, 7, 0.015],
        [ASSETS.cloud1, 0.10, -0.75, 200, 120, 20, 10, 0.018],
        [ASSETS.cloud2, 0.80, -0.85, 160, 80, 17, 9, 0.016],

        // Очень высокие облака
        [ASSETS.cloud3, 0.40, -1.00, 175, 100, 19, 10, 0.017],
        [ASSETS.cloud1, 0.60, -1.15, 195, 115, 18, 9, 0.016],
        [ASSETS.cloud2, 0.22, -1.30, 165, 85, 16, 8, 0.018],
        [ASSETS.cloud3, 0.78, -1.45, 155, 95, 17, 9, 0.019],
      ];

      for (let i = 0; i < cloudConfigs.length; i++) {
        const [asset, xPct, yPct, targetW, targetH, amplitudeX, amplitudeY, speed] = cloudConfigs[i];
        const tex = Assets.get(asset);
        if (!tex) continue;

        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.width = targetW;
        sprite.height = targetH;
        const startX = this.w * xPct;
        const startY = this.h * yPct;
        sprite.position.set(startX, startY);

        this.cloudLayer.addChild(sprite); // Облака теперь в cloudLayer
        this.clouds.push(sprite);
        this.cloudData.push({ sprite, startX, startY, amplitudeX, amplitudeY, speed, time: i * Math.PI / 3 });
      }

      // Update panel background after everything is loaded
      setTimeout(() => this.updatePanelBackground(), 100);
    })().catch(console.error);
  }

  // ---------- TREES + LAMPS ----------

  private ensureTreesAndLamps() {
    (async () => {
      await Assets.load([ASSETS.tree, ASSETS.lamp]);

      const treeTex = Assets.get(ASSETS.tree);
      const lampTex = Assets.get(ASSETS.lamp);
      if (!treeTex || !lampTex) throw new Error("Tree or lamp texture not loaded");

      // Удаляем старые деревья и лампы
      this.trees.forEach(t => t.destroy());
      this.lamps.forEach(l => l.destroy());
      this.trees = [];
      this.lamps = [];

      const groundTex = Assets.get(ASSETS.ground) as Texture;
      const scale = 0.5;
      const groundH = groundTex ? groundTex.height * scale : 100;
      const groundY = this.h - groundH;
      const grassH = 36; // высота травы

      // Конфигурация: [type, x%, scale, zIndex]
      // Лампы и деревья чередуются как на картинке
      const decorConfigs: ["lamp" | "tree", number, number][] = [
        ["lamp", 0.11, 0.35],   // левая лампа
        ["tree", 0.23, 0.25],   // маленькое дерево слева
        ["lamp", 0.48, 0.35],   // центральная лампа
        ["tree", 0.62, 0.35],   // большое дерево в центре
        ["lamp", 0.87, 0.35],   // правая лампа (сдвинули левее)
        ["tree", 0.78, 0.28],   // дерево справа (сдвинули левее)
      ];

      for (let i = 0; i < decorConfigs.length; i++) {
        const [type, xPct, scale] = decorConfigs[i];
        const tex = type === "tree" ? treeTex : lampTex;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(scale);
        sprite.position.set(this.w * xPct, groundY);

        // Добавляем в landscapeLayer после травы
        const grassIndex = this.landscapeLayer.getChildIndex(this.grass!);
        this.landscapeLayer.addChildAt(sprite, grassIndex + 1 + i);

        if (type === "tree") {
          this.trees.push(sprite);
        } else {
          this.lamps.push(sprite);
        }
      }
    })().catch(console.error);
  }

  private layoutUI() {
    const w = this.w;
    const h = this.h;

    const pad = Math.max(14, Math.floor(Math.min(w, h) * 0.02));
    const panelW = Math.min(460, Math.floor(w * 0.40));
    const panelH = Math.min(Math.floor(h * 0.86), 720);

    this.panel.layout(panelW, panelH);
    this.syncUIPositions();
  }

  private syncUIPositions(forceIdle = false) {
    const isPlaying = !forceIdle && this.currentPlatformIndex !== -1;
    const w = this.w;
    const h = this.h;

    const pad = Math.max(14, Math.floor(Math.min(w, h) * 0.02));
    const panelW = this.panel.width;
    const panelH = this.panel.height;

    // Используем setLift для сдвига контента внутри панели
    this.panel.setLift(this.currentLiftY);

    // Панель остается на месте
    const baseY = Math.floor((h - panelH) / 2);
    this.panel.position.set(pad * 3, baseY);

    // Баланс тоже остается на месте
    this.balanceUI.position.set(
      this.panel.x + Math.floor(panelW / 2) - Math.floor(this.balanceUI.width / 2),
      this.panel.y + 58
    );

    const btnW = 390;
    const btnH = 80;
    const gap = 10;

    // Кнопка PLAY остается на месте (не поднимается)
    const playBaseY = this.panel.y + panelH - 110 + btnH / 2;
    this.playBtn.draw(btnW, btnH);
    this.playBtn.position.set(
      this.panel.x + Math.floor(panelW * 0.08) + btnW / 2,
      playBaseY // Убрали + this.currentLiftY
    );

    this.cashBtn.draw(btnW, btnH);
    this.cashBtn.position.set(
      this.playBtn.x,
      this.playBtn.y - btnH - gap
    );
  }

  private drawGround() {
    const groundTex = Assets.get(ASSETS.ground) as Texture;
    if (!groundTex) return;

    const scale = 0.5;
    const groundH = groundTex.height * scale;
    const y = this.h - groundH; // Дорога внизу экрана

    // Добавляем фон за дорогой
    if (!this.groundBg) {
      this.groundBg = new Graphics();
      this.landscapeLayer.addChildAt(this.groundBg, 0);
    }
    this.groundBg.clear();
    this.groundBg.rect(0, y, this.w, groundH).fill({ color: 0x3F3F3A });

    if (!this.ground) {
      this.ground = new TilingSprite({
        texture: groundTex,
        width: this.w,
        height: groundH
      });
      this.ground.tileScale.set(scale);
      this.landscapeLayer.addChildAt(this.ground, 1);
    }
    this.ground.width = this.w;
    this.ground.height = groundH;
    this.ground.position.set(0, y);

    const grassTex = Assets.get(ASSETS.grass) as Texture;
    if (!grassTex) return;

    const grassH = 36;
    if (!this.grass) {
      this.grass = new TilingSprite({
        texture: grassTex,
        width: this.w,
        height: grassH
      });
      this.landscapeLayer.addChildAt(this.grass, 2);
    }
    this.grass.width = this.w;
    this.grass.height = grassH;
    this.grass.position.set(0, y - grassH + 2); // Опустили траву на 2px вниз
  }

  private layoutPlatforms() {
    if (this.platforms.length === 0) return;

    const groundH = Math.floor(this.h * 0.18);
    const baseY = this.h - groundH;

    // Шахматное расположение: слева-справа-слева-справа
    const xOffsets = [
      0.68, // справа
      0.52, // слева
      0.78, // справа
      0.56, // слева
      0.72, // справа
      0.50, // слева
      0.80, // справа
      0.54, // слева
      0.75, // справа
      0.58  // слева
    ];

    // Платформы с увеличенным интервалом для красоты
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      const isLastPlatform = i === this.platforms.length - 1;

      let tx, py;

      if (isLastPlatform) {
        // Последняя платформа: размер 372×77, торчит справа без отступов
        p.w = 372;
        p.h = 77;
        tx = this.w - p.w + 50; // Сдвинута вправо (торчит за край)
        py = baseY - 81 - i * 110 - 30; // Поднята выше на 30px
      } else {
        // Обычные платформы
        const ratio = xOffsets[i % xOffsets.length];
        tx = this.w * ratio - 6;
        py = baseY - 81 - i * 110;
        p.w = 160;
        p.h = 44;
      }

      p.x = isLastPlatform ? tx : clamp(tx, 400, this.w - 180);
      p.y = py;
      p.baseX = p.x;
      p.baseY = py;

      p.container.position.set(p.x, p.y);
      p.sprite.width = p.w;
      p.sprite.height = p.h;

      // Настраиваем гнездо для последней платформы
      if (isLastPlatform && p.nest) {
        p.nest.width = 180;
        p.nest.height = 89;
        // Позиционируем гнездо на ветке (платформе)
        // x: ближе к левому краю платформы, y: сидит на платформе (низ гнезда на уровне платформы)
        p.nest.position.set(90, p.h); // x: 90px от левого края, y: на уровне платформы
      }

      p.indicator.width = 90;
      p.indicator.height = 36;
      p.indicator.position.set(p.w / 2, p.h + 2);

      p.label.text = formatX(p.mult);
      p.label.position.set(p.w / 2, p.h + 2);

      if (isLastPlatform && p.nest) {
        p.nest.width = 180;
        p.nest.height = 89;
        p.nest.position.set(145, p.h - 37);
        
        p.indicator.width = 90;
        p.indicator.height = 36;
        p.indicator.position.set(p.w / 2.57, p.h - 38);

        p.label.text = formatX(p.mult);
        p.label.position.set(p.w / 2.57, p.h - 36);
      }

      p.container.visible = true;
    }

    // Курица зафиксирована
    this.chicken.position.set(this.w * 0.48, baseY + 80);
  }

  // ---------- GAMEPLAY ----------

  private onPlay() {
    // Блокируем прыжки во время анимации смерти
    if (this.sm.getCurrent() === "dead") {
      return; // Не даем прыгать пока идет анимация смерти
    }

    // Проверяем задержку между прыжками (только если не на земле)
    if (this.currentPlatformIndex !== -1) {
      const now = performance.now();
      if (now - this.lastJumpTime < this.jumpCooldown) {
        return; // Слишком рано для следующего прыжка
      }
    }

    // Если мы на земле, проверяем баланс и списываем ставку
    if (this.currentPlatformIndex === -1) {
      if (this.balance < this.bet) return;

      this.balance -= this.bet;
      this.balanceUI.setBalance(this.balance);

      this.panel.enabled = false;
      this.cashBtn.show(); // Анимированное появление
      this.cashBtn.setEnabled(true);
      this.cashBtn.setAmount(0);
      this.syncUIPositions(); // Сдвигаем всё вверх
      this.playBtn.setText("GO"); // Меняем текст на GO когда игра началась

      // Выносим курицу на передний план (если она была сзади после выигрыша)
      this.world.addChild(this.chicken);

      // Запускаем фоновую музыку при первом клике (после взаимодействия пользователя)
      if (!this.soundtrackStarted) {
        this.soundManager.startSoundtrack();
        this.soundtrackStarted = true;
      }
    }

    // Запоминаем время прыжка
    this.lastJumpTime = performance.now();

    // Звук шага при каждом прыжке
    this.soundManager.play('step');

    this.playBtn.setEnabled(false);

    // Прыгаем на следующую платформу
    this.currentPlatformIndex++;

    if (this.currentPlatformIndex >= this.platforms.length) {
      // Закончились платформы - курица уже на последней!
      // Просто не делаем прыжок, пусть игрок нажмет CASHOUT
      this.currentPlatformIndex--;
      this.playBtn.setEnabled(true);
      return;
    }

    const next = this.platforms[this.currentPlatformIndex];
    const isLastPlatform = this.currentPlatformIndex === this.platforms.length - 1;

    // Для последней платформы прыгаем в гнездо (слева на платформе)
    let targetX;
    if (isLastPlatform) {
      targetX = next.x + 145; // Координата гнезда (x: 145 от начала платформы)
    } else {
      targetX = next.x + next.w / 2; // Центр обычной платформы
    }

    // Курица и платформы в одном контейнере, используем координаты напрямую
    this.target = { x: targetX, y: next.y, platform: next };

    // Поворачиваем курицу в направлении прыжка
    // Для последней платформы принудительно поворачиваем влево (отрицательное направление)
    if (isLastPlatform) {
      this.chicken.scale.x = -Math.abs(this.chicken.scale.x);
    } else {
      this.chicken.setDirection(this.target.x);
    }

    this.sm.set("jump");
  }

  private checkBetLimit() {
    const maxVal = Math.min(GAME_CFG.bet.max, this.balance);
    this.panel.setMaxBet(maxVal); // Всегда синхронизируем лимит

    if (this.bet > maxVal || this.bet < GAME_CFG.bet.min) {
      this.bet = clamp(this.bet, GAME_CFG.bet.min, maxVal);
      this.panel.setBet(this.bet);
    }
  }

  private updateJump(dt: number) {
    if (!this.target) {
      this.sm.set("idle");
      return;
    }

    const step = dt / 60;

    // Супер медленное увеличение времени для плавной анимации (3 секунды на прыжок)
    this.jumpT = clamp(this.jumpT + step / 3.0, 0, 1);

    // Используем квартичный easing для максимальной плавности
    const easeT = this.jumpT < 0.5
      ? 8 * this.jumpT * this.jumpT * this.jumpT * this.jumpT  // Quartic ease in
      : 1 - Math.pow(-2 * this.jumpT + 2, 4) / 2; // Quartic ease out

    // Плавное движение по X - линейная интерполяция с учетом движения платформы
    // Для последней платформы целимся в гнездо, для остальных - в центр
    const isLastPlatform = this.currentPlatformIndex === this.platforms.length - 1;
    let currentTargetX;

    if (isLastPlatform && this.target.platform) {
      // Прыгаем в гнездо
      currentTargetX = this.target.platform.x + 145;
    } else {
      // Целимся в центр платформы, которая может двигаться
      currentTargetX = this.target.platform ? this.target.platform.x + this.target.platform.w / 2 : this.target.x;
    }

    const currentTargetY = this.target.platform ? this.target.platform.y : this.target.y;

    this.chicken.x = this.jumpStartX + (currentTargetX - this.jumpStartX) * easeT;

    // Плавное движение по Y - параболическая дуга
    const heightProgress = Math.sin(this.jumpT * Math.PI); // 0->1->0 (дуга)
    const arcHeight = 50; // Вернули нормальную дугу
    // Для последней платформы курица приземляется в гнездо (ниже)
    const landingOffset = isLastPlatform ? 0 : 24; // В гнезде на уровне платформы
    const straightY = this.jumpStartY + (currentTargetY + landingOffset - this.jumpStartY) * easeT;
    this.chicken.y = straightY - heightProgress * arcHeight;

    this.chicken.setPoseJump(this.jumpT);

    // Проверяем завершение прыжка
    if (this.jumpT >= 1.0) {
      this.chicken.y = currentTargetY + landingOffset;
      this.chicken.x = currentTargetX;
      this.onLand();
    }
  }

  private onLand() {
    // Меняем индикатор платформы на зеленый
    if (this.currentPlatformIndex >= 0 && this.currentPlatformIndex < this.platforms.length) {
      const p = this.platforms[this.currentPlatformIndex];
      const greenTex = Assets.get(ASSETS.indicatorGreen);
      if (greenTex) {
        p.indicator.texture = greenTex;
      }
      this.cashBtn.setAmount(this.bet * p.mult);
    }

    const fx = makePop(this.chicken.x, this.chicken.y + 18);
    this.world.addChild(fx.node); // Эффект теперь в world вместе с курицей

    const start = performance.now();
    const anim = () => {
      const now = performance.now();
      const t = clamp((now - start) / 240, 0, 1);
      fx.update(t);
      if (t < 1) requestAnimationFrame(anim);
      else fx.node.destroy({ children: true });
    };
    requestAnimationFrame(anim);

    // Проверяем, это была последняя платформа?
    if (this.currentPlatformIndex === this.platforms.length - 1 && !this.isCashingOut) {
      // На последней платформе гарантированный выигрыш!
      // Курица просто садится в гнездо

      // Перемещаем курицу за гнездо (ниже по z-index)
      const lastPlatform = this.platforms[this.currentPlatformIndex];
      const platformIndex = this.world.getChildIndex(lastPlatform.container);
      // Добавляем курицу прямо перед платформой (под всеми её элементами, включая гнездо)
      this.world.addChildAt(this.chicken, platformIndex);

      this.target = null;
      this.playBtn.setEnabled(true);
      this.sm.set("idle");

      // Анимация покачивания гнезда
      this.shakeNest(lastPlatform);

      // Создаем красивый эффект победы с частицами
      this.createVictoryEffect(lastPlatform);

      // Автоматический cashout через 1.5 секунды
      setTimeout(() => {
        this.onCashout();
      }, 1500);
      return;
    }

    // Проверяем проигрыш (только если это НЕ последняя платформа)
    const shotChance = GAME_CFG.difficulties[this.difficulty].shotChance;
    if (chance(shotChance)) {
      this.soundManager.play('lose');
      this.chickenVelY = 0; // Начинаем с нулевой скорости для плавного падения
      this.sm.set("dead");
      return;
    }

    // Успешно приземлился - остаемся на платформе и можно прыгать дальше
    this.target = null;
    this.playBtn.setEnabled(true);
    this.sm.set("idle");
  }

  private async onCashout() {
    if (this.currentPlatformIndex === -1) return;
    if (this.isCashingOut) return; // Уже выполняется cashout

    this.isCashingOut = true;

    const p = this.platforms[this.currentPlatformIndex];

    // Звук cashout
    this.soundManager.play('cashout');

    // 1. Меняем индикатор на золотой
    const goldTex = await Assets.load(ASSETS.indicatorGold);
    if (goldTex && p.indicator) {
      p.indicator.texture = goldTex;
    }

    // 2. Начисляем выигрыш
    const win = this.bet * p.mult;
    this.balance += win;
    this.balanceUI.setBalance(this.balance);
    this.checkBetLimit(); // Обновляем лимит для возможности повышения ставки

    // 3. Делаем кнопки неактивными и скрываем CASHOUT мгновенно
    this.cashBtn.hide();
    this.cashBtn.setEnabled(false);
    this.playBtn.setEnabled(false);

    // 4. Показываем выигрыш
    this.panel.enabled = true;
    this.panel.showWin(win);

    // 5. Анимация индикатора
    const startY = p.indicator.y;
    const jumpHeight = 20;
    const indicatorDuration = 300;
    const indicatorStartTime = performance.now();
    const animateIndicator = () => {
      const now = performance.now();
      const progress = Math.min((now - indicatorStartTime) / indicatorDuration, 1);
      const jumpFactor = 4 * progress * (1 - progress);
      p.indicator.y = startY - jumpFactor * jumpHeight;
      if (progress < 1) requestAnimationFrame(animateIndicator);
      else p.indicator.y = startY;
    };
    requestAnimationFrame(animateIndicator);

    // 6. Проверяем, это последняя платформа?
    const isLastPlatform = this.currentPlatformIndex === this.platforms.length - 1;

    if (isLastPlatform) {
      // На последней платформе курица остается в гнезде и не улетает
      // Просто показываем выигрыш и ждем
      setTimeout(() => {
        this.finishWin();
      }, 2000); // Показываем выигрыш 2 секунды
    } else {
      // На обычных платформах - анимация улета
      const startX = this.chicken.x;
      const startYPos = this.chicken.y;
      const startScale = Math.abs(this.chicken.scale.x);
      const direction = Math.sign(this.chicken.scale.x);

      this.winStartTime = performance.now();
      this.winData = {
        startX,
        startY: startYPos,
        targetX: direction > 0 ? this.w + 350 : -350,
        targetY: startYPos - 250,
        startScale,
        targetScale: startScale * 1.1, // Еще меньше рост
        direction
      };

      // Перемещаем за платформы
      this.world.addChildAt(this.chicken, 0);

      this.sm.set("win");
    }
  }

  private shakeNest(platform: Platform) {
    if (!platform.nest) return;

    this.isShaking = true; // Блокируем обновление позиции курицы

    const nest = platform.nest;
    const originalNestRotation = nest.rotation;
    const originalChickenRotation = this.chicken.rotation;
    const originalChickenY = this.chicken.y;
    const originalChickenX = this.chicken.x;
    const shakeIntensity = 0.05; // Уменьшили угол покачивания (~2.9 градусов)
    const bounceHeight = 3; // Высота подпрыгивания курицы
    const duration = 500; // Более короткая длительность
    const startTime = performance.now();

    const animateShake = () => {
      const elapsed = performance.now() - startTime;
      const t = elapsed / duration;

      if (t >= 1) {
        nest.rotation = originalNestRotation; // Возвращаем в исходное положение
        this.chicken.rotation = originalChickenRotation; // Возвращаем курицу
        this.chicken.y = originalChickenY; // Возвращаем позицию по Y
        this.chicken.x = originalChickenX; // Возвращаем позицию по X
        this.isShaking = false; // Разблокируем обновление позиции
        return;
      }

      // Затухающее покачивание (как маятник)
      const decay = 1 - t; // Затухание от 1 до 0
      const frequency = 6; // Уменьшили частоту для более плавного покачивания
      const shake = Math.sin(t * Math.PI * frequency) * shakeIntensity * decay;

      // Вертикальное покачивание (подпрыгивание)
      const bounce = Math.abs(Math.sin(t * Math.PI * frequency)) * bounceHeight * decay;

      nest.rotation = originalNestRotation + shake;
      this.chicken.rotation = originalChickenRotation + shake; // Курица качается вместе с гнездом
      this.chicken.y = originalChickenY - bounce; // Курица немного подпрыгивает
      this.chicken.x = originalChickenX; // Сохраняем X позицию

      requestAnimationFrame(animateShake);
    };

    requestAnimationFrame(animateShake);
  }

  private createVictoryEffect(platform: Platform) {
    // Создаем золотые частицы вокруг гнезда
    const particleCount = 20;
    const centerX = platform.x + 145;
    const centerY = platform.y;

    for (let i = 0; i < particleCount; i++) {
      const particle = new Graphics();
      particle.circle(0, 0, 3 + Math.random() * 3);
      particle.fill({ color: 0xFFD700 }); // Золотой цвет

      particle.x = centerX;
      particle.y = centerY;

      this.world.addChild(particle);

      // Анимация частицы
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 2 + Math.random() * 2;
      const lifetime = 1000 + Math.random() * 500;
      const startTime = performance.now();

      const animateParticle = () => {
        const elapsed = performance.now() - startTime;
        const t = elapsed / lifetime;

        if (t >= 1) {
          particle.destroy();
          return;
        }

        // Движение по спирали наружу
        const distance = t * 100 * speed;
        particle.x = centerX + Math.cos(angle + t * 3) * distance;
        particle.y = centerY + Math.sin(angle + t * 3) * distance - t * 50; // Поднимается вверх

        // Затухание
        particle.alpha = 1 - t;

        requestAnimationFrame(animateParticle);
      };

      requestAnimationFrame(animateParticle);
    }

    // Добавляем блеск в центре
    const glow = new Graphics();
    glow.circle(0, 0, 40);
    glow.fill({ color: 0xFFFF00, alpha: 0.3 });
    glow.x = centerX;
    glow.y = centerY;
    this.world.addChild(glow);

    const glowStartTime = performance.now();
    const animateGlow = () => {
      const elapsed = performance.now() - glowStartTime;
      const t = elapsed / 800;

      if (t >= 1) {
        glow.destroy();
        return;
      }

      // Пульсация
      const scale = 1 + Math.sin(t * Math.PI * 4) * 0.3;
      glow.scale.set(scale);
      glow.alpha = (1 - t) * 0.5;

      requestAnimationFrame(animateGlow);
    };

    requestAnimationFrame(animateGlow);
  }

  private finishWin() {
    this.panel.hideWin();
    this.resetGame();
    this.winData = undefined;
  }

  private resetGame() {
    if (this.deathFx) {
      this.deathFx.node.destroy({ children: true });
      this.deathFx = undefined;
    }

    // Очищаем все эффекты победы
    for (const effect of this.winEffects) {
      effect.node.destroy({ children: true });
    }
    this.winEffects = [];

    this.currentPlatformIndex = -1;
    this.isCashingOut = false; // Сбрасываем флаг
    this.lastJumpTime = 0; // Сбрасываем таймер прыжков
    this.buildLevel();
    this.layoutPlatforms();
    this.syncUIPositions(true);

    // Возвращаем курицу на землю в начальную позицию
    const groundH = Math.floor(this.h * 0.18);
    const baseY = this.h - groundH;
    this.chicken.position.set(this.w * 0.48, baseY + 80);

    this.chicken.scale.set(this.chicken.baseScaleValue);
    this.chicken.rotation = 0;
    this.chickenVelY = 0;

    this.playBtn.setEnabled(true);
    this.playBtn.setText("PLAY");
    this.panel.enabled = true;
    this.checkBetLimit();
    this.sm.set("idle");
  }

  private findNearestPlatform() {
    let best: Platform | null = null;
    let bd = 1e9;

    for (const p of this.platforms) {
      const cx = p.x + p.w / 2;
      // Преобразуем координаты платформы в глобальные (как у курицы)
      const cy = p.y + this.world.y;
      const d = Math.abs(cx - this.chicken.x) + Math.abs(cy - this.chicken.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }

    return best;
  }

  // ---------- LEVEL ----------

  private updatePanelBackground() {
    try {
      // Wait for next frame to ensure everything is rendered
      requestAnimationFrame(() => {
        const panelBounds = this.panel.getBounds();

        if (panelBounds.width === 0 || panelBounds.height === 0) {
          console.warn("Panel has zero size, skipping background update");
          return;
        }

        const renderTexture = RenderTexture.create({
          width: Math.ceil(panelBounds.width),
          height: Math.ceil(panelBounds.height),
        });

        // Create a temporary container with background content
        const tempContainer = new Container();
        tempContainer.position.set(-panelBounds.x, -panelBounds.y);

        // Clone background and landscape for rendering
        const bgClone = new Container();
        bgClone.addChild(this.bgLayer);
        bgClone.addChild(this.landscapeLayer);
        tempContainer.addChild(bgClone);

        this.game.app.renderer.render({
          container: tempContainer,
          target: renderTexture,
        });

        // Restore the layers to original positions
        this.view.addChildAt(this.bgLayer, 0);
        this.view.addChildAt(this.landscapeLayer, 1);

        this.panel.setBackgroundTexture(renderTexture);
      });
    } catch (err) {
      console.warn("Failed to create panel background:", err);
    }
  }

  private buildLevel() {
    for (const p of this.platforms) {
      p.container.destroy({ children: true });
    }
    this.platforms = [];

    const platTex = Assets.get(ASSETS.platform);
    const redPlatTex = Assets.get(ASSETS.platformRed);
    const finishPlatTex = Assets.get(ASSETS.platformFinish);
    const endPlatTex = Assets.get(ASSETS.platformEnd);
    const nestTex = Assets.get(ASSETS.nest);
    const indTex = Assets.get(ASSETS.indicator);
    const indGreenTex = Assets.get(ASSETS.indicatorGreen);
    const indEndTex = Assets.get(ASSETS.indicatorEnd);

    // Get coefficients for the current difficulty
    const coefficients = GAME_CFG.difficulties[this.difficulty].coefficients;

    // Подготовка логики левитации:
    // Первые 4 никогда не левитируют
    // Далее каждые 3-6 платформ попадается левитирующая
    let nextLevitatingIn = 4 + Math.floor(Math.random() * 2); // Первая левитирующая где-то на 4-5 шаге (после стартовых 4-х безопасных)

    for (let i = 0; i < coefficients.length; i++) {
      const isLastPlatform = i === coefficients.length - 1;
      let isLevitating = false;

      // Последняя платформа никогда не левитирует
      if (!isLastPlatform && i === nextLevitatingIn) {
        isLevitating = true;
        // Следующая через 3-6 платформ
        nextLevitatingIn += 3 + Math.floor(Math.random() * 4);
      }

      const container = new Container();
      // Выбираем текстуру: последняя (end), левитирующая красная, или обычная
      let texture;
      let indicatorTexture;

      if (isLastPlatform && endPlatTex) {
        texture = endPlatTex; // Последняя платформа с текстурой platform-end.png
        indicatorTexture = indEndTex || indTex; // Индикатор indicator-end.png
      } else if (isLevitating && redPlatTex) {
        texture = redPlatTex; // Красная левитирующая
        indicatorTexture = indTex;
      } else {
        texture = platTex; // Обычная платформа
        indicatorTexture = indTex;
      }
      const sprite = new Sprite(texture);

      const indicator = new Sprite(indicatorTexture);
      indicator.anchor.set(0.5);

      const mult = coefficients[i];
      const label = new Text({
        text: formatX(mult),
        style: {
          fontFamily: "Golos Text",
          fill: 0xffffff,
          fontSize: 20,
          fontWeight: "700",
          stroke: { color: 0x000000, width: 3 }, // ~1.5px outward stroke is roughly 3px total stroke in Pixi
          align: 'center'
        }
      });
      label.anchor.set(0.5);

      // Добавляем гнездо для последней платформы
      let nest: Sprite | undefined;
      if (isLastPlatform && nestTex) {
        nest = new Sprite(nestTex);
        nest.anchor.set(0.5, 1); // Центр по X, низ по Y
      }

      // Порядок важен: платформа -> гнездо -> индикатор -> метка (индикатор поверх гнезда)
      container.addChild(sprite);
      if (nest) container.addChild(nest);
      container.addChild(indicator, label);
      this.world.addChild(container);

      // Начальные размеры (будут установлены в layoutPlatforms)
      const initialW = isLastPlatform ? 372 : 160;
      const initialH = isLastPlatform ? 77 : 44;

      this.platforms.push({
        x: 0,
        y: 0,
        w: initialW,
        h: initialH,
        mult: coefficients[i],
        container,
        sprite,
        indicator,
        label,
        nest,
        baseX: 0,
        baseY: 0,
        isLevitating,
        levitationPhase: Math.random() * Math.PI * 2
      });
    }

    // Перемещаем курицу наверх, чтобы она была поверх всех платформ
    this.world.addChild(this.chicken);
  }
}