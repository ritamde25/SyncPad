import { Redis } from "ioredis";
import type { Operation } from "../types/operation.js";

type OperationListener = (docId: string, operation: Operation) => void;

interface RedisOperationEnvelope {
	docId: string;
	operation: Operation;
	originServerId: string;
}

const useRedis = process.env.USE_REDIS === "true";
const redisUrl = process.env.REDIS_URL;
const pub = useRedis ? (redisUrl ? new Redis(redisUrl) : new Redis()) : null;
const sub = useRedis ? (redisUrl ? new Redis(redisUrl) : new Redis()) : null;
const serverId = `${process.pid}-${Math.random().toString(36).slice(2)}`;

const channelSubscriptions = new Map<string, number>();
const listeners = new Set<OperationListener>();

function getChannel(docId: string): string {
	return `doc:${docId}`;
}

if (pub && sub) {
	pub.on("error", (error) => {
		console.error("Redis publisher error:", error);
	});

	sub.on("error", (error) => {
		console.error("Redis subscriber error:", error);
	});

	sub.on("message", (channel: string, message: string) => {
		if (!channel.startsWith("doc:")) {
			return;
		}

		try {
			const parsed = JSON.parse(message) as RedisOperationEnvelope | Operation;
			const docId = "docId" in parsed ? parsed.docId : channel.slice(4);
			const operation = "operation" in parsed ? parsed.operation : parsed;
			const origin = "originServerId" in parsed ? parsed.originServerId : undefined;

			// Skip operations produced by this process to avoid duplicate local broadcasts.
			if (origin === serverId) {
				return;
			}

			listeners.forEach((listener) => listener(docId, operation));
		} catch (error) {
			console.error("Failed to parse Redis operation message:", error);
		}
	});
} else {
	console.log("Redis pub/sub disabled (USE_REDIS is false)");
}

export function onRedisOperation(listener: OperationListener): () => void {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

export async function subscribeToDocument(docId: string): Promise<void> {
	if (!sub) {
		return;
	}

	const channel = getChannel(docId);
	const count = channelSubscriptions.get(channel) ?? 0;

	if (count === 0) {
		await sub.subscribe(channel);
	}

	channelSubscriptions.set(channel, count + 1);
}

export async function unsubscribeFromDocument(docId: string): Promise<void> {
	if (!sub) {
		return;
	}

	const channel = getChannel(docId);
	const count = channelSubscriptions.get(channel);

	if (!count) {
		return;
	}

	if (count === 1) {
		channelSubscriptions.delete(channel);
		await sub.unsubscribe(channel);
		return;
	}

	channelSubscriptions.set(channel, count - 1);
}

export async function publishOperation(docId: string, operation: Operation): Promise<void> {
	if (!pub) {
		return;
	}

	const payload: RedisOperationEnvelope = {
		docId,
		operation,
		originServerId: serverId,
	};

	await pub.publish(getChannel(docId), JSON.stringify(payload));
}
