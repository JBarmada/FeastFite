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

    const { territoryId, winnerId, winnerPhotoKey, winnerName, sessionId, candidates } = event;

    try {
      // Check if the territory is currently shielded
      const { rows: shieldRows } = await pool.query<{ shielded_until: string | null }>(
        `SELECT shielded_until FROM territories WHERE id = $1`,
        [territoryId]
      );
      const shieldedUntil = shieldRows[0]?.shielded_until;
      const isShielded = shieldedUntil && new Date(shieldedUntil) > new Date();

      if (isShielded) {
        console.info(
          `[voteWinner] territory ${territoryId} is shielded until ${shieldedUntil} — ownership change blocked`
        );
        channel.ack(msg);
        return;
      }

      await pool.query(
        `UPDATE territories
            SET owner_id       = $1,
                owner_name     = $4,
                owner_type     = 'user',
                dish_photo_key = $2,
                captured_at    = NOW(),
                locked_until   = NULL,
                updated_at     = NOW()
          WHERE id = $3`,
        [winnerId, winnerPhotoKey, territoryId, winnerName ?? 'Unknown Foodie'],
      );

      // Persist per-candidate vote stats to claim_history
      if (candidates && candidates.length > 0) {
        for (const c of candidates) {
          const isWinner = c.userId === winnerId;
          await pool.query(
            `UPDATE claim_history
                SET is_winner   = $1,
                    avg_rating  = $2,
                    vote_count  = $3,
                    total_rating = $4
              WHERE session_id = $5 AND claimant_id = $6`,
            [isWinner, c.avgRating, c.votes, c.totalRating, sessionId, c.userId],
          );
          // If no existing row (e.g. defender wasn't logged on initial claim), insert one
          if (isWinner) {
            await pool.query(
              `INSERT INTO claim_history
                 (territory_id, claimant_id, claimant_name, photo_key, is_winner,
                  session_id, avg_rating, vote_count, total_rating)
               SELECT $1, $2, $3, $4, true, $5, $6, $7, $8
               WHERE NOT EXISTS (
                 SELECT 1 FROM claim_history WHERE session_id = $5 AND claimant_id = $2
               )`,
              [territoryId, c.userId, winnerName ?? 'Unknown Foodie', c.photoKey,
               sessionId, c.avgRating, c.votes, c.totalRating],
            );
          }
        }
      }

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
