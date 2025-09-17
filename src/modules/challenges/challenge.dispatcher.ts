// src/modules/challenges/challenge.dispatcher.ts

export type ChallengeCallback = (challengeId: string, startTime: Date) => void;

export interface ScheduledCallback {
  challengeId: string;
  startTime: Date;
  callback: ChallengeCallback;
  timeoutId: NodeJS.Timeout;
}

export class ChallengesDispatcher {
  private readonly scheduledCallbacks = new Map<string, ScheduledCallback>();

  register(challengeId: string, startTime: Date, callback: ChallengeCallback): boolean {
    if (this.scheduledCallbacks.has(challengeId)) {
      return false;
    }

    const now = new Date();
    const startTimeMs = startTime.getTime();
    const nowMs = now.getTime();

    if (startTimeMs <= nowMs) {
      callback(challengeId, startTime);
      return true;
    }

    const delay = startTimeMs - nowMs;
    const timeoutId = setTimeout(() => {
      callback(challengeId, startTime);
      this.scheduledCallbacks.delete(challengeId);
    }, delay);

    const scheduledCallback: ScheduledCallback = {
      challengeId,
      startTime: new Date(startTime),
      callback,
      timeoutId,
    };

    this.scheduledCallbacks.set(challengeId, scheduledCallback);
    return true;
  }

  cancel(challengeId: string): boolean {
    const scheduled = this.scheduledCallbacks.get(challengeId);
    if (!scheduled) {
      return false;
    }

    clearTimeout(scheduled.timeoutId);
    this.scheduledCallbacks.delete(challengeId);
    return true;
  }

  listAll(): Array<Omit<ScheduledCallback, 'timeoutId' | 'callback'>> {
    return Array.from(this.scheduledCallbacks.values()).map(({ challengeId, startTime }) => ({
      challengeId,
      startTime: new Date(startTime),
    }));
  }

  has(challengeId: string): boolean {
    return this.scheduledCallbacks.has(challengeId);
  }

  size(): number {
    return this.scheduledCallbacks.size;
  }

  clear(): void {
    for (const scheduled of this.scheduledCallbacks.values()) {
      clearTimeout(scheduled.timeoutId);
    }
    this.scheduledCallbacks.clear();
  }

  isScheduled(challengeId: string): boolean {
    return this.scheduledCallbacks.has(challengeId);
  }

  getScheduled(challengeId: string): Date | undefined {
    const scheduled = this.scheduledCallbacks.get(challengeId);
    return scheduled ? new Date(scheduled.startTime) : undefined;
  }
}
