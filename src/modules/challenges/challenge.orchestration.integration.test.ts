// src/modules/challenges/challenge.orchestration.integration.test.ts

import { challengeOrchestrator, initializeChallengeOrchestration } from './challenge.orchestration';
import { challengeEventBus } from './events/challenge.event-bus';
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
    jest.clearAllMocks();
    challengeOrchestrator.clear();
    challengeEventBus.removeAllListeners();
  });

  afterEach(() => {
    challengeOrchestrator.clear();
    challengeEventBus.removeAllListeners();
  });

  describe('initializeChallengeOrchestration', () => {
    it('should set up event listeners and load challenges', async () => {
      const mockChallenges = [
        {
          challenge_id: 'challenge-1',
          start_time: new Date('2025-01-20T11:00:00Z'),
        },
        {
          challenge_id: 'challenge-2',
          start_time: new Date('2025-01-20T12:00:00Z'),
        },
      ];

      mockChallengeModel.allChallenges.mockResolvedValue(mockChallenges as any);

      await initializeChallengeOrchestration();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(challengeOrchestrator.getRegistrySize()).toBe(2);
    });
  });

  describe('event-driven orchestration', () => {
    beforeEach(async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);
      await initializeChallengeOrchestration();
    });

    describe('challenge created events', () => {
      it('should register challenge on created event', async () => {
        const challengeId = 'new-challenge';
        const startTime = new Date('2025-01-20T11:00:00Z');

        const createdEvent: ChallengeCreatedEvent = {
          challengeId,
          startTime,
        };

        challengeEventBus.emitChallengeCreated(createdEvent);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      });
    });

    describe('challenge updated events', () => {
      it('should update challenge on updated event', async () => {
        const challengeId = 'existing-challenge';
        const originalTime = new Date('2025-01-20T11:00:00Z');
        const newTime = new Date('2025-01-20T12:00:00Z');

        // First register the challenge
        await challengeOrchestrator.upsert(challengeId, originalTime);

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

      it('should register new challenge if not already registered', async () => {
        const challengeId = 'new-challenge';
        const startTime = new Date('2025-01-20T11:00:00Z');

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(false);

        const updatedEvent: ChallengeUpdatedEvent = {
          challengeId,
          startTime,
        };

        challengeEventBus.emitChallengeUpdated(updatedEvent);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      });
    });

    describe('challenge deleted events', () => {
      it('should handle delete event for registered challenge', async () => {
        const challengeId = 'challenge-to-delete';
        const startTime = new Date('2025-01-20T11:00:00Z');

        // First register challenge
        await challengeOrchestrator.upsert(challengeId, startTime);

        expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);

        const deletedEvent: ChallengeDeletedEvent = {
          challengeId,
        };

        // Should not throw error when handling delete event
        expect(() => {
          challengeEventBus.emitChallengeDeleted(deletedEvent);
        }).not.toThrow();
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

    describe('event listeners setup', () => {
      it('should have event listeners registered after initialization', () => {
        // Verify event listeners are set up
        expect(challengeEventBus.getListenerCount('challenge.created')).toBeGreaterThan(0);
        expect(challengeEventBus.getListenerCount('challenge.updated')).toBeGreaterThan(0);
        expect(challengeEventBus.getListenerCount('challenge.deleted')).toBeGreaterThan(0);
      });
    });
  });
});
