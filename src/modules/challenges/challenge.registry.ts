// src/modules/challenges/challenge.registry.ts

import { ChallengeModel } from "./challenge.model";
import { Challenge } from "./challenge.type";

export interface ChallengeRegistryEntry {
  challengeId: string;
  startTime: Date;
}

export class ChallengeRegistry {
  private readonly registry = new Map<string, Date>();

  async upsert(challengeId: string, startTime: Date): Promise<void> {
    this.registry.set(challengeId, new Date(startTime));
  }

  delete(challengeId: string): boolean {
    return this.registry.delete(challengeId);
  }

  async loadAll(): Promise<void> {
    const challenges = await ChallengeModel.allChallenges();
    this.registry.clear();

    for (const challenge of challenges) {
      this.registry.set(challenge.challenge_id, new Date(challenge.start_time));
    }
  }

  async flushAll(): Promise<void> {
    this.registry.clear();
    await this.loadAll();
  }

  listAll(): ChallengeRegistryEntry[] {
    return Array.from(this.registry.entries()).map(
      ([challengeId, startTime]) => ({
        challengeId,
        startTime: new Date(startTime),
      }),
    );
  }

  has(challengeId: string): boolean {
    return this.registry.has(challengeId);
  }

  get(challengeId: string): Date | undefined {
    const startTime = this.registry.get(challengeId);
    return startTime ? new Date(startTime) : undefined;
  }

  size(): number {
    return this.registry.size;
  }

  clear(): void {
    this.registry.clear();
  }
}
