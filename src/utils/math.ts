export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const chance = (p: number) => Math.random() < p;

export function formatMoney(n: number) {
  if (n < 10) {
    // Для маленьких чисел показываем до 2 знаков после запятой, убирая лишние нули
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return Math.floor(n).toString();
}

export function formatX(x: number) {
  return `${x.toFixed(2)}`;
}