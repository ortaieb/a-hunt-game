// src/modules/challenges/challenge.orchestration.ts

import { ChallengesOrchestrator } from './challenge.orchestrator';

// Global singleton instance of the challenges orchestrator
export const challengeOrchestrator = new ChallengesOrchestrator();

/**
 * Initialize challenge orchestration on application startup
 * Loads all active challenges and schedules callbacks for future challenges
 */
export async function initializeChallengeOrchestration(): Promise<void> {
  console.log('Initializing challenge orchestration...');

  const { loaded, scheduled } = await challengeOrchestrator.loadAndScheduleAll();

  console.log(
    `Challenge orchestration initialized: ${loaded} challenges loaded, ${scheduled} scheduled for future execution`,
  );
}

/**
 * Register a new challenge with the orchestrator
 */
export async function registerNewChallenge(challengeId: string, startTime: Date): Promise<void> {
  await challengeOrchestrator.upsert(challengeId, startTime);
  challengeOrchestrator.registerScheduledCallback(challengeId, startTime);
}

/**
 * Update an existing challenge in the orchestrator
 */
export async function updateExistingChallenge(
  challengeId: string,
  newStartTime: Date,
): Promise<void> {
  const isRegistered = challengeOrchestrator.isRegistered(challengeId);

  if (isRegistered) {
    // Get current start time to check if it changed
    const currentStartTime = challengeOrchestrator
      .listEntries()
      .find(entry => entry.challengeId === challengeId)?.startTime;

    // Only update if start time has changed
    if (!currentStartTime || currentStartTime.getTime() !== newStartTime.getTime()) {
      // Cancel existing callback if scheduled
      if (challengeOrchestrator.isScheduled(challengeId)) {
        challengeOrchestrator.cancelScheduledCallback(challengeId);
      }

      // Update registry
      await challengeOrchestrator.upsert(challengeId, newStartTime);

      // Register new callback
      challengeOrchestrator.registerScheduledCallback(challengeId, newStartTime);
    }
  } else {
    // Challenge not in registry, treat as new
    await registerNewChallenge(challengeId, newStartTime);
  }
}
