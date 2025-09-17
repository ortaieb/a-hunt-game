// src/modules/challenges/challenge.dispatcher.test.ts

import { ChallengesDispatcher } from './challenge.dispatcher';

describe('ChallengesDispatcher', () => {
  let dispatcher: ChallengesDispatcher;

  beforeEach(() => {
    dispatcher = new ChallengesDispatcher();
    jest.useFakeTimers();
  });

  afterEach(() => {
    dispatcher.clear();
    jest.useRealTimers();
  });

  describe('register', () => {
    it('should register future callback and execute at scheduled time', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000); // 5 seconds from now
      const callback = jest.fn();

      const result = dispatcher.register(challengeId, startTime, callback);

      expect(result).toBe(true);
      expect(dispatcher.has(challengeId)).toBe(true);
      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);

      expect(callback).toHaveBeenCalledWith(challengeId, startTime);
      expect(dispatcher.has(challengeId)).toBe(false);
    });

    it('should execute callback immediately for past start time', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() - 1000); // 1 second ago
      const callback = jest.fn();

      const result = dispatcher.register(challengeId, startTime, callback);

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalledWith(challengeId, startTime);
      expect(dispatcher.has(challengeId)).toBe(false);
    });

    it('should execute callback immediately for current time', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(); // Current time
      const callback = jest.fn();

      const result = dispatcher.register(challengeId, startTime, callback);

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalledWith(challengeId, startTime);
      expect(dispatcher.has(challengeId)).toBe(false);
    });

    it('should return false when trying to register duplicate challenge', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const result1 = dispatcher.register(challengeId, startTime, callback1);
      const result2 = dispatcher.register(challengeId, startTime, callback2);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(dispatcher.size()).toBe(1);
    });

    it('should handle multiple different challenges', () => {
      const challenge1 = {
        id: 'challenge-1',
        time: new Date(Date.now() + 5000),
        callback: jest.fn(),
      };
      const challenge2 = {
        id: 'challenge-2',
        time: new Date(Date.now() + 7000),
        callback: jest.fn(),
      };

      const result1 = dispatcher.register(challenge1.id, challenge1.time, challenge1.callback);
      const result2 = dispatcher.register(challenge2.id, challenge2.time, challenge2.callback);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(dispatcher.size()).toBe(2);

      jest.advanceTimersByTime(5000);
      expect(challenge1.callback).toHaveBeenCalled();
      expect(challenge2.callback).not.toHaveBeenCalled();
      expect(dispatcher.size()).toBe(1);

      jest.advanceTimersByTime(2000);
      expect(challenge2.callback).toHaveBeenCalled();
      expect(dispatcher.size()).toBe(0);
    });

    it('should create independent date objects', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);
      startTime.setHours(startTime.getHours() + 1);

      const scheduled = dispatcher.getScheduled(challengeId);
      expect(scheduled?.getTime()).not.toBe(startTime.getTime());
    });
  });

  describe('cancel', () => {
    it('should cancel scheduled callback and return true', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);
      const result = dispatcher.cancel(challengeId);

      expect(result).toBe(true);
      expect(dispatcher.has(challengeId)).toBe(false);

      jest.advanceTimersByTime(5000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should return false for non-existent challenge', () => {
      const result = dispatcher.cancel('non-existent');

      expect(result).toBe(false);
    });

    it('should not affect other scheduled callbacks when canceling one', () => {
      const challenge1 = {
        id: 'challenge-1',
        time: new Date(Date.now() + 5000),
        callback: jest.fn(),
      };
      const challenge2 = {
        id: 'challenge-2',
        time: new Date(Date.now() + 7000),
        callback: jest.fn(),
      };

      dispatcher.register(challenge1.id, challenge1.time, challenge1.callback);
      dispatcher.register(challenge2.id, challenge2.time, challenge2.callback);

      const result = dispatcher.cancel(challenge1.id);

      expect(result).toBe(true);
      expect(dispatcher.has(challenge1.id)).toBe(false);
      expect(dispatcher.has(challenge2.id)).toBe(true);

      jest.advanceTimersByTime(7000);
      expect(challenge1.callback).not.toHaveBeenCalled();
      expect(challenge2.callback).toHaveBeenCalled();
    });
  });

  describe('listAll', () => {
    it('should return empty array when no callbacks are scheduled', () => {
      const result = dispatcher.listAll();

      expect(result).toEqual([]);
    });

    it('should return all scheduled callbacks without sensitive data', () => {
      const challenge1 = {
        id: 'challenge-1',
        time: new Date(Date.now() + 5000),
        callback: jest.fn(),
      };
      const challenge2 = {
        id: 'challenge-2',
        time: new Date(Date.now() + 7000),
        callback: jest.fn(),
      };

      dispatcher.register(challenge1.id, challenge1.time, challenge1.callback);
      dispatcher.register(challenge2.id, challenge2.time, challenge2.callback);

      const result = dispatcher.listAll();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        challengeId: challenge1.id,
        startTime: challenge1.time,
      });
      expect(result).toContainEqual({
        challengeId: challenge2.id,
        startTime: challenge2.time,
      });

      result.forEach(item => {
        expect(item).not.toHaveProperty('callback');
        expect(item).not.toHaveProperty('timeoutId');
      });
    });

    it('should return independent date objects', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);

      const result = dispatcher.listAll();
      result[0].startTime.setHours(result[0].startTime.getHours() + 1);

      const scheduled = dispatcher.getScheduled(challengeId);
      expect(scheduled?.getTime()).not.toBe(result[0].startTime.getTime());
    });
  });

  describe('has', () => {
    it('should return true for scheduled challenge', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);

      expect(dispatcher.has(challengeId)).toBe(true);
    });

    it('should return false for non-scheduled challenge', () => {
      expect(dispatcher.has('non-existent')).toBe(false);
    });

    it('should return false after callback execution', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 1000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);
      expect(dispatcher.has(challengeId)).toBe(true);

      jest.advanceTimersByTime(1000);
      expect(dispatcher.has(challengeId)).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty dispatcher', () => {
      expect(dispatcher.size()).toBe(0);
    });

    it('should return correct count of scheduled callbacks', () => {
      const startTime = new Date(Date.now() + 5000);
      const callback = jest.fn();

      dispatcher.register('challenge-1', startTime, callback);
      expect(dispatcher.size()).toBe(1);

      dispatcher.register('challenge-2', startTime, callback);
      expect(dispatcher.size()).toBe(2);

      dispatcher.cancel('challenge-1');
      expect(dispatcher.size()).toBe(1);
    });

    it('should decrease size after callback execution', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 1000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);
      expect(dispatcher.size()).toBe(1);

      jest.advanceTimersByTime(1000);
      expect(dispatcher.size()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should cancel all scheduled callbacks', () => {
      const challenge1 = {
        id: 'challenge-1',
        time: new Date(Date.now() + 5000),
        callback: jest.fn(),
      };
      const challenge2 = {
        id: 'challenge-2',
        time: new Date(Date.now() + 7000),
        callback: jest.fn(),
      };

      dispatcher.register(challenge1.id, challenge1.time, challenge1.callback);
      dispatcher.register(challenge2.id, challenge2.time, challenge2.callback);

      dispatcher.clear();

      expect(dispatcher.size()).toBe(0);
      expect(dispatcher.listAll()).toEqual([]);

      jest.advanceTimersByTime(7000);
      expect(challenge1.callback).not.toHaveBeenCalled();
      expect(challenge2.callback).not.toHaveBeenCalled();
    });
  });

  describe('isScheduled', () => {
    it('should return true for scheduled challenge', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);

      expect(dispatcher.isScheduled(challengeId)).toBe(true);
    });

    it('should return false for non-scheduled challenge', () => {
      expect(dispatcher.isScheduled('non-existent')).toBe(false);
    });
  });

  describe('getScheduled', () => {
    it('should return start time for scheduled challenge', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);

      const result = dispatcher.getScheduled(challengeId);
      expect(result).toEqual(startTime);
    });

    it('should return undefined for non-scheduled challenge', () => {
      const result = dispatcher.getScheduled('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return independent date object', () => {
      const challengeId = 'test-challenge';
      const startTime = new Date(Date.now() + 5000);
      const callback = jest.fn();

      dispatcher.register(challengeId, startTime, callback);

      const result = dispatcher.getScheduled(challengeId);
      result?.setHours(result.getHours() + 1);

      const resultAgain = dispatcher.getScheduled(challengeId);
      expect(resultAgain?.getTime()).not.toBe(result?.getTime());
    });
  });
});
