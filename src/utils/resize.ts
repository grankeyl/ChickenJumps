import type { Application } from "pixi.js";

export function resizeToFit(mount: HTMLElement, app: Application) {
  const rect = mount.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  // Явно обновляем размер рендерера
  app.renderer.resolution = dpr;
  app.renderer.resize(width, height);

  return { width, height, dpr };
}