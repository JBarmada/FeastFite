import type { Feature } from 'geojson';

export interface User {
  id: string;
  email: string;
  username: string;
  clanId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Territory {
  id: string;
  name: string;
  geoJson: Feature;
  ownerId: string | null;
  ownerType: 'user' | 'clan' | null;
  capturedAt: Date | null;
  lockedUntil: Date | null;
  dishPhotoKey: string | null;
  updatedAt: Date;
}

export interface VoteSession {
  id: string;
  territoryId: string;
  challengerId: string;
  defenderId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  winnerId: string | null;
  winnerPhotoKey: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

export interface PointsLedgerEntry {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  referenceId: string | null;
  createdAt: Date;
}

export interface Achievement {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  awardedAt: Date;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  founderId: string;
  memberCount: number;
  totalPoints: number;
  createdAt: Date;
}

// ── Event schemas ─────────────────────────────────────────────────

export interface VoteWinnerDeclaredEvent {
  eventType: 'vote.winner_declared';
  sessionId: string;
  territoryId: string;
  winnerId: string;
  winnerPhotoKey: string;
  timestamp: string;
}

export interface VoteParticipantEvent {
  eventType: 'vote.participant';
  sessionId: string;
  territoryId: string;
  userId: string;
  candidateId: string;
  timestamp: string;
}

export interface TerritoryClaimedEvent {
  eventType: 'territory.claimed';
  territoryId: string;
  newOwnerId: string;
  previousOwnerId: string | null;
  timestamp: string;
}

export interface ItemPurchasedEvent {
  eventType: 'item.purchased';
  userId: string;
  itemId: string;
  itemType: 'cosmetic' | 'boost' | 'consumable';
  pointsSpent: number;
  timestamp: string;
}

export interface UserRegisteredEvent {
  eventType: 'user.registered';
  userId: string;
  email: string;
  timestamp: string;
}

export type FeastFiteEvent =
  | VoteWinnerDeclaredEvent
  | VoteParticipantEvent
  | TerritoryClaimedEvent
  | ItemPurchasedEvent
  | UserRegisteredEvent;
