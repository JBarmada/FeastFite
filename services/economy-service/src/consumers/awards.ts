import type { Channel } from 'amqplib';
import type {
  UserRegisteredEvent,
  VoteParticipantEvent,
  VoteWinnerDeclaredEvent,
} from '@feastfite/shared';
import { config } from '../config';
import { awardPoints } from '../ledger';

const QUEUE = 'economy-service.awards';

type Incoming =
  | VoteWinnerDeclaredEvent
  | VoteParticipantEvent
  | UserRegisteredEvent;

export async function startAwardsConsumer(channel: Channel): Promise<void> {
  const ex = config.rabbitmq.exchange;

  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, ex, 'vote.winner_declared');
  await channel.bindQueue(QUEUE, ex, 'vote.participant');
  await channel.bindQueue(QUEUE, ex, 'user.registered');
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
            ref
          );
          break;
        }
        case 'vote.participant': {
          const e = raw as VoteParticipantEvent;
          const ref = `vote_part:${e.sessionId}:${e.userId}`;
          await awardPoints(
            e.userId,
            config.points.voteParticipant,
            'vote_participant',
            ref
          );
          break;
        }
        case 'user.registered': {
          const e = raw as UserRegisteredEvent;
          const ref = `signup:${e.userId}`;
          await awardPoints(e.userId, config.points.signupBonus, 'signup_bonus', ref);
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
