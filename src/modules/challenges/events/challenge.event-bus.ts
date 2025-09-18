// src/modules/challenges/events/challenge.event-bus.ts

import { EventBus } from '../../../shared/events/event-bus';
import {
  ChallengeEventType,
  ChallengeEventData,
  ChallengeEventListener,
  ChallengeCreatedEvent,
  ChallengeUpdatedEvent,
  ChallengeDeletedEvent,
  ChallengeStartedEvent,
} from './challenge.events';

export class ChallengeEventBus extends EventBus {
  private static instance: ChallengeEventBus;

  private constructor() {
    super();
  }

  static getInstance(): ChallengeEventBus {
    if (!ChallengeEventBus.instance) {
      ChallengeEventBus.instance = new ChallengeEventBus();
    }
    return ChallengeEventBus.instance;
  }

  getEventName(event: string): string {
    return event; // Challenge events already have full namespace
  }

  // Typed event emitters
  emitChallengeCreated(data: ChallengeCreatedEvent): boolean {
    return this.emitEvent(ChallengeEventType.CREATED, data);
  }

  emitChallengeUpdated(data: ChallengeUpdatedEvent): boolean {
    return this.emitEvent(ChallengeEventType.UPDATED, data);
  }

  emitChallengeDeleted(data: ChallengeDeletedEvent): boolean {
    return this.emitEvent(ChallengeEventType.DELETED, data);
  }

  emitChallengeStarted(data: ChallengeStartedEvent): boolean {
    return this.emitEvent(ChallengeEventType.STARTED, data);
  }

  // Typed event listeners
  onChallengeCreated(listener: ChallengeEventListener<ChallengeCreatedEvent>): this {
    return this.onEvent(ChallengeEventType.CREATED, listener);
  }

  onChallengeUpdated(listener: ChallengeEventListener<ChallengeUpdatedEvent>): this {
    return this.onEvent(ChallengeEventType.UPDATED, listener);
  }

  onChallengeDeleted(listener: ChallengeEventListener<ChallengeDeletedEvent>): this {
    return this.onEvent(ChallengeEventType.DELETED, listener);
  }

  onChallengeStarted(listener: ChallengeEventListener<ChallengeStartedEvent>): this {
    return this.onEvent(ChallengeEventType.STARTED, listener);
  }

  // Typed event listener removal
  offChallengeCreated(listener: ChallengeEventListener<ChallengeCreatedEvent>): this {
    return this.offEvent(ChallengeEventType.CREATED, listener);
  }

  offChallengeUpdated(listener: ChallengeEventListener<ChallengeUpdatedEvent>): this {
    return this.offEvent(ChallengeEventType.UPDATED, listener);
  }

  offChallengeDeleted(listener: ChallengeEventListener<ChallengeDeletedEvent>): this {
    return this.offEvent(ChallengeEventType.DELETED, listener);
  }

  offChallengeStarted(listener: ChallengeEventListener<ChallengeStartedEvent>): this {
    return this.offEvent(ChallengeEventType.STARTED, listener);
  }
}

// Export singleton instance
export const challengeEventBus = ChallengeEventBus.getInstance();
