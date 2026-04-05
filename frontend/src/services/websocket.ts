import type { SystemEvent } from "../types";

type Listener = (event: SystemEvent) => void;

class WebSocketPlaceholder {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: SystemEvent) {
    this.listeners.forEach((listener) => listener(event));
  }

  connect() {
    return () => undefined;
  }
}

export const websocket = new WebSocketPlaceholder();

