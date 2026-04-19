import type { Channel } from 'amqplib';
import type {
  UserRegisteredEvent,
  VoteParticipantEvent,
  VoteWinnerDeclaredEvent,
  TerritoryClaimedEvent,
} from '@feastfite/shared';
import { config } from '../config';
import { awardPoints } from '../ledger';

const QUEUE = 'economy-service.awards';

type Incoming =
  | VoteWinnerDeclaredEvent
  | VoteParticipantEvent
  | UserRegisteredEvent
  | TerritoryClaimedEvent;

export async function startAwardsConsumer(channel: Channel): Promise<void> {
  const ex = config.rabbitmq.exchange;

  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, ex, 'vote.winner_declared');
  await channel.bindQueue(QUEUE, ex, 'vote.participant');
  await channel.bindQueue(QUEUE, ex, 'user.registered');
  await channel.bindQueue(QUEUE, ex, 'territory.claimed');
  channel.prefetch(1);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    let raw: Incoming;
    try {
      raw = JSON.parse(msg.content.toString()) as Incoming;
    } catch {
      console.error('[economy.awards] malformed JSON — discarding');
      channel.nack(msg, false, false);
      return;
    }

    try {
      switch (raw.eventType) {
        case 'vote.winner_declared': {
          const e = raw as VoteWinnerDeclaredEvent;
          const ref = `vote_win:${e.sessionId}`;
          await awardPoints(
            e.winnerId,
            config.points.voteWinner,
            'vote_winner',
            ref,
            e.territoryId
          );
          break;
        }
        case 'vote.participant': {
          const e = raw as VoteParticipantEvent;
          // Award participation points to the voter
          const ref = `vote_part:${e.sessionId}:${e.userId}:${e.candidateId}`;
          await awardPoints(
            e.userId,
            config.points.voteParticipant,
            'vote_participant',
            ref,
            e.territoryId
          );
          // Award rating points to the dish owner (rating * 10)
          if (e.candidateUserId && e.candidateUserId !== e.userId) {
            const ratingRef = `dish_rated:${e.sessionId}:${e.candidateId}:${e.userId}`;
            await awardPoints(
              e.candidateUserId,
              (e.rating ?? 5) * 10,
              `dish_rated`,
              ratingRef,
              e.territoryId
            );
          }
          break;
        }
        case 'user.registered': {
          const e = raw as UserRegisteredEvent;
          const ref = `signup:${e.userId}`;
          await awardPoints(e.userId, config.points.signupBonus, 'signup_bonus', ref);
          break;
        }
        case 'territory.claimed': {
          const e = raw as TerritoryClaimedEvent;
          const ref = `claim:${e.territoryId}:${e.timestamp}`;
          await awardPoints(
            e.newOwnerId,
            50, // 50 points for territory ownership
            'territory_claim',
            ref,
            e.territoryId
          );
          break;
        }
        default:
          break;
      }
      channel.ack(msg);
    } catch (err) {
      console.error('[economy.awards] handler failed, requeuing:', err);
      channel.nack(msg, false, true);
    }
  });

  console.info(`[economy.awards] listening on queue "${QUEUE}"`);
}
