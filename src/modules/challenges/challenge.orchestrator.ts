// src/modules/challenges/challenge.orchestrator.ts

import {
  ChallengeRegistry,
  ChallengeRegistryEntry,
} from "./challenge.registry";
import {
  ChallengesDispatcher,
  ChallengeCallback,
} from "./challenge.dispatcher";

export interface ChallengeOrchestratorEntry extends ChallengeRegistryEntry {
  isScheduled: boolean;
}

export class ChallengesOrchestrator {
  private readonly registry: ChallengeRegistry;
  private readonly dispatcher: ChallengesDispatcher;
  private readonly defaultCallback: ChallengeCallback;

  constructor() {
    this.registry = new ChallengeRegistry();
    this.dispatcher = new ChallengesDispatcher();

    this.defaultCallback = (challengeId: string, startTime: Date) => {
      console.log(
        `Challenge ${challengeId} started at ${startTime.toISOString()}`,
      );
    };
  }

  async upsert(challengeId: string, startTime: Date): Promise<void> {
    await this.registry.upsert(challengeId, startTime);
  }

  async resetRegistry(): Promise<void> {
    this.dispatcher.clear();
    await this.registry.flushAll();
  }

  registerScheduledCallback(
    challengeId: string,
    startTime: Date,
    callback?: ChallengeCallback,
  ): boolean {
    const callbackFn = callback || this.defaultCallback;
    return this.dispatcher.register(challengeId, startTime, callbackFn);
  }

  cancelScheduledCallback(challengeId: string): boolean {
    return this.dispatcher.cancel(challengeId);
  }

  listEntries(): ChallengeOrchestratorEntry[] {
    const registryEntries = this.registry.listAll();

    return registryEntries.map((entry) => ({
      ...entry,
      isScheduled: this.dispatcher.has(entry.challengeId),
    }));
  }

  scheduleAllFutureChallenges(callback?: ChallengeCallback): number {
    const entries = this.registry.listAll();
    const now = new Date();
    let scheduledCount = 0;

    for (const entry of entries) {
      if (
        entry.startTime > now &&
        !this.dispatcher.isScheduled(entry.challengeId)
      ) {
        const success = this.registerScheduledCallback(
          entry.challengeId,
          entry.startTime,
          callback,
        );
        if (success) {
          scheduledCount++;
        }
      }
    }

    return scheduledCount;
  }

  getFutureChallengesCount(): number {
    const entries = this.registry.listAll();
    const now = new Date();

    return entries.filter((entry) => entry.startTime > now).length;
  }

  getScheduledChallengesCount(): number {
    return this.dispatcher.size();
  }

  isRegistered(challengeId: string): boolean {
    return this.registry.has(challengeId);
  }

  isScheduled(challengeId: string): boolean {
    return this.dispatcher.isScheduled(challengeId);
  }

  getRegistrySize(): number {
    return this.registry.size();
  }

  clear(): void {
    this.dispatcher.clear();
    this.registry.clear();
  }

  async loadAndScheduleAll(
    callback?: ChallengeCallback,
  ): Promise<{ loaded: number; scheduled: number }> {
    await this.resetRegistry();
    const loaded = this.registry.size();
    const scheduled = this.scheduleAllFutureChallenges(callback);

    return { loaded, scheduled };
  }
}
