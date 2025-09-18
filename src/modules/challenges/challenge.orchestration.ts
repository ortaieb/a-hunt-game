// src/modules/challenges/challenge.orchestration.ts

import { ChallengesOrchestrator } from './challenge.orchestrator';
import { challengeEventBus } from './events/challenge.event-bus';
import {
  ChallengeCreatedEvent,
  ChallengeUpdatedEvent,
  ChallengeDeletedEvent,
  ChallengeStartedEvent,
} from './events/challenge.events';

// Global singleton instance of the challenges orchestrator
export const challengeOrchestrator = new ChallengesOrchestrator();

/**
 * Initialize challenge orchestration on application startup
 * Sets up event listeners and loads all active challenges
 */
export async function initializeChallengeOrchestration(): Promise<void> {
  console.log('Initializing challenge orchestration...');

  // Set up event listeners
  setupOrchestrationEventListeners();

  // Load existing challenges and schedule callbacks
  const { loaded, scheduled } = await challengeOrchestrator.loadAndScheduleAll(
    (challengeId, startTime) => {
      // Emit challenge started event when callback is triggered
      challengeEventBus.emitChallengeStarted({ challengeId, startTime });
    },
  );

  console.log(
    `Challenge orchestration initialized: ${loaded} challenges loaded, ${scheduled} scheduled for future execution`,
  );
}

/**
 * Set up event listeners for challenge orchestration
 */
function setupOrchestrationEventListeners(): void {
  // Listen for challenge created events
  challengeEventBus.onChallengeCreated(async (event: ChallengeCreatedEvent) => {
    await challengeOrchestrator.upsert(event.challengeId, event.startTime);
    challengeOrchestrator.registerScheduledCallback(
      event.challengeId,
      event.startTime,
      (challengeId, startTime) => {
        challengeEventBus.emitChallengeStarted({ challengeId, startTime });
      },
    );
  });

  // Listen for challenge updated events
  challengeEventBus.onChallengeUpdated(async (event: ChallengeUpdatedEvent) => {
    const { challengeId, startTime, previousStartTime } = event;
    const isRegistered = challengeOrchestrator.isRegistered(challengeId);

    if (isRegistered) {
      // Only update if start time has changed
      if (!previousStartTime || previousStartTime.getTime() !== startTime.getTime()) {
        // Cancel existing callback if scheduled
        if (challengeOrchestrator.isScheduled(challengeId)) {
          challengeOrchestrator.cancelScheduledCallback(challengeId);
        }

        // Update registry
        await challengeOrchestrator.upsert(challengeId, startTime);

        // Register new callback
        challengeOrchestrator.registerScheduledCallback(
          challengeId,
          startTime,
          (challengeId, startTime) => {
            challengeEventBus.emitChallengeStarted({ challengeId, startTime });
          },
        );
      }
    } else {
      // Challenge not in registry, treat as new
      await challengeOrchestrator.upsert(challengeId, startTime);
      challengeOrchestrator.registerScheduledCallback(
        challengeId,
        startTime,
        (challengeId, startTime) => {
          challengeEventBus.emitChallengeStarted({ challengeId, startTime });
        },
      );
    }
  });

  // Listen for challenge deleted events
  challengeEventBus.onChallengeDeleted(async (event: ChallengeDeletedEvent) => {
    const { challengeId } = event;

    // Cancel scheduled callback if exists
    if (challengeOrchestrator.isScheduled(challengeId)) {
      challengeOrchestrator.cancelScheduledCallback(challengeId);
    }

    // Remove from registry (if exists)
    // Note: We don't have a delete method in registry, but this would handle cleanup
    // The registry will be refreshed on next loadAndScheduleAll call
  });
}
