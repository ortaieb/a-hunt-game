// src/modules/challenges/challenge.orchestration.test.ts

import { ChallengeModel } from './challenge.model';
import {
  challengeOrchestrator,
  initializeChallengeOrchestration,
} from './challenge.orchestration';
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
    jest.useFakeTimers();
  });

  afterEach(() => {
    challengeOrchestrator.clear();
    challengeEventBus.removeAllListeners();
    jest.useRealTimers();
  });

  describe('initializeChallengeOrchestration', () => {
    it('should load all challenges and schedule future ones', async () => {
      const pastChallenge = {
        challenge_id: 'past-challenge',
        start_time: new Date(Date.now() - 60000), // 1 minute ago
      };
      const futureChallenge = {
        challenge_id: 'future-challenge',
        start_time: new Date(Date.now() + 60000), // 1 minute from now
      };

      mockChallengeModel.allChallenges.mockResolvedValue([pastChallenge, futureChallenge] as any);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await initializeChallengeOrchestration();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(challengeOrchestrator.getRegistrySize()).toBe(2);
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(1); // Only future challenge scheduled
      expect(consoleSpy).toHaveBeenCalledWith('Initializing challenge orchestration...');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Challenge orchestration initialized: 2 challenges loaded, 1 scheduled for future execution',
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty database result', async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await initializeChallengeOrchestration();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(challengeOrchestrator.getRegistrySize()).toBe(0);
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Challenge orchestration initialized: 0 challenges loaded, 0 scheduled for future execution',
      );

      consoleSpy.mockRestore();
    });

    it('should emit challenge started events for past challenges', async () => {
      const startedListener = jest.fn();
      challengeEventBus.onChallengeStarted(startedListener);

      const pastChallenge = {
        challenge_id: 'past-challenge',
        start_time: new Date(Date.now() - 60000), // 1 minute ago
      };

      mockChallengeModel.allChallenges.mockResolvedValue([pastChallenge] as any);

      await initializeChallengeOrchestration();

      // Should have immediately emitted challenge started event
      expect(startedListener).toHaveBeenCalledWith({
        challengeId: 'past-challenge',
        startTime: pastChallenge.start_time,
      });
    });
  });

  describe('event-driven challenge registration', () => {
    beforeEach(async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);
      await initializeChallengeOrchestration();
    });

    it('should register new challenge via created event', async () => {
      const challengeId = 'new-challenge';
      const startTime = new Date(Date.now() + 60000);

      const createdEvent: ChallengeCreatedEvent = {
        challengeId,
        startTime,
      };

      challengeEventBus.emitChallengeCreated(createdEvent);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);
      expect(challengeOrchestrator.getRegistrySize()).toBe(1);
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(1);
    });

    it('should emit started event for past challenge via created event', async () => {
      const startedListener = jest.fn();
      challengeEventBus.onChallengeStarted(startedListener);

      const challengeId = 'past-challenge';
      const startTime = new Date(Date.now() - 60000);

      const createdEvent: ChallengeCreatedEvent = {
        challengeId,
        startTime,
      };

      challengeEventBus.emitChallengeCreated(createdEvent);

      // Allow async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(false); // Not scheduled since it was immediate
      expect(startedListener).toHaveBeenCalledWith({
        challengeId,
        startTime,
      });
    });
  });

  describe('event-driven challenge updates', () => {
    beforeEach(async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);
      await initializeChallengeOrchestration();
    });

    it('should update existing challenge when start time changes', async () => {
      const challengeId = 'existing-challenge';
      const originalTime = new Date(Date.now() + 60000);
      const newTime = new Date(Date.now() + 120000);

      // First create the challenge via event
      const createdEvent: ChallengeCreatedEvent = {
        challengeId,
        startTime: originalTime,
      };
      challengeEventBus.emitChallengeCreated(createdEvent);
      await new Promise(resolve => setImmediate(resolve));

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);

      // Now update it via event
      const updatedEvent: ChallengeUpdatedEvent = {
        challengeId,
        startTime: newTime,
        previousStartTime: originalTime,
      };
      challengeEventBus.emitChallengeUpdated(updatedEvent);
      await new Promise(resolve => setImmediate(resolve));

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);

      // Verify the new time is registered
      const entries = challengeOrchestrator.listEntries();
      const entry = entries.find(e => e.challengeId === challengeId);
      expect(entry?.startTime.getTime()).toBe(newTime.getTime());
    });

    it('should not update if start time is the same', async () => {
      const challengeId = 'existing-challenge';
      const startTime = new Date(Date.now() + 60000);

      // Create the challenge via event
      const createdEvent: ChallengeCreatedEvent = {
        challengeId,
        startTime,
      };
      challengeEventBus.emitChallengeCreated(createdEvent);
      await new Promise(resolve => setImmediate(resolve));

      const initialScheduledCount = challengeOrchestrator.getScheduledChallengesCount();

      // Update with same time
      const updatedEvent: ChallengeUpdatedEvent = {
        challengeId,
        startTime,
        previousStartTime: startTime,
      };
      challengeEventBus.emitChallengeUpdated(updatedEvent);
      await new Promise(resolve => setImmediate(resolve));

      // Should not have changed anything
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(initialScheduledCount);
    });

    it('should treat unregistered challenge as new', async () => {
      const challengeId = 'new-challenge';
      const startTime = new Date(Date.now() + 60000);

      const updatedEvent: ChallengeUpdatedEvent = {
        challengeId,
        startTime,
      };
      challengeEventBus.emitChallengeUpdated(updatedEvent);
      await new Promise(resolve => setImmediate(resolve));

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);
      expect(challengeOrchestrator.getRegistrySize()).toBe(1);
    });
  });

  describe('event-driven challenge deletion', () => {
    beforeEach(async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);
      await initializeChallengeOrchestration();
    });

    it('should cancel scheduled callback on deleted event', async () => {
      const challengeId = 'challenge-to-delete';
      const startTime = new Date(Date.now() + 60000);

      // Create challenge first
      const createdEvent: ChallengeCreatedEvent = {
        challengeId,
        startTime,
      };
      challengeEventBus.emitChallengeCreated(createdEvent);
      await new Promise(resolve => setImmediate(resolve));

      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);

      // Delete challenge via event
      const deletedEvent: ChallengeDeletedEvent = {
        challengeId,
      };
      challengeEventBus.emitChallengeDeleted(deletedEvent);
      await new Promise(resolve => setImmediate(resolve));

      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(false);
    });
  });
});
