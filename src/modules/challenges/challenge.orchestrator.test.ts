// src/modules/challenges/challenge.orchestrator.test.ts

import { ChallengesOrchestrator } from './challenge.orchestrator';
import { ChallengeModel } from './challenge.model';

jest.mock('./challenge.model');

const mockChallengeModel = ChallengeModel as jest.Mocked<typeof ChallengeModel>;

describe('ChallengesOrchestrator', () => {
  let orchestrator: ChallengesOrchestrator;

  beforeEach(() => {
    orchestrator = new ChallengesOrchestrator();
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    orchestrator.clear();
    jest.useRealTimers();
  });

  describe('upsert', () => {
    it('should add challenge to registry', async () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);

      await orchestrator.upsert(challengeId, startTime);

      expect(orchestrator.isRegistered(challengeId)).toBe(true);
      expect(orchestrator.getRegistrySize()).toBe(1);
    });
  });

  describe('resetRegistry', () => {
    it('should clear dispatcher and reload registry from database', async () => {
      const mockChallenges = [
        {
          challenge_id: 'challenge-1',
          start_time: new Date(Date.now() + 5000),
        },
        {
          challenge_id: 'challenge-2',
          start_time: new Date(Date.now() + 7000),
        },
      ];

      mockChallengeModel.allChallenges.mockResolvedValue(mockChallenges as any);

      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 3000);

      await orchestrator.upsert(challengeId, startTime);
      orchestrator.registerScheduledCallback(challengeId, startTime);

      expect(orchestrator.isRegistered(challengeId)).toBe(true);
      expect(orchestrator.isScheduled(challengeId)).toBe(true);

      await orchestrator.resetRegistry();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(orchestrator.isRegistered(challengeId)).toBe(false);
      expect(orchestrator.isScheduled(challengeId)).toBe(false);
      expect(orchestrator.isRegistered('challenge-1')).toBe(true);
      expect(orchestrator.isRegistered('challenge-2')).toBe(true);
      expect(orchestrator.getRegistrySize()).toBe(2);
      expect(orchestrator.getScheduledChallengesCount()).toBe(0);
    });
  });

  describe('registerScheduledCallback', () => {
    it('should register callback for future challenge', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);

      const result = orchestrator.registerScheduledCallback(challengeId, startTime);

      expect(result).toBe(true);
      expect(orchestrator.isScheduled(challengeId)).toBe(true);
    });

    it('should use default callback when none provided', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 1000);

      orchestrator.registerScheduledCallback(challengeId, startTime);

      jest.advanceTimersByTime(1000);

      expect(consoleSpy).toHaveBeenCalledWith(
        `Challenge ${challengeId} started at ${startTime.toISOString()}`,
      );

      consoleSpy.mockRestore();
    });

    it('should use custom callback when provided', () => {
      const customCallback = jest.fn();
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 1000);

      orchestrator.registerScheduledCallback(challengeId, startTime, customCallback);

      jest.advanceTimersByTime(1000);

      expect(customCallback).toHaveBeenCalledWith(challengeId, startTime);
    });

    it('should return false for duplicate registration', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);

      const result1 = orchestrator.registerScheduledCallback(challengeId, startTime);
      const result2 = orchestrator.registerScheduledCallback(challengeId, startTime);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe('cancelScheduledCallback', () => {
    it('should cancel scheduled callback', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);

      orchestrator.registerScheduledCallback(challengeId, startTime);
      const result = orchestrator.cancelScheduledCallback(challengeId);

      expect(result).toBe(true);
      expect(orchestrator.isScheduled(challengeId)).toBe(false);
    });

    it('should return false for non-scheduled challenge', () => {
      const result = orchestrator.cancelScheduledCallback('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('listEntries', () => {
    it('should return empty array when no entries exist', () => {
      const result = orchestrator.listEntries();

      expect(result).toEqual([]);
    });

    it('should return entries with scheduling status', async () => {
      const challenge1 = {
        id: 'challenge-1',
        time: new Date(Date.now() + 5000),
      };
      const challenge2 = {
        id: 'challenge-2',
        time: new Date(Date.now() + 7000),
      };

      await orchestrator.upsert(challenge1.id, challenge1.time);
      await orchestrator.upsert(challenge2.id, challenge2.time);
      orchestrator.registerScheduledCallback(challenge1.id, challenge1.time);

      const result = orchestrator.listEntries();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        challengeId: challenge1.id,
        startTime: challenge1.time,
        isScheduled: true,
      });
      expect(result).toContainEqual({
        challengeId: challenge2.id,
        startTime: challenge2.time,
        isScheduled: false,
      });
    });
  });

  describe('scheduleAllFutureChallenges', () => {
    it('should schedule all future challenges', async () => {
      const pastChallenge = {
        id: 'past-challenge',
        time: new Date(Date.now() - 1000),
      };
      const futureChallenge1 = {
        id: 'future-challenge-1',
        time: new Date(Date.now() + 5000),
      };
      const futureChallenge2 = {
        id: 'future-challenge-2',
        time: new Date(Date.now() + 7000),
      };

      await orchestrator.upsert(pastChallenge.id, pastChallenge.time);
      await orchestrator.upsert(futureChallenge1.id, futureChallenge1.time);
      await orchestrator.upsert(futureChallenge2.id, futureChallenge2.time);

      const scheduledCount = orchestrator.scheduleAllFutureChallenges();

      expect(scheduledCount).toBe(2);
      expect(orchestrator.isScheduled(pastChallenge.id)).toBe(false);
      expect(orchestrator.isScheduled(futureChallenge1.id)).toBe(true);
      expect(orchestrator.isScheduled(futureChallenge2.id)).toBe(true);
    });

    it('should not schedule already scheduled challenges', async () => {
      const futureChallenge1 = {
        id: 'future-challenge-1',
        time: new Date(Date.now() + 5000),
      };
      const futureChallenge2 = {
        id: 'future-challenge-2',
        time: new Date(Date.now() + 7000),
      };

      await orchestrator.upsert(futureChallenge1.id, futureChallenge1.time);
      await orchestrator.upsert(futureChallenge2.id, futureChallenge2.time);
      orchestrator.registerScheduledCallback(futureChallenge1.id, futureChallenge1.time);

      const scheduledCount = orchestrator.scheduleAllFutureChallenges();

      expect(scheduledCount).toBe(1);
      expect(orchestrator.getScheduledChallengesCount()).toBe(2);
    });

    it('should use custom callback when provided', async () => {
      const customCallback = jest.fn();
      const futureChallenge = {
        id: 'future-challenge',
        time: new Date(Date.now() + 1000),
      };

      await orchestrator.upsert(futureChallenge.id, futureChallenge.time);

      const scheduledCount = orchestrator.scheduleAllFutureChallenges(customCallback);

      expect(scheduledCount).toBe(1);

      jest.advanceTimersByTime(1000);
      expect(customCallback).toHaveBeenCalledWith(futureChallenge.id, futureChallenge.time);
    });
  });

  describe('getFutureChallengesCount', () => {
    it('should return count of future challenges', async () => {
      const pastChallenge = {
        id: 'past-challenge',
        time: new Date(Date.now() - 1000),
      };
      const futureChallenge1 = {
        id: 'future-challenge-1',
        time: new Date(Date.now() + 5000),
      };
      const futureChallenge2 = {
        id: 'future-challenge-2',
        time: new Date(Date.now() + 7000),
      };

      await orchestrator.upsert(pastChallenge.id, pastChallenge.time);
      await orchestrator.upsert(futureChallenge1.id, futureChallenge1.time);
      await orchestrator.upsert(futureChallenge2.id, futureChallenge2.time);

      const count = orchestrator.getFutureChallengesCount();

      expect(count).toBe(2);
    });

    it('should return 0 when no future challenges exist', async () => {
      const pastChallenge = {
        id: 'past-challenge',
        time: new Date(Date.now() - 1000),
      };

      await orchestrator.upsert(pastChallenge.id, pastChallenge.time);

      const count = orchestrator.getFutureChallengesCount();

      expect(count).toBe(0);
    });
  });

  describe('getScheduledChallengesCount', () => {
    it('should return count of scheduled challenges', () => {
      const challenge1 = {
        id: 'challenge-1',
        time: new Date(Date.now() + 5000),
      };
      const challenge2 = {
        id: 'challenge-2',
        time: new Date(Date.now() + 7000),
      };

      orchestrator.registerScheduledCallback(challenge1.id, challenge1.time);
      orchestrator.registerScheduledCallback(challenge2.id, challenge2.time);

      const count = orchestrator.getScheduledChallengesCount();

      expect(count).toBe(2);
    });

    it('should return 0 when no challenges are scheduled', () => {
      const count = orchestrator.getScheduledChallengesCount();

      expect(count).toBe(0);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered challenge', async () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);

      await orchestrator.upsert(challengeId, startTime);

      expect(orchestrator.isRegistered(challengeId)).toBe(true);
    });

    it('should return false for non-registered challenge', () => {
      expect(orchestrator.isRegistered('non-existent')).toBe(false);
    });
  });

  describe('isScheduled', () => {
    it('should return true for scheduled challenge', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);

      orchestrator.registerScheduledCallback(challengeId, startTime);

      expect(orchestrator.isScheduled(challengeId)).toBe(true);
    });

    it('should return false for non-scheduled challenge', () => {
      expect(orchestrator.isScheduled('non-existent')).toBe(false);
    });
  });

  describe('getRegistrySize', () => {
    it('should return registry size', async () => {
      expect(orchestrator.getRegistrySize()).toBe(0);

      await orchestrator.upsert('challenge-1', new Date());
      expect(orchestrator.getRegistrySize()).toBe(1);

      await orchestrator.upsert('challenge-2', new Date());
      expect(orchestrator.getRegistrySize()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear both registry and dispatcher', async () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);

      await orchestrator.upsert(challengeId, startTime);
      orchestrator.registerScheduledCallback(challengeId, startTime);

      orchestrator.clear();

      expect(orchestrator.getRegistrySize()).toBe(0);
      expect(orchestrator.getScheduledChallengesCount()).toBe(0);
      expect(orchestrator.isRegistered(challengeId)).toBe(false);
      expect(orchestrator.isScheduled(challengeId)).toBe(false);
    });
  });

  describe('loadAndScheduleAll', () => {
    it('should load registry and schedule future challenges', async () => {
      const pastChallenge = {
        challenge_id: 'past-challenge',
        start_time: new Date(Date.now() - 1000),
      };
      const futureChallenge1 = {
        challenge_id: 'future-challenge-1',
        start_time: new Date(Date.now() + 5000),
      };
      const futureChallenge2 = {
        challenge_id: 'future-challenge-2',
        start_time: new Date(Date.now() + 7000),
      };

      const mockChallenges = [pastChallenge, futureChallenge1, futureChallenge2];
      mockChallengeModel.allChallenges.mockResolvedValue(mockChallenges as any);

      const result = await orchestrator.loadAndScheduleAll();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(result.loaded).toBe(3);
      expect(result.scheduled).toBe(2);
      expect(orchestrator.getRegistrySize()).toBe(3);
      expect(orchestrator.getScheduledChallengesCount()).toBe(2);
    });

    it('should use custom callback when provided', async () => {
      const customCallback = jest.fn();
      const futureChallenge = {
        challenge_id: 'future-challenge',
        start_time: new Date(Date.now() + 1000),
      };

      mockChallengeModel.allChallenges.mockResolvedValue([futureChallenge] as any);

      const result = await orchestrator.loadAndScheduleAll(customCallback);

      expect(result.loaded).toBe(1);
      expect(result.scheduled).toBe(1);

      jest.advanceTimersByTime(1000);
      expect(customCallback).toHaveBeenCalledWith('future-challenge', futureChallenge.start_time);
    });

    it('should handle empty database result', async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);

      const result = await orchestrator.loadAndScheduleAll();

      expect(result.loaded).toBe(0);
      expect(result.scheduled).toBe(0);
      expect(orchestrator.getRegistrySize()).toBe(0);
      expect(orchestrator.getScheduledChallengesCount()).toBe(0);
    });
  });
});
