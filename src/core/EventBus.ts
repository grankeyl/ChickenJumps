type Handler<T = any> = (payload: T) => void;

export class EventBus {
  private map = new Map<string, Set<Handler>>();

  on<T>(event: string, handler: Handler<T>) {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(handler as Handler);
    return () => this.off(event, handler);
  }

  off<T>(event: string, handler: Handler<T>) {
    this.map.get(event)?.delete(handler as Handler);
  }

  emit<T>(event: string, payload?: T) {
    this.map.get(event)?.forEach((h) => h(payload));
  }
}