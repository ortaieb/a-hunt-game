// src/shared/events/event-bus.ts

import { EventEmitter } from 'events';

export abstract class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Increase limit for production use
  }

  abstract getEventName(event: string): string;

  protected emitEvent<T = any>(eventName: string, data: T): boolean {
    const fullEventName = this.getEventName(eventName);
    return this.emit(fullEventName, data);
  }

  protected onEvent<T = any>(eventName: string, listener: (data: T) => void): this {
    const fullEventName = this.getEventName(eventName);
    return this.on(fullEventName, listener);
  }

  protected offEvent(eventName: string, listener: (...args: any[]) => void): this {
    const fullEventName = this.getEventName(eventName);
    return this.off(fullEventName, listener);
  }

  getListenerCount(eventName: string): number {
    const fullEventName = this.getEventName(eventName);
    return this.listenerCount(fullEventName);
  }
}
