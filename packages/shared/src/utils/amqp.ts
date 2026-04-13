import amqplib, { type ChannelModel, type Channel } from 'amqplib';

const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface AmqpConnection {
  connection: ChannelModel;
  channel: Channel;
}

export async function createAmqpConnection(
  url?: string,
  exchangeName?: string
): Promise<AmqpConnection> {
  const amqpUrl = url ?? process.env['RABBITMQ_URL'] ?? 'amqp://guest:guest@localhost:5672';
  const exchange = exchangeName ?? process.env['RABBITMQ_EXCHANGE'] ?? 'feastfite.events';

  let attempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  async function connect(): Promise<AmqpConnection> {
    attempts += 1;
    try {
      const connection = await amqplib.connect(amqpUrl);
      const channel = await connection.createChannel();

      await channel.assertExchange(exchange, 'topic', { durable: true });

      connection.on('error', (err: Error) => {
        console.error('[amqp] connection error:', err.message);
        scheduleReconnect();
      });

      connection.on('close', () => {
        console.warn('[amqp] connection closed, reconnecting...');
        scheduleReconnect();
      });

      console.info(`[amqp] connected to ${amqpUrl}, exchange: ${exchange}`);
      attempts = 0;
      return { connection, channel };
    } catch (err) {
      if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        throw new Error(
          `[amqp] failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts: ${String(err)}`
        );
      }
      console.warn(
        `[amqp] connect attempt ${attempts} failed, retrying in ${RECONNECT_DELAY_MS}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
      return connect();
    }
  }

  function scheduleReconnect(): void {
    if (reconnectTimeout) return;
    reconnectTimeout = setTimeout(async () => {
      reconnectTimeout = null;
      await connect().catch((err: unknown) => {
        console.error('[amqp] reconnect failed permanently:', err);
        process.exit(1);
      });
    }, RECONNECT_DELAY_MS);
  }

  return connect();
}
