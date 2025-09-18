// src/modules/challenges/events/challenge.events.ts

export interface ChallengeCreatedEvent {
  challengeId: string;
  startTime: Date;
}

export interface ChallengeUpdatedEvent {
  challengeId: string;
  startTime: Date;
  previousStartTime?: Date;
}

export interface ChallengeDeletedEvent {
  challengeId: string;
}

export interface ChallengeStartedEvent {
  challengeId: string;
  startTime: Date;
}

export enum ChallengeEventType {
  CREATED = 'challenge.created',
  UPDATED = 'challenge.updated',
  DELETED = 'challenge.deleted',
  STARTED = 'challenge.started',
}

export type ChallengeEventData =
  | ChallengeCreatedEvent
  | ChallengeUpdatedEvent
  | ChallengeDeletedEvent
  | ChallengeStartedEvent;

export interface ChallengeEventListener<T = ChallengeEventData> {
  (data: T): void;
}
