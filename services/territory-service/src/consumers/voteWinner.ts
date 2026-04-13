import type { Channel } from 'amqplib';
import type { VoteWinnerDeclaredEvent } from '@feastfite/shared';
import { pool } from '../db.js';

const EXCHANGE = process.env['RABBITMQ_EXCHANGE'] ?? 'feastfite.events';
const QUEUE    = 'territory-service.vote.winner_declared';
const ROUTING  = 'vote.winner_declared';

/**
 * Consume `vote.winner_declared` events and commit territory ownership
 * to the winning user.
 */
export async function startVoteWinnerConsumer(channel: Channel): Promise<void> {
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING);
  channel.prefetch(1);

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    let event: VoteWinnerDeclaredEvent;
    try {
      event = JSON.parse(msg.content.toString()) as VoteWinnerDeclaredEvent;
    } catch {
      console.error('[voteWinner] malformed message — discarding');
      channel.nack(msg, false, false);
      return;
    }

    const { territoryId, winnerId, winnerPhotoKey } = event;

    try {
      await pool.query(
        `UPDATE territories
            SET owner_id       = $1,
                owner_type     = 'user',
                dish_photo_key = $2,
                captured_at    = NOW(),
                locked_until   = NOW() + INTERVAL '1 hour',
                updated_at     = NOW()
          WHERE id = $3`,
        [winnerId, winnerPhotoKey, territoryId],
      );

      console.info(
        `[voteWinner] territory ${territoryId} committed to winner ${winnerId}`,
      );
      channel.ack(msg);
    } catch (err) {
      console.error('[voteWinner] db update failed, requeuing:', err);
      channel.nack(msg, false, true);
    }
  });

  console.info(`[voteWinner] listening on queue "${QUEUE}"`);
}
