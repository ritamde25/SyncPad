import { WebSocketServer } from "ws";
import { joinRoom, leaveRoom, broadcast, setClientVersion, getLowestActiveVersion } from "./connectionManager.js";
import { ensureDocumentSession, markDocumentSessionDirty, peekDocumentSession, pruneDocumentSession } from "../collab/documentSession.js";
import { applyOperation } from "../collab/applyOperation.js";
import { transform } from "../collab/transformer.js";
import type { ClientMessage, InitMessage, BroadcastOperationMessage } from "../types/messages.js";
import { onRedisOperation, publishOperation, subscribeToDocument, unsubscribeFromDocument } from "../redis/pubsub.js";

export function setupWebSocket(server: any): void {
  const wss = new WebSocketServer({ server });
  const disposeRedisListener = onRedisOperation((docId, operation) => {
    const session = peekDocumentSession(docId);

    if (!session || operation.version <= session.version) return;

    session.content = applyOperation(session.content, operation);
    session.version = operation.version;
    session.operations.push(operation);
    markDocumentSessionDirty(docId);

    const lowestActiveVersion = getLowestActiveVersion(docId);
    if (lowestActiveVersion !== null) {
      pruneDocumentSession(session, lowestActiveVersion);
    }

    const updateMessage: BroadcastOperationMessage = {
      type: "operation",
      operation,
    };

    // Redis operations are already transformed on the origin server, so this server only applies and forwards.
    broadcast(docId, updateMessage);
  });

  wss.on("close", () => {
    disposeRedisListener();
  });

  wss.on("connection", (ws) => {
    let currentDocId: string | null = null;

    console.log("New WebSocket connection");

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;

        // JOIN document
        if (msg.type === "join") {
          currentDocId = msg.docId;
          const session = await ensureDocumentSession(currentDocId);
          joinRoom(currentDocId, ws, session.version);
          subscribeToDocument(currentDocId).catch(() => undefined);

          // Send initial document content
          const initMessage: InitMessage = {
            type: "init",
            content: session.content,
            version: session.version,
          };

          ws.send(JSON.stringify(initMessage));
          setClientVersion(currentDocId, ws, session.version);
          console.log(`Client initialized with doc ${currentDocId}`);
        }

        // APPLY operation
        if (msg.type === "operation") {
          if (!currentDocId) {
            return;
          }

          const session = peekDocumentSession(currentDocId);

          if (!session) {
            return;
          }

          const incomingVersion = msg.operation.version;

          if (incomingVersion < session.baseVersion || incomingVersion > session.version) {
            const initMessage: InitMessage = {
              type: "init",
              content: session.content,
              version: session.version,
            };

            ws.send(JSON.stringify(initMessage));
            setClientVersion(currentDocId, ws, session.version);
            return;
          }

          let incoming = { ...msg.operation };
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
          setClientVersion(currentDocId, ws, session.version);
          markDocumentSessionDirty(currentDocId);

          // Broadcast transformed operation to every client in the room
          const updateMessage: BroadcastOperationMessage = {
            type: "operation",
            operation: storedOperation,
          };

          broadcast(currentDocId, updateMessage);
          publishOperation(currentDocId, storedOperation).catch(() => undefined);

          const lowestActiveVersion = getLowestActiveVersion(currentDocId);
          if (lowestActiveVersion !== null) {
            pruneDocumentSession(session, lowestActiveVersion);
          }

          console.log(`Document ${currentDocId} updated to version ${session.version}`);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      if (currentDocId) {
        leaveRoom(currentDocId, ws);
        unsubscribeFromDocument(currentDocId).catch(() => undefined);
        console.log(`Client disconnected from doc ${currentDocId}`);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  console.log("WebSocket server initialized");
}
