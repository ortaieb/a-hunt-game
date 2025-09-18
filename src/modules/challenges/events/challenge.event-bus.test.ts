// src/modules/challenges/events/challenge.event-bus.test.ts

import { ChallengeEventBus, challengeEventBus } from './challenge.event-bus';
import {
  ChallengeEventType,
  ChallengeCreatedEvent,
  ChallengeUpdatedEvent,
  ChallengeDeletedEvent,
  ChallengeStartedEvent,
} from './challenge.events';

describe('ChallengeEventBus', () => {
  let eventBus: ChallengeEventBus;

  beforeEach(() => {
    eventBus = ChallengeEventBus.getInstance();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = ChallengeEventBus.getInstance();
      const instance2 = ChallengeEventBus.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(challengeEventBus);
    });
  });

  describe('getEventName', () => {
    it('should return event name as-is', () => {
      expect(eventBus.getEventName('test.event')).toBe('test.event');
      expect(eventBus.getEventName('challenge.created')).toBe('challenge.created');
    });
  });

  describe('challenge created events', () => {
    it('should emit and listen to challenge created events', () => {
      const listener = jest.fn();
      const eventData: ChallengeCreatedEvent = {
        challengeId: 'test-challenge-id',
        startTime: new Date('2025-01-20T10:00:00Z'),
      };

      eventBus.onChallengeCreated(listener);
      const result = eventBus.emitChallengeCreated(eventData);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it('should remove challenge created listener', () => {
      const listener = jest.fn();
      const eventData: ChallengeCreatedEvent = {
        challengeId: 'test-challenge-id',
        startTime: new Date('2025-01-20T10:00:00Z'),
      };

      eventBus.onChallengeCreated(listener);
      eventBus.offChallengeCreated(listener);
      const result = eventBus.emitChallengeCreated(eventData);

      expect(result).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('challenge updated events', () => {
    it('should emit and listen to challenge updated events', () => {
      const listener = jest.fn();
      const eventData: ChallengeUpdatedEvent = {
        challengeId: 'test-challenge-id',
        startTime: new Date('2025-01-20T11:00:00Z'),
        previousStartTime: new Date('2025-01-20T10:00:00Z'),
      };

      eventBus.onChallengeUpdated(listener);
      const result = eventBus.emitChallengeUpdated(eventData);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it('should emit challenge updated without previousStartTime', () => {
      const listener = jest.fn();
      const eventData: ChallengeUpdatedEvent = {
        challengeId: 'test-challenge-id',
        startTime: new Date('2025-01-20T11:00:00Z'),
      };

      eventBus.onChallengeUpdated(listener);
      const result = eventBus.emitChallengeUpdated(eventData);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it('should remove challenge updated listener', () => {
      const listener = jest.fn();
      const eventData: ChallengeUpdatedEvent = {
        challengeId: 'test-challenge-id',
        startTime: new Date('2025-01-20T11:00:00Z'),
      };

      eventBus.onChallengeUpdated(listener);
      eventBus.offChallengeUpdated(listener);
      const result = eventBus.emitChallengeUpdated(eventData);

      expect(result).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('challenge deleted events', () => {
    it('should emit and listen to challenge deleted events', () => {
      const listener = jest.fn();
      const eventData: ChallengeDeletedEvent = {
        challengeId: 'test-challenge-id',
      };

      eventBus.onChallengeDeleted(listener);
      const result = eventBus.emitChallengeDeleted(eventData);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it('should remove challenge deleted listener', () => {
      const listener = jest.fn();
      const eventData: ChallengeDeletedEvent = {
        challengeId: 'test-challenge-id',
      };

      eventBus.onChallengeDeleted(listener);
      eventBus.offChallengeDeleted(listener);
      const result = eventBus.emitChallengeDeleted(eventData);

      expect(result).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('challenge started events', () => {
    it('should emit and listen to challenge started events', () => {
      const listener = jest.fn();
      const eventData: ChallengeStartedEvent = {
        challengeId: 'test-challenge-id',
        startTime: new Date('2025-01-20T10:00:00Z'),
      };

      eventBus.onChallengeStarted(listener);
      const result = eventBus.emitChallengeStarted(eventData);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it('should remove challenge started listener', () => {
      const listener = jest.fn();
      const eventData: ChallengeStartedEvent = {
        challengeId: 'test-challenge-id',
        startTime: new Date('2025-01-20T10:00:00Z'),
      };

      eventBus.onChallengeStarted(listener);
      eventBus.offChallengeStarted(listener);
      const result = eventBus.emitChallengeStarted(eventData);

      expect(result).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('multiple event types', () => {
    it('should handle multiple different event types independently', () => {
      const createdListener = jest.fn();
      const updatedListener = jest.fn();
      const deletedListener = jest.fn();
      const startedListener = jest.fn();

      eventBus.onChallengeCreated(createdListener);
      eventBus.onChallengeUpdated(updatedListener);
      eventBus.onChallengeDeleted(deletedListener);
      eventBus.onChallengeStarted(startedListener);

      const challengeId = 'test-challenge-id';
      const startTime = new Date('2025-01-20T10:00:00Z');

      eventBus.emitChallengeCreated({ challengeId, startTime });

      expect(createdListener).toHaveBeenCalledWith({ challengeId, startTime });
      expect(updatedListener).not.toHaveBeenCalled();
      expect(deletedListener).not.toHaveBeenCalled();
      expect(startedListener).not.toHaveBeenCalled();
    });

    it('should handle multiple listeners for same event type', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      eventBus.onChallengeCreated(listener1);
      eventBus.onChallengeCreated(listener2);
      eventBus.onChallengeCreated(listener3);

      const eventData: ChallengeCreatedEvent = {
        challengeId: 'test-challenge-id',
        startTime: new Date('2025-01-20T10:00:00Z'),
      };

      eventBus.emitChallengeCreated(eventData);

      expect(listener1).toHaveBeenCalledWith(eventData);
      expect(listener2).toHaveBeenCalledWith(eventData);
      expect(listener3).toHaveBeenCalledWith(eventData);
    });
  });

  describe('listener count', () => {
    it('should return correct listener counts for each event type', () => {
      expect(eventBus.getListenerCount(ChallengeEventType.CREATED)).toBe(0);
      expect(eventBus.getListenerCount(ChallengeEventType.UPDATED)).toBe(0);
      expect(eventBus.getListenerCount(ChallengeEventType.DELETED)).toBe(0);
      expect(eventBus.getListenerCount(ChallengeEventType.STARTED)).toBe(0);

      eventBus.onChallengeCreated(jest.fn());
      eventBus.onChallengeCreated(jest.fn());
      eventBus.onChallengeUpdated(jest.fn());

      expect(eventBus.getListenerCount(ChallengeEventType.CREATED)).toBe(2);
      expect(eventBus.getListenerCount(ChallengeEventType.UPDATED)).toBe(1);
      expect(eventBus.getListenerCount(ChallengeEventType.DELETED)).toBe(0);
      expect(eventBus.getListenerCount(ChallengeEventType.STARTED)).toBe(0);
    });
  });
});
