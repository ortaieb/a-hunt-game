// src/shared/events/event-bus.test.ts

import { EventBus } from './event-bus';

class TestEventBus extends EventBus {
  getEventName(event: string): string {
    return `test.${event}`;
  }

  // Expose protected methods for testing
  public emitTestEvent<T = any>(eventName: string, data?: T): boolean {
    return this.emitEvent(eventName, data);
  }

  public onTestEvent<T = any>(eventName: string, listener: (data?: T) => void): this {
    return this.onEvent(eventName, listener);
  }

  public offTestEvent(eventName: string, listener: (...args: any[]) => void): this {
    return this.offEvent(eventName, listener);
  }
}

describe('EventBus', () => {
  let eventBus: TestEventBus;

  beforeEach(() => {
    eventBus = new TestEventBus();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('constructor', () => {
    it('should set max listeners to 100', () => {
      expect(eventBus.getMaxListeners()).toBe(100);
    });
  });

  describe('emitEvent', () => {
    it('should emit event with proper name transformation', () => {
      const listener = jest.fn();
      eventBus.on('test.sample', listener);

      const result = eventBus.emitTestEvent('sample', { data: 'test' });

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should emit event without data', () => {
      const listener = jest.fn();
      eventBus.on('test.sample', listener);

      const result = eventBus.emitTestEvent('sample');

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(undefined);
    });

    it('should return false when no listeners are registered', () => {
      const result = eventBus.emitTestEvent('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('onEvent', () => {
    it('should register event listener with proper name transformation', () => {
      const listener = jest.fn();

      const result = eventBus.onTestEvent('sample', listener);

      expect(result).toBe(eventBus);
      expect(eventBus.getListenerCount('sample')).toBe(1);
    });

    it('should allow multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      eventBus.onTestEvent('sample', listener1);
      eventBus.onTestEvent('sample', listener2);

      expect(eventBus.getListenerCount('sample')).toBe(2);

      eventBus.emitTestEvent('sample', 'test-data');

      expect(listener1).toHaveBeenCalledWith('test-data');
      expect(listener2).toHaveBeenCalledWith('test-data');
    });
  });

  describe('offEvent', () => {
    it('should remove specific event listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      eventBus.onTestEvent('sample', listener1);
      eventBus.onTestEvent('sample', listener2);

      expect(eventBus.getListenerCount('sample')).toBe(2);

      eventBus.offTestEvent('sample', listener1);

      expect(eventBus.getListenerCount('sample')).toBe(1);

      eventBus.emitTestEvent('sample', 'test-data');

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith('test-data');
    });

    it('should return this for method chaining', () => {
      const listener = jest.fn();
      eventBus.onTestEvent('sample', listener);

      const result = eventBus.offTestEvent('sample', listener);

      expect(result).toBe(eventBus);
    });
  });

  describe('getListenerCount', () => {
    it('should return correct listener count with name transformation', () => {
      expect(eventBus.getListenerCount('sample')).toBe(0);

      const listener = jest.fn();
      eventBus.onTestEvent('sample', listener);

      expect(eventBus.getListenerCount('sample')).toBe(1);
    });

    it('should return 0 for non-existent events', () => {
      expect(eventBus.getListenerCount('nonexistent')).toBe(0);
    });
  });

  describe('getEventName', () => {
    it('should transform event names correctly', () => {
      expect(eventBus.getEventName('test')).toBe('test.test');
      expect(eventBus.getEventName('sample.event')).toBe('test.sample.event');
    });
  });
});
