// src/modules/challenges/challenge.orchestration.test.ts

import { ChallengeModel } from './challenge.model';
import { challengeOrchestrator, initializeChallengeOrchestration } from './challenge.orchestration';
import { challengeEventBus } from './events/challenge.event-bus';
import {
  ChallengeCreatedEvent,
  ChallengeUpdatedEvent,
  ChallengeDeletedEvent,
} from './events/challenge.events';

jest.mock('./challenge.model');

const mockChallengeModel = ChallengeModel as jest.Mocked<typeof ChallengeModel>;

describe('Challenge Orchestration Event-Driven', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    challengeOrchestrator.clear();
    challengeEventBus.removeAllListeners();
  });

  afterEach(() => {
    challengeOrchestrator.clear();
    challengeEventBus.removeAllListeners();
  });

  describe('initializeChallengeOrchestration', () => {
    it('should load all challenges and set up event listeners', async () => {
      const challenges = [
        {
          challenge_id: 'challenge-1',
          start_time: new Date('2025-01-20T10:00:00Z'),
        },
        {
          challenge_id: 'challenge-2',
          start_time: new Date('2025-01-20T11:00:00Z'),
        },
      ];

      mockChallengeModel.allChallenges.mockResolvedValue(challenges as any);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await initializeChallengeOrchestration();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(challengeOrchestrator.getRegistrySize()).toBe(2);
      expect(consoleSpy).toHaveBeenCalledWith('Initializing challenge orchestration...');

      consoleSpy.mockRestore();
    });

    it('should handle empty challenges list', async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);

      await initializeChallengeOrchestration();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(challengeOrchestrator.getRegistrySize()).toBe(0);
    });
  });

  describe('event-driven challenge orchestration', () => {
    beforeEach(async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);
      await initializeChallengeOrchestration();
    });

    describe('challenge created events', () => {
      it('should register challenge on created event', () => {
        const challengeId = 'new-challenge';
        const startTime = new Date('2025-01-20T10:00:00Z');

        const event: ChallengeCreatedEvent = {
          challengeId,
          startTime,
        };

        challengeEventBus.emitChallengeCreated(event);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      });

      it('should handle multiple challenge created events', () => {
        const event1: ChallengeCreatedEvent = {
          challengeId: 'challenge-1',
          startTime: new Date('2025-01-20T10:00:00Z'),
        };

        const event2: ChallengeCreatedEvent = {
          challengeId: 'challenge-2',
          startTime: new Date('2025-01-20T11:00:00Z'),
        };

        challengeEventBus.emitChallengeCreated(event1);
        challengeEventBus.emitChallengeCreated(event2);

        expect(challengeOrchestrator.isRegistered('challenge-1')).toBe(true);
        expect(challengeOrchestrator.isRegistered('challenge-2')).toBe(true);
        expect(challengeOrchestrator.getRegistrySize()).toBe(2);
      });
    });

    describe('challenge updated events', () => {
      it('should update existing challenge', () => {
        const challengeId = 'existing-challenge';
        const originalTime = new Date('2025-01-20T10:00:00Z');
        const newTime = new Date('2025-01-20T11:00:00Z');

        // First create the challenge
        const createdEvent: ChallengeCreatedEvent = {
          challengeId,
          startTime: originalTime,
        };
        challengeEventBus.emitChallengeCreated(createdEvent);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);

        // Now update it
        const updatedEvent: ChallengeUpdatedEvent = {
          challengeId,
          startTime: newTime,
          previousStartTime: originalTime,
        };
        challengeEventBus.emitChallengeUpdated(updatedEvent);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);

        // Verify time was updated
        const entries = challengeOrchestrator.listEntries();
        const entry = entries.find(e => e.challengeId === challengeId);
        expect(entry?.startTime.getTime()).toBe(newTime.getTime());
      });

      it('should create new challenge if not registered', () => {
        const challengeId = 'new-challenge';
        const startTime = new Date('2025-01-20T10:00:00Z');

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(false);

        const event: ChallengeUpdatedEvent = {
          challengeId,
          startTime,
        };
        challengeEventBus.emitChallengeUpdated(event);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      });

      it('should not update if start time has not changed', () => {
        const challengeId = 'existing-challenge';
        const startTime = new Date('2025-01-20T10:00:00Z');

        // Create challenge
        const createdEvent: ChallengeCreatedEvent = {
          challengeId,
          startTime,
        };
        challengeEventBus.emitChallengeCreated(createdEvent);

        const initialRegistrySize = challengeOrchestrator.getRegistrySize();

        // Update with same time
        const updatedEvent: ChallengeUpdatedEvent = {
          challengeId,
          startTime, // Same time
          previousStartTime: startTime,
        };
        challengeEventBus.emitChallengeUpdated(updatedEvent);

        // Registry size should remain the same
        expect(challengeOrchestrator.getRegistrySize()).toBe(initialRegistrySize);
      });
    });

    describe('challenge deleted events', () => {
      it('should handle delete event for registered challenge', () => {
        const challengeId = 'challenge-to-delete';
        const startTime = new Date('2025-01-20T10:00:00Z');

        // First create the challenge
        const createdEvent: ChallengeCreatedEvent = {
          challengeId,
          startTime,
        };
        challengeEventBus.emitChallengeCreated(createdEvent);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);

        // Now delete it
        const deletedEvent: ChallengeDeletedEvent = {
          challengeId,
        };

        expect(() => {
          challengeEventBus.emitChallengeDeleted(deletedEvent);
        }).not.toThrow();
      });

      it('should handle delete event for non-existent challenge', () => {
        const challengeId = 'non-existent-challenge';

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(false);

        const deletedEvent: ChallengeDeletedEvent = {
          challengeId,
        };

        expect(() => {
          challengeEventBus.emitChallengeDeleted(deletedEvent);
        }).not.toThrow();
      });
    });

    describe('event listener verification', () => {
      it('should have event listeners set up after initialization', () => {
        // Verify that event listeners are registered
        expect(challengeEventBus.getListenerCount('challenge.created')).toBeGreaterThan(0);
        expect(challengeEventBus.getListenerCount('challenge.updated')).toBeGreaterThan(0);
        expect(challengeEventBus.getListenerCount('challenge.deleted')).toBeGreaterThan(0);
      });

      it('should properly register challenge started event listeners', () => {
        const startedListener = jest.fn();
        challengeEventBus.onChallengeStarted(startedListener);

        // Verify that we can listen to started events
        expect(challengeEventBus.getListenerCount('challenge.started')).toBeGreaterThan(0);

        // Manually emit a started event to test the listener
        challengeEventBus.emitChallengeStarted({
          challengeId: 'test-challenge',
          startTime: new Date('2025-01-20T10:00:00Z'),
        });

        expect(startedListener).toHaveBeenCalledWith({
          challengeId: 'test-challenge',
          startTime: new Date('2025-01-20T10:00:00Z'),
        });
      });
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);
      await initializeChallengeOrchestration();
    });

    it('should handle event emissions without errors', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date('2025-01-20T10:00:00Z');

      const event: ChallengeCreatedEvent = {
        challengeId,
        startTime,
      };

      // Should not throw when emitting events
      expect(() => {
        challengeEventBus.emitChallengeCreated(event);
      }).not.toThrow();

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
    });

    it('should handle rapid event emissions', () => {
      const events: ChallengeCreatedEvent[] = [
        { challengeId: 'rapid-1', startTime: new Date('2025-01-20T10:00:00Z') },
        { challengeId: 'rapid-2', startTime: new Date('2025-01-20T10:01:00Z') },
        { challengeId: 'rapid-3', startTime: new Date('2025-01-20T10:02:00Z') },
      ];

      // Emit all events rapidly
      events.forEach(event => {
        challengeEventBus.emitChallengeCreated(event);
      });

      // All should be registered
      events.forEach(event => {
        expect(challengeOrchestrator.isRegistered(event.challengeId)).toBe(true);
      });

      expect(challengeOrchestrator.getRegistrySize()).toBe(3);
    });
  });
});
