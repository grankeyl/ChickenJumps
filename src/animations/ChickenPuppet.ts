import { Container, Sprite, Assets } from "pixi.js";
import { ASSETS } from "../config/assets.config";

export class ChickenPuppet extends Container {
  private legs?: Sprite;
  private comb?: Sprite;
  private bodyBase?: Sprite;
  private wings?: Sprite;
  private face?: Sprite;

  private breatheTime = 0;
  private flyTime = 0;
  private baseScale = 0.32; // Базовый масштаб для правильного размера

  public get baseScaleValue() {
    return this.baseScale;
  }

  constructor() {
    super();
    this.init();
  }

  private async init() {
    await Assets.load([
      ASSETS.chickenLegs,
      ASSETS.chickenComb,
      ASSETS.chickenBodyBase,
      ASSETS.chickenWings,
      ASSETS.chickenFace,
    ]);

    // Применяем базовый масштаб ко всему контейнеру
    this.scale.set(this.baseScale);

    // Порядок слоев: ноги -> гребешок (сзади) -> тело -> крылья -> лицо (спереди)
    this.legs = new Sprite(Assets.get(ASSETS.chickenLegs));
    this.legs.anchor.set(0.5, 1);
    this.legs.y = 0;
    this.addChild(this.legs);

    this.comb = new Sprite(Assets.get(ASSETS.chickenComb));
    this.comb.anchor.set(0.5, 1);
    this.comb.y = -13; // Опустили на 2px вниз
    this.addChild(this.comb);

    this.bodyBase = new Sprite(Assets.get(ASSETS.chickenBodyBase));
    this.bodyBase.anchor.set(0.5, 1);
    this.bodyBase.y = 0;
    this.addChild(this.bodyBase);

    this.wings = new Sprite(Assets.get(ASSETS.chickenWings));
    this.wings.anchor.set(0.5, 1);
    this.wings.y = -13; // Опустили на 2px вниз
    this.addChild(this.wings);

    this.face = new Sprite(Assets.get(ASSETS.chickenFace));
    this.face.anchor.set(0.5, 1);
    this.face.y = -13; // Опустили на 2px вниз
    this.addChild(this.face);
  }

  setPoseJump(t: number) {
    if (!this.bodyBase) return;
    this.rotation = 0; // Сбрасываем возможный наклон от полета
    // Супер плавный квартичный easing (еще медленнее)
    const easeInOut = t < 0.5
      ? 8 * t * t * t * t  // Очень медленное ускорение
      : 1 - Math.pow(-2 * t + 2, 4) / 2; // Очень медленное замедление

    // Выразительное сжатие/растяжение тела (squash & stretch)
    const jumpPhase = Math.sin(t * Math.PI); // 0->1->0
    const squashX = 1 + jumpPhase * 0.06; // Заметное растяжение
    const squashY = 1 - jumpPhase * 0.04; // Заметное сжатие

    // Сохраняем направление взгляда
    const direction = Math.sign(this.scale.x);
    this.scale.set(
      this.baseScale * squashX * direction,
      this.baseScale * squashY
    );

    // Анимация крыльев - эффектные взмахи
    if (this.wings) {
      // 2.5 взмаха за прыжок для динамичности
      const flapSpeed = t * Math.PI * 5;
      // Плавный синус для взмахов
      const flapEase = Math.sin(flapSpeed);
      const flapSmoothness = flapEase * flapEase * flapEase; // Кубический

      // Максимальная сила в начале и середине
      const flapPower = Math.sin(t * Math.PI * 0.8) * 0.9 + 0.1;
      const wingFlap = flapSmoothness * 0.25 * flapPower; // Большая амплитуда
      this.wings.rotation = wingFlap;

      // Крылья активно поднимаются
      const wingLift = jumpPhase * 8; // Больше подъем
      this.wings.y = -13 - wingLift;

      // Выразительное растяжение крыльев
      const wingStretch = 1 + Math.abs(flapSmoothness) * 0.12;
      this.wings.scale.set(wingStretch, wingStretch);
    }

    // Анимация ног - активное поджимание
    if (this.legs) {
      // Активное поджимание
      const legLiftPhase = Math.sin(easeInOut * Math.PI);
      const legLift = legLiftPhase * 12; // Сильный подъем
      this.legs.y = -legLift;

      // Ноги сильно сжимаются
      const legScale = 1 - legLiftPhase * 0.15;
      this.legs.scale.set(1, legScale);

      // Покачивание ног
      const legSwing = Math.sin(t * Math.PI * 1.2) * 0.04; // Больше покачивания
      const legRotation = legLiftPhase * 0.10 + legSwing;
      this.legs.rotation = -legRotation;
    }

    // Голова выразительно наклоняется
    if (this.comb) {
      const headTilt = jumpPhase * 0.08; // Заметный наклон
      this.comb.rotation = headTilt;
      // Голова приподнимается
      const headLift = jumpPhase * 2; // Больше подъем
      this.comb.y = -13 - headLift;
    }

    if (this.face) {
      const headTilt = jumpPhase * 0.08;
      this.face.rotation = headTilt;
      const headLift = jumpPhase * 2;
      this.face.y = -13 - headLift;
    }

    // Тело наклоняется вперед
    if (this.bodyBase) {
      const bodyTilt = jumpPhase * 0.05; // Заметный наклон тела
      this.bodyBase.rotation = bodyTilt;
    }
  }

  setDirection(targetX: number) {
    // Определяем направление: если target правее текущей позиции - смотрим вправо, иначе влево
    const currentX = this.x;
    const direction = targetX > currentX ? 1 : -1;

    // Сохраняем текущий масштаб и применяем направление только к X
    const currentScaleY = Math.abs(this.scale.y);
    this.scale.set(this.baseScale * direction, currentScaleY);
  }

  setPoseIdle(time: number) {
    if (!this.bodyBase) return;
    this.rotation = 0; // Сбрасываем возможный наклон от полета
    this.breatheTime += time * 0.002;

    // Плавное дыхание (медленный цикл)
    const breathe = Math.sin(this.breatheTime) * 0.5 + 0.5; // 0..1
    const breatheSin = Math.sin(this.breatheTime); // -1..1 для эффектов

    // Единое масштабирование для всех частей
    const breatheScale = 1 + breathe * 0.04; // от 1.0 до 1.04

    // Движение головы вверх-вниз
    const headOffset = breathe * 4; // от 0 до 4 пикселей

    // Легкое покачивание гребешка
    const combRotation = breatheSin * 0.03; // очень тонкий наклон влево-вправо

    // Применяем одинаковое масштабирование ко всем
    this.bodyBase.scale.set(breatheScale, breatheScale);
    this.bodyBase.rotation = 0; // Сбрасываем наклон тела

    if (this.comb) {
      this.comb.y = -13 - headOffset;
      this.comb.rotation = combRotation;
      this.comb.scale.set(breatheScale, breatheScale);
    }

    if (this.face) {
      this.face.y = -13 - headOffset;
      this.face.rotation = 0; // Сбрасываем наклон головы
      this.face.scale.set(breatheScale, breatheScale);
    }

    if (this.wings) {
      this.wings.y = -13; // Сбрасываем позицию крыльев
      this.wings.rotation = 0; // Сбрасываем поворот крыльев
      this.wings.scale.set(breatheScale, breatheScale);
    }

    if (this.legs) {
      this.legs.y = 0; // Сбрасываем позицию ног
      this.legs.rotation = 0; // Сбрасываем поворот ног
      this.legs.scale.set(breatheScale, breatheScale);
    }
  }

  setPoseFly(time: number) {
    if (!this.bodyBase) return;

    this.flyTime += time * 0.008;

    // Только взмахи, без пульсации тела
    const flap = Math.sin(this.flyTime * 2.5); // Быстрая синусоида для крыльев

    // Применяем статичное масштабирование
    this.bodyBase.scale.set(1, 1);
    this.bodyBase.rotation = 0; // Убрали наклон тела, будем наклонять всю курицу

    if (this.wings) {
      this.wings.rotation = flap * 0.5; // Размашистые взмахи
      this.wings.y = -13 - Math.abs(flap) * 10; // Подъем крыльев при взмахе
      this.wings.scale.set(1, 1);
    }

    if (this.legs) {
      this.legs.y = -8; // Поджимаем лапки
      this.legs.scale.set(1, 0.7); // Сплющиваем по вертикали
      this.legs.rotation = 0.2;
    }

    if (this.comb) {
      this.comb.y = -13; // Статичное положение гребешка
      this.comb.rotation = 0;
      this.comb.scale.set(1, 1);
    }

    if (this.face) {
      this.face.y = -13; // Статичное положение лица
      this.face.scale.set(1, 1);
    }
  }
}