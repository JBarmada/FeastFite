import amqplib, { type ChannelModel, type Channel } from 'amqplib';

const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface AmqpConnection {
  connection: ChannelModel;
  channel: Channel;
}

export interface AmqpConnectorOptions {
  url?: string;
  exchangeName?: string;
  logPrefix?: string;
  reconnectDelayMs?: number;
  onConnect: (connection: AmqpConnection) => Promise<void> | void;
  onDisconnect?: (error?: Error) => Promise<void> | void;
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

export function startAmqpConnector(options: AmqpConnectorOptions): { stop: () => Promise<void> } {
  const amqpUrl = options.url ?? process.env['RABBITMQ_URL'] ?? 'amqp://guest:guest@localhost:5672';
  const exchange = options.exchangeName ?? process.env['RABBITMQ_EXCHANGE'] ?? 'feastfite.events';
  const reconnectDelayMs = options.reconnectDelayMs ?? RECONNECT_DELAY_MS;
  const logPrefix = options.logPrefix ?? '[amqp]';

  let stopped = false;
  let connection: ChannelModel | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let disconnecting = false;

  const clearReconnectTimer = (): void => {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const scheduleReconnect = (): void => {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, reconnectDelayMs);
  };

  const handleDisconnect = async (error?: Error): Promise<void> => {
    if (disconnecting) return;
    disconnecting = true;
    try {
      await options.onDisconnect?.(error);
    } finally {
      connection = null;
      disconnecting = false;
      scheduleReconnect();
    }
  };

  const connect = async (): Promise<void> => {
    if (stopped) return;

    let nextConnection: ChannelModel | null = null;
    let connectionActive = true;

    try {
      nextConnection = await amqplib.connect(amqpUrl);
      const channel = await nextConnection.createChannel();

      await channel.assertExchange(exchange, 'topic', { durable: true });

      connection = nextConnection;
      console.info(`${logPrefix} connected to ${amqpUrl}, exchange: ${exchange}`);

      const disconnectCurrentConnection = async (error?: Error): Promise<void> => {
        if (!connectionActive) return;
        connectionActive = false;
        await handleDisconnect(error);
      };

      nextConnection.on('error', (err: Error) => {
        console.error(`${logPrefix} connection error:`, err.message);
        void disconnectCurrentConnection(err);
      });

      nextConnection.on('close', () => {
        console.warn(`${logPrefix} connection closed, scheduling reconnect...`);
        void disconnectCurrentConnection();
      });

      await options.onConnect({ connection: nextConnection, channel });
    } catch (err) {
      connectionActive = false;
      if (nextConnection) {
        await nextConnection.close().catch(() => undefined);
      }
      console.warn(`${logPrefix} connect failed, retrying in ${reconnectDelayMs}ms...`, String(err));
      scheduleReconnect();
    }
  };

  void connect();

  return {
    stop: async (): Promise<void> => {
      stopped = true;
      clearReconnectTimer();
      if (connection) {
        await connection.close().catch(() => undefined);
        connection = null;
      }
    },
  };
}
