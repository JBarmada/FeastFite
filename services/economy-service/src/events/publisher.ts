import type { Channel } from 'amqplib';
import type { ItemPurchasedEvent } from '@feastfite/shared';
import { config } from '../config';

let channel: Channel | null = null;

export function setAmqpChannel(ch: Channel): void {
  channel = ch;
}

export function publishItemPurchased(event: Omit<ItemPurchasedEvent, 'eventType'>): void {
  if (!channel) {
    console.warn('[events] AMQP channel not ready, skipping item.purchased');
    return;
  }
  const payload: ItemPurchasedEvent = { eventType: 'item.purchased', ...event };
  channel.publish(
    config.rabbitmq.exchange,
    'item.purchased',
    Buffer.from(JSON.stringify(payload)),
    { persistent: true, contentType: 'application/json' }
  );
  console.info('[events] published item.purchased', event.itemId, 'for', event.userId);
}
