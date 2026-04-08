import WebSocket, { WebSocketServer } from "ws";
import { joinRoom, leaveRoom, broadcast } from "./connectionManager.js";
import { ensureDocumentSession, markDocumentSessionDirty, peekDocumentSession } from "../collab/documentSession.js";
import { applyOperation } from "../collab/applyOperation.js";
import { transform } from "../collab/transformer.js";
import type {
  InitMessage,
  BroadcastOperationMessage,
  BroadcastCursorMessage,
  ClientMessage,
  CursorRemoveMessage,
} from "../types/messages.js";
import type { Operation } from "../types/operation.js";
import { onRedisOperation, publishOperation, subscribeToDocument, unsubscribeFromDocument } from "../redis/pubsub.js";

const pendingRedisOperations = new Map<string, Map<number, Operation>>();

function syncClientWithSession(docId: string, ws: WebSocket, content: string, version: number): void {
  const initMessage: InitMessage = {
    type: "init",
    content,
    version,
  };

  ws.send(JSON.stringify(initMessage));
}

function broadcastOperation(docId: string, operation: Operation): void {
  const updateMessage: BroadcastOperationMessage = {
    type: "operation",
    operation,
  };

  broadcast(docId, updateMessage);
}

function queuePendingRedisOperation(docId: string, operation: Operation): void {
  let queued = pendingRedisOperations.get(docId);

  if (!queued) {
    queued = new Map<number, Operation>();
    pendingRedisOperations.set(docId, queued);
  }

  if (!queued.has(operation.version)) {
    queued.set(operation.version, operation);
  }
}

function applyRemoteOperation(docId: string, operation: Operation): void {
  const session = peekDocumentSession(docId);

  if (!session) {
    return;
  }

  session.content = applyOperation(session.content, operation);
  session.version = operation.version;
  session.operations.push(operation);
  markDocumentSessionDirty(docId);

  // Redis operations are already transformed on the origin server, so this server only applies and forwards.
  broadcastOperation(docId, operation);
}

function flushPendingRedisOperations(docId: string): void {
  const session = peekDocumentSession(docId);

  if (!session) {
    return;
  }

  const queued = pendingRedisOperations.get(docId);

  if (!queued || queued.size === 0) {
    return;
  }

  let nextVersion = session.version + 1;

  while (queued.has(nextVersion)) {
    const operation = queued.get(nextVersion);

    if (!operation) {
      break;
    }

    queued.delete(nextVersion);
    applyRemoteOperation(docId, operation);
    nextVersion += 1;
  }

  if (queued.size === 0) {
    pendingRedisOperations.delete(docId);
  }
}

export function setupWebSocket(server: any): void {
  const wss = new WebSocketServer({ server });
  const disposeRedisListener = onRedisOperation((docId, operation) => {
    const session = peekDocumentSession(docId);

    if (!session || operation.version <= session.version) {
      return;
    }

    queuePendingRedisOperation(docId, operation);
    flushPendingRedisOperations(docId);
  });

  wss.on("close", () => {
    disposeRedisListener();
  });

  wss.on("connection", (ws) => {
    let currentDocId: string | null = null;
    let currentClientId: string | null = null;

    ws.on("message", async (data) => {
      let parsedMessage: ClientMessage;

      try {
        parsedMessage = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        return;
      }

      try {
        switch (parsedMessage.type) {
          case "join": {
            currentDocId = parsedMessage.docId;
            currentClientId = parsedMessage.clientId;
            const session = await ensureDocumentSession(currentDocId);
            joinRoom(currentDocId, ws);
            subscribeToDocument(currentDocId).catch(() => undefined);
            syncClientWithSession(currentDocId, ws, session.content, session.version);
            return;
          }

          case "cursor": {
            if (!currentDocId || !currentClientId) {
              return;
            }

            const cursor = parsedMessage.cursor;

            const cursorMessage: BroadcastCursorMessage = {
              type: "cursor",
              cursor: {
                ...cursor,
                userId: currentClientId,
              },
            };

            broadcast(currentDocId, cursorMessage, ws);
            return;
          }

          case "operation": {
            if (!currentDocId) {
              return;
            }

            const session = peekDocumentSession(currentDocId);

            if (!session) {
              return;
            }

            const operation = parsedMessage.operation;

            const incomingVersion = operation.version;

            if (incomingVersion < session.baseVersion || incomingVersion > session.version) {
              syncClientWithSession(currentDocId, ws, session.content, session.version);
              return;
            }

            let incoming = { ...operation };
            const historyStartIndex = Math.max(0, incomingVersion - session.baseVersion);

            for (let i = historyStartIndex; i < session.operations.length; i += 1) {
              incoming = transform(incoming, session.operations[i]);
            }

            session.content = applyOperation(session.content, incoming);
            session.version += 1;

            const storedOperation = {
              ...incoming,
              version: session.version,
            };

            session.operations.push(storedOperation);
            markDocumentSessionDirty(currentDocId);
            flushPendingRedisOperations(currentDocId);

            // Broadcast transformed operation to every client in the room
            broadcastOperation(currentDocId, storedOperation);
            publishOperation(currentDocId, storedOperation).catch(() => undefined);
            return;
          }

          default:
            return;
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      if (currentDocId && currentClientId) {
        const cursorRemoveMessage: CursorRemoveMessage = {
          type: "cursor-remove",
          userId: currentClientId,
        };
        broadcast(currentDocId, cursorRemoveMessage);
      }

      if (currentDocId) {
        leaveRoom(currentDocId, ws);
        unsubscribeFromDocument(currentDocId).catch(() => undefined);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  console.log("WebSocket server initialized");
}
