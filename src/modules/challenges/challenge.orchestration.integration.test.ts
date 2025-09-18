// src/modules/challenges/challenge.orchestration.integration.test.ts

import { challengeOrchestrator, initializeChallengeOrchestration } from './challenge.orchestration';
import { ChallengeEventBus, challengeEventBus } from './events/challenge.event-bus';
import { ChallengeModel } from './challenge.model';
import {
  ChallengeCreatedEvent,
  ChallengeUpdatedEvent,
  ChallengeDeletedEvent,
} from './events/challenge.events';

jest.mock('./challenge.model');

const mockChallengeModel = ChallengeModel as jest.Mocked<typeof ChallengeModel>;

describe('Challenge Orchestration Event-Driven Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    challengeOrchestrator.clear();
    challengeEventBus.removeAllListeners();
  });

  afterEach(() => {
    challengeOrchestrator.clear();
    challengeEventBus.removeAllListeners();
    jest.useRealTimers();
  });

  describe('initializeChallengeOrchestration', () => {
    it('should set up event listeners and load challenges', async () => {
      const mockChallenges = [
        {
          challenge_id: 'future-challenge',
          start_time: new Date(Date.now() + 5000),
        },
        {
          challenge_id: 'past-challenge',
          start_time: new Date(Date.now() - 1000),
        },
      ];

      mockChallengeModel.allChallenges.mockResolvedValue(mockChallenges as any);

      await initializeChallengeOrchestration();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(challengeOrchestrator.getRegistrySize()).toBe(2);
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(1); // Only future challenge
    });

    it('should emit challenge started event for past challenges during initialization', async () => {
      const startedListener = jest.fn();
      challengeEventBus.onChallengeStarted(startedListener);

      const pastChallenge = {
        challenge_id: 'past-challenge',
        start_time: new Date(Date.now() - 1000),
      };

      mockChallengeModel.allChallenges.mockResolvedValue([pastChallenge] as any);

      await initializeChallengeOrchestration();

      expect(startedListener).toHaveBeenCalledWith({
        challengeId: 'past-challenge',
        startTime: pastChallenge.start_time,
      });
    });
  });

  describe('event-driven orchestration', () => {
    beforeEach(async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);
      await initializeChallengeOrchestration();
    });

    describe('challenge created events', () => {
      it('should register and schedule challenge on created event', async () => {
        const challengeId = 'new-challenge';
        const startTime = new Date(Date.now() + 5000);

        const createdEvent: ChallengeCreatedEvent = {
          challengeId,
          startTime,
        };

        challengeEventBus.emitChallengeCreated(createdEvent);

        // Allow async operations to complete
        await new Promise(resolve => setImmediate(resolve));

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
        expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);
      });

      it('should handle challenge created for past start time', async () => {
        const startedListener = jest.fn();
        challengeEventBus.onChallengeStarted(startedListener);

        const challengeId = 'past-challenge';
        const startTime = new Date(Date.now() - 1000);

        const createdEvent: ChallengeCreatedEvent = {
          challengeId,
          startTime,
        };

        challengeEventBus.emitChallengeCreated(createdEvent);

        // Allow async operations to complete
        await new Promise(resolve => setImmediate(resolve));

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
        expect(challengeOrchestrator.isScheduled(challengeId)).toBe(false); // Past challenge not scheduled
        expect(startedListener).toHaveBeenCalledWith({
          challengeId,
          startTime,
        });
      });
    });

    describe('challenge updated events', () => {
      it('should update registered challenge when start time changes', async () => {
        // First create a challenge
        const challengeId = 'existing-challenge';
        const originalStartTime = new Date(Date.now() + 3000);
        const newStartTime = new Date(Date.now() + 7000);

        // Register challenge first
        await challengeOrchestrator.upsert(challengeId, originalStartTime);
        challengeOrchestrator.registerScheduledCallback(challengeId, originalStartTime);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
        expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);

        const updatedEvent: ChallengeUpdatedEvent = {
          challengeId,
          startTime: newStartTime,
          previousStartTime: originalStartTime,
        };

        challengeEventBus.emitChallengeUpdated(updatedEvent);

        // Allow async operations to complete
        await new Promise(resolve => setImmediate(resolve));

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
        expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);

        // Check that the start time was updated
        const entries = challengeOrchestrator.listEntries();
        const entry = entries.find(e => e.challengeId === challengeId);
        expect(entry?.startTime.getTime()).toBe(newStartTime.getTime());
      });

      it('should not update challenge if start time has not changed', async () => {
        const challengeId = 'existing-challenge';
        const startTime = new Date(Date.now() + 5000);

        // Register challenge first
        await challengeOrchestrator.upsert(challengeId, startTime);
        challengeOrchestrator.registerScheduledCallback(challengeId, startTime);

        const originalScheduledCount = challengeOrchestrator.getScheduledChallengesCount();

        const updatedEvent: ChallengeUpdatedEvent = {
          challengeId,
          startTime, // Same as original
          previousStartTime: startTime,
        };

        challengeEventBus.emitChallengeUpdated(updatedEvent);

        // Allow async operations to complete
        await new Promise(resolve => setImmediate(resolve));

        expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(originalScheduledCount);
      });

      it('should register unregistered challenge on update', async () => {
        const challengeId = 'new-challenge';
        const startTime = new Date(Date.now() + 5000);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(false);

        const updatedEvent: ChallengeUpdatedEvent = {
          challengeId,
          startTime,
        };

        challengeEventBus.emitChallengeUpdated(updatedEvent);

        // Allow async operations to complete
        await new Promise(resolve => setImmediate(resolve));

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
        expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);
      });
    });

    describe('challenge deleted events', () => {
      it('should cancel scheduled callback on deleted event', async () => {
        const challengeId = 'challenge-to-delete';
        const startTime = new Date(Date.now() + 5000);

        // Register challenge first
        await challengeOrchestrator.upsert(challengeId, startTime);
        challengeOrchestrator.registerScheduledCallback(challengeId, startTime);

        expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);

        const deletedEvent: ChallengeDeletedEvent = {
          challengeId,
        };

        challengeEventBus.emitChallengeDeleted(deletedEvent);

        // Allow async operations to complete
        await new Promise(resolve => setImmediate(resolve));

        expect(challengeOrchestrator.isScheduled(challengeId)).toBe(false);
      });

      it('should handle delete event for non-scheduled challenge', async () => {
        const challengeId = 'non-scheduled-challenge';

        expect(challengeOrchestrator.isScheduled(challengeId)).toBe(false);

        const deletedEvent: ChallengeDeletedEvent = {
          challengeId,
        };

        // Should not throw error
        expect(() => {
          challengeEventBus.emitChallengeDeleted(deletedEvent);
        }).not.toThrow();
      });
    });

    describe('challenge started events', () => {
      it('should emit challenge started events when callbacks are triggered', async () => {
        const startedListener = jest.fn();
        challengeEventBus.onChallengeStarted(startedListener);

        const challengeId = 'future-challenge';
        const startTime = new Date(Date.now() + 1000);

        // Create challenge
        const createdEvent: ChallengeCreatedEvent = {
          challengeId,
          startTime,
        };

        challengeEventBus.emitChallengeCreated(createdEvent);

        // Allow async operations to complete
        await new Promise(resolve => setImmediate(resolve));

        // Fast-forward time to trigger callback
        jest.advanceTimersByTime(1000);

        expect(startedListener).toHaveBeenCalledWith({
          challengeId,
          startTime,
        });
      });
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);
      await initializeChallengeOrchestration();
    });

    it('should handle orchestrator errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock orchestrator to throw error
      const originalUpsert = challengeOrchestrator.upsert;
      challengeOrchestrator.upsert = jest.fn().mockRejectedValue(new Error('Test error'));

      const challengeId = 'error-challenge';
      const startTime = new Date(Date.now() + 5000);

      const createdEvent: ChallengeCreatedEvent = {
        challengeId,
        startTime,
      };

      // Should not throw error even if orchestrator fails
      expect(() => {
        challengeEventBus.emitChallengeCreated(createdEvent);
      }).not.toThrow();

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      // Restore original method
      challengeOrchestrator.upsert = originalUpsert;
      consoleSpy.mockRestore();
    });
  });
});
