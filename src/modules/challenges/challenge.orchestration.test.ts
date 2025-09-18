// src/modules/challenges/challenge.orchestration.test.ts

import { ChallengeModel } from './challenge.model';
import {
  challengeOrchestrator,
  initializeChallengeOrchestration,
  registerNewChallenge,
  updateExistingChallenge,
} from './challenge.orchestration';

jest.mock('./challenge.model');

const mockChallengeModel = ChallengeModel as jest.Mocked<typeof ChallengeModel>;

describe('Challenge Orchestration Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    challengeOrchestrator.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    challengeOrchestrator.clear();
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

    it('should trigger immediate callbacks for past challenges', async () => {
      const pastChallenge = {
        challenge_id: 'past-challenge',
        start_time: new Date(Date.now() - 60000), // 1 minute ago
      };

      mockChallengeModel.allChallenges.mockResolvedValue([pastChallenge] as any);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await initializeChallengeOrchestration();

      // Should have immediately triggered the callback for the past challenge
      expect(consoleSpy).toHaveBeenCalledWith(
        `Challenge past-challenge started at ${pastChallenge.start_time.toISOString()}`,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('registerNewChallenge', () => {
    it('should register new challenge in registry and schedule callback', async () => {
      const challengeId = 'new-challenge';
      const startTime = new Date(Date.now() + 60000);

      await registerNewChallenge(challengeId, startTime);

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);
      expect(challengeOrchestrator.getRegistrySize()).toBe(1);
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(1);
    });

    it('should trigger immediate callback for past challenge', async () => {
      const challengeId = 'past-challenge';
      const startTime = new Date(Date.now() - 60000);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await registerNewChallenge(challengeId, startTime);

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(false); // Not scheduled since it was immediate
      expect(consoleSpy).toHaveBeenCalledWith(
        `Challenge ${challengeId} started at ${startTime.toISOString()}`,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateExistingChallenge', () => {
    it('should update existing challenge when start time changes', async () => {
      const challengeId = 'existing-challenge';
      const originalTime = new Date(Date.now() + 60000);
      const newTime = new Date(Date.now() + 120000);

      // First register the challenge
      await registerNewChallenge(challengeId, originalTime);
      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);

      // Now update it
      await updateExistingChallenge(challengeId, newTime);

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

      // Register the challenge
      await registerNewChallenge(challengeId, startTime);
      const initialScheduledCount = challengeOrchestrator.getScheduledChallengesCount();

      // Update with same time
      await updateExistingChallenge(challengeId, new Date(startTime.getTime()));

      // Should not have changed anything
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(initialScheduledCount);
    });

    it('should treat unregistered challenge as new', async () => {
      const challengeId = 'new-challenge';
      const startTime = new Date(Date.now() + 60000);

      await updateExistingChallenge(challengeId, startTime);

      expect(challengeOrchestrator.isRegistered(challengeId)).toBe(true);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);
      expect(challengeOrchestrator.getRegistrySize()).toBe(1);
    });

    it('should cancel old callback when updating to new time', async () => {
      const challengeId = 'existing-challenge';
      const originalTime = new Date(Date.now() + 60000);
      const newTime = new Date(Date.now() + 120000);

      // Register original
      await registerNewChallenge(challengeId, originalTime);
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(1);

      // Update to new time
      await updateExistingChallenge(challengeId, newTime);

      // Should still have 1 scheduled (the new one)
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(1);

      // Advance time to original time - callback should not execute
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.advanceTimersByTime(60000);
      expect(consoleSpy).not.toHaveBeenCalledWith(
        `Challenge ${challengeId} started at ${originalTime.toISOString()}`,
      );

      // Advance to new time - should execute
      jest.advanceTimersByTime(60000);
      expect(consoleSpy).toHaveBeenCalledWith(
        `Challenge ${challengeId} started at ${newTime.toISOString()}`,
      );

      consoleSpy.mockRestore();
    });

    it('should handle update from future to past time', async () => {
      const challengeId = 'existing-challenge';
      const futureTime = new Date(Date.now() + 60000);
      const pastTime = new Date(Date.now() - 60000);

      // Register future challenge
      await registerNewChallenge(challengeId, futureTime);
      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(true);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Update to past time - should trigger immediately
      await updateExistingChallenge(challengeId, pastTime);

      expect(challengeOrchestrator.isScheduled(challengeId)).toBe(false); // Not scheduled since immediate
      expect(consoleSpy).toHaveBeenCalledWith(
        `Challenge ${challengeId} started at ${pastTime.toISOString()}`,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('integration with multiple challenges', () => {
    it('should handle multiple challenges correctly', async () => {
      const challenge1 = { id: 'challenge-1', time: new Date(Date.now() + 60000) };
      const challenge2 = { id: 'challenge-2', time: new Date(Date.now() + 120000) };
      const challenge3 = { id: 'challenge-3', time: new Date(Date.now() - 60000) };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await registerNewChallenge(challenge1.id, challenge1.time);
      await registerNewChallenge(challenge2.id, challenge2.time);
      await registerNewChallenge(challenge3.id, challenge3.time); // Past - should trigger immediately

      expect(challengeOrchestrator.getRegistrySize()).toBe(3);
      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(2); // Only future ones
      expect(consoleSpy).toHaveBeenCalledWith(
        `Challenge ${challenge3.id} started at ${challenge3.time.toISOString()}`,
      );

      // Update challenge1
      const newTime1 = new Date(Date.now() + 180000);
      await updateExistingChallenge(challenge1.id, newTime1);

      expect(challengeOrchestrator.getScheduledChallengesCount()).toBe(2); // Still 2 scheduled

      consoleSpy.mockRestore();
    });
  });
});
