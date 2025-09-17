// src/modules/challenges/challenge.registry.test.ts

import { ChallengeRegistry } from "./challenge.registry";
import { ChallengeModel } from "./challenge.model";

jest.mock("./challenge.model");

const mockChallengeModel = ChallengeModel as jest.Mocked<typeof ChallengeModel>;

describe("ChallengeRegistry", () => {
  let registry: ChallengeRegistry;

  beforeEach(() => {
    registry = new ChallengeRegistry();
    jest.clearAllMocks();
  });

  afterEach(() => {
    registry.clear();
  });

  describe("upsert", () => {
    it("should add new challenge entry", async () => {
      const challengeId = "test-challenge-1";
      const startTime = new Date("2025-01-20T10:00:00Z");

      await registry.upsert(challengeId, startTime);

      expect(registry.has(challengeId)).toBe(true);
      expect(registry.get(challengeId)).toEqual(startTime);
      expect(registry.size()).toBe(1);
    });

    it("should update existing challenge entry", async () => {
      const challengeId = "test-challenge-1";
      const originalTime = new Date("2025-01-20T10:00:00Z");
      const updatedTime = new Date("2025-01-20T11:00:00Z");

      await registry.upsert(challengeId, originalTime);
      await registry.upsert(challengeId, updatedTime);

      expect(registry.has(challengeId)).toBe(true);
      expect(registry.get(challengeId)).toEqual(updatedTime);
      expect(registry.size()).toBe(1);
    });

    it("should create independent date objects", async () => {
      const challengeId = "test-challenge-1";
      const startTime = new Date("2025-01-20T10:00:00Z");

      await registry.upsert(challengeId, startTime);
      startTime.setHours(15);

      const retrievedTime = registry.get(challengeId);
      expect(retrievedTime?.getHours()).toBe(10);
    });
  });

  describe("delete", () => {
    it("should remove existing challenge entry", async () => {
      const challengeId = "test-challenge-1";
      const startTime = new Date("2025-01-20T10:00:00Z");

      await registry.upsert(challengeId, startTime);
      const result = registry.delete(challengeId);

      expect(result).toBe(true);
      expect(registry.has(challengeId)).toBe(false);
      expect(registry.size()).toBe(0);
    });

    it("should return false for non-existent challenge", () => {
      const result = registry.delete("non-existent");

      expect(result).toBe(false);
    });

    it("should not affect other entries when deleting one", async () => {
      const challengeId1 = "test-challenge-1";
      const challengeId2 = "test-challenge-2";
      const startTime1 = new Date("2025-01-20T10:00:00Z");
      const startTime2 = new Date("2025-01-20T11:00:00Z");

      await registry.upsert(challengeId1, startTime1);
      await registry.upsert(challengeId2, startTime2);
      registry.delete(challengeId1);

      expect(registry.has(challengeId1)).toBe(false);
      expect(registry.has(challengeId2)).toBe(true);
      expect(registry.size()).toBe(1);
    });
  });

  describe("loadAll", () => {
    it("should clear registry and load all challenges from database", async () => {
      const existingChallengeId = "existing-challenge";
      const existingStartTime = new Date("2025-01-20T09:00:00Z");

      await registry.upsert(existingChallengeId, existingStartTime);

      const mockChallenges = [
        {
          challenge_id: "challenge-1",
          start_time: new Date("2025-01-20T10:00:00Z"),
        },
        {
          challenge_id: "challenge-2",
          start_time: new Date("2025-01-20T11:00:00Z"),
        },
      ];

      mockChallengeModel.allChallenges.mockResolvedValue(mockChallenges as any);

      await registry.loadAll();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(registry.has(existingChallengeId)).toBe(false);
      expect(registry.has("challenge-1")).toBe(true);
      expect(registry.has("challenge-2")).toBe(true);
      expect(registry.size()).toBe(2);
    });

    it("should handle empty database result", async () => {
      mockChallengeModel.allChallenges.mockResolvedValue([]);

      await registry.loadAll();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(registry.size()).toBe(0);
    });
  });

  describe("flushAll", () => {
    it("should clear registry and reload from database", async () => {
      const existingChallengeId = "existing-challenge";
      const existingStartTime = new Date("2025-01-20T09:00:00Z");

      await registry.upsert(existingChallengeId, existingStartTime);

      const mockChallenges = [
        {
          challenge_id: "challenge-1",
          start_time: new Date("2025-01-20T10:00:00Z"),
        },
      ];

      mockChallengeModel.allChallenges.mockResolvedValue(mockChallenges as any);

      await registry.flushAll();

      expect(mockChallengeModel.allChallenges).toHaveBeenCalledTimes(1);
      expect(registry.has(existingChallengeId)).toBe(false);
      expect(registry.has("challenge-1")).toBe(true);
      expect(registry.size()).toBe(1);
    });
  });

  describe("listAll", () => {
    it("should return empty array when registry is empty", () => {
      const result = registry.listAll();

      expect(result).toEqual([]);
    });

    it("should return all entries in registry", async () => {
      const challenge1 = {
        id: "challenge-1",
        time: new Date("2025-01-20T10:00:00Z"),
      };
      const challenge2 = {
        id: "challenge-2",
        time: new Date("2025-01-20T11:00:00Z"),
      };

      await registry.upsert(challenge1.id, challenge1.time);
      await registry.upsert(challenge2.id, challenge2.time);

      const result = registry.listAll();

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        challengeId: challenge1.id,
        startTime: challenge1.time,
      });
      expect(result).toContainEqual({
        challengeId: challenge2.id,
        startTime: challenge2.time,
      });
    });

    it("should return independent date objects", async () => {
      const challengeId = "test-challenge";
      const startTime = new Date("2025-01-20T10:00:00Z");

      await registry.upsert(challengeId, startTime);

      const result = registry.listAll();
      result[0].startTime.setHours(15);

      const retrievedTime = registry.get(challengeId);
      expect(retrievedTime?.getHours()).toBe(10);
    });
  });

  describe("has", () => {
    it("should return true for existing challenge", async () => {
      const challengeId = "test-challenge";
      const startTime = new Date("2025-01-20T10:00:00Z");

      await registry.upsert(challengeId, startTime);

      expect(registry.has(challengeId)).toBe(true);
    });

    it("should return false for non-existent challenge", () => {
      expect(registry.has("non-existent")).toBe(false);
    });
  });

  describe("get", () => {
    it("should return start time for existing challenge", async () => {
      const challengeId = "test-challenge";
      const startTime = new Date("2025-01-20T10:00:00Z");

      await registry.upsert(challengeId, startTime);

      const result = registry.get(challengeId);
      expect(result).toEqual(startTime);
    });

    it("should return undefined for non-existent challenge", () => {
      const result = registry.get("non-existent");
      expect(result).toBeUndefined();
    });

    it("should return independent date object", async () => {
      const challengeId = "test-challenge";
      const startTime = new Date("2025-01-20T10:00:00Z");

      await registry.upsert(challengeId, startTime);

      const result = registry.get(challengeId);
      result?.setHours(15);

      const retrievedAgain = registry.get(challengeId);
      expect(retrievedAgain?.getHours()).toBe(10);
    });
  });

  describe("size", () => {
    it("should return 0 for empty registry", () => {
      expect(registry.size()).toBe(0);
    });

    it("should return correct count of entries", async () => {
      await registry.upsert("challenge-1", new Date());
      expect(registry.size()).toBe(1);

      await registry.upsert("challenge-2", new Date());
      expect(registry.size()).toBe(2);

      registry.delete("challenge-1");
      expect(registry.size()).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all entries from registry", async () => {
      await registry.upsert("challenge-1", new Date());
      await registry.upsert("challenge-2", new Date());

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.listAll()).toEqual([]);
    });
  });
});
