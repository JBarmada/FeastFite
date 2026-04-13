import type { Channel } from 'amqplib';
import type { UserRegisteredEvent } from '@feastfite/shared';
import { config } from '../config';

let channel: Channel | null = null;

export function setAmqpChannel(ch: Channel): void {
  channel = ch;
}

export async function publishUserRegistered(
  event: Omit<UserRegisteredEvent, 'eventType'>
): Promise<void> {
  if (!channel) {
    console.warn('[events] AMQP channel not ready, skipping user.registered publish');
    return;
  }
  const payload: UserRegisteredEvent = { eventType: 'user.registered', ...event };
  channel.publish(
    config.rabbitmq.exchange,
    'user.registered',
    Buffer.from(JSON.stringify(payload)),
    { persistent: true, contentType: 'application/json' }
  );
  console.info('[events] published user.registered for', event.userId);
}
