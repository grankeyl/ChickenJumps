export type StateName = string;

export type State = {
  name: StateName;
  enter?: () => void;
  exit?: () => void;
  update?: (dt: number) => void;
};

export class StateMachine {
  private states = new Map<StateName, State>();
  private current: State | null = null;

  add(state: State) {
    this.states.set(state.name, state);
    return this;
  }

  set(name: StateName) {
    const next = this.states.get(name);
    if (!next) throw new Error(`State not found: ${name}`);

    if (this.current?.exit) this.current.exit();
    this.current = next;
    if (this.current.enter) this.current.enter();
  }

  update(dt: number) {
    this.current?.update?.(dt);
  }

  getCurrent() {
    return this.current?.name ?? null;
  }
}