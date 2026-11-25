// backend/user/src/config/rabbitmq.ts
import * as amqp from 'amqplib'

// Use `any` for runtime objects to avoid mismatches between different amqplib typings
let channel: any = null;
let connection: any = null;
let reconnectTimer: NodeJS.Timeout | null = null;

const DEFAULT_RABBIT_PORT = 5672;

export const connectRabbitMQ = async (): Promise<void> => {
	const rabbitUrl = process.env.RABBITMQ_URL || `amqp://localhost:${DEFAULT_RABBIT_PORT}`;

	let attempt = 0;

	const connect = async () => {
		try {
			connection = await amqp.connect(rabbitUrl);

			if (!connection) throw new Error('RabbitMQ connection was not created');

			// Create a confirm channel so publishes can be awaited/confirmed
			channel = await connection.createConfirmChannel();

			// Optional: tune channel for better throughput
			try {
				channel.prefetch && channel.prefetch(10);
			} catch (e) {
				// ignore if prefetch not supported
			}

			console.log('✅ RabbitMQ connected');

			connection.on('error', (err: any) => {
				console.error(' ❌ RabbitMQ connection error:', err);
			});

			connection.on('close', () => {
				console.error(' ❌ RabbitMQ connection closed');
				// Attempt to reconnect with exponential backoff
				if (reconnectTimer) clearTimeout(reconnectTimer);
				attempt += 1;
				const delay = Math.min(30000, 1000 * 2 ** attempt);
				reconnectTimer = setTimeout(connect, delay);
			});

			// reset attempt counter on successful connection
			attempt = 0;
		} catch (error) {
			console.error(' ❌ Failed to connect rabbitMQ', error);
			attempt += 1;
			const delay = Math.min(30000, 1000 * 2 ** attempt);
			if (reconnectTimer) clearTimeout(reconnectTimer);
			reconnectTimer = setTimeout(connect, delay);
		}
	};

	await connect();
}

export const publishToQueue = async (queueName: string, message: any): Promise<void> => {
	if (!channel) {
		console.error(' ❌ Channel is not initialized');
		throw new Error('Channel is not initialized');
	}

	try {
		// Ensure queue exists and is durable
		await channel.assertQueue(queueName, { durable: true });

		const messageBuffer = Buffer.from(JSON.stringify(message));

		// Use ConfirmChannel to get publish acknowledgements when possible
		if (typeof channel.sendToQueue === 'function' && channel.sendToQueue.length === 4) {
			// ConfirmChannel signature uses callback for confirms
			await new Promise<void>((resolve, reject) => {
				channel.sendToQueue(queueName, messageBuffer, { persistent: true }, (err: any) => {
					if (err) return reject(err);
					return resolve();
				});
			});
		} else {
			const ok = channel.sendToQueue(queueName, messageBuffer, { persistent: true });
			if (!ok) {
				throw new Error('Channel buffer full');
			}
		}

		console.log(` ✅ Message published to queue: ${queueName}`);
		// console.log(' 📨 Message content:', message);
	} catch (error) {
		console.error(' ❌ Failed to publish message to queue', error);
		throw error;
	}
}

// Graceful shutdown
const gracefulShutdown = async () => {
	try {
		if (channel) {
			try { await channel.close(); } catch (e) {}
			channel = null;
		}
		if (connection) {
			try { await connection.close(); } catch (e) {}
			connection = null;
		}
		if (reconnectTimer) clearTimeout(reconnectTimer);
	} finally {
		process.exit(0);
	}
}

process.once('SIGINT', gracefulShutdown);
process.once('SIGTERM', gracefulShutdown);