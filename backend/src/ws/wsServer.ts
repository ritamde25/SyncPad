import { WebSocketServer } from "ws";
import { joinRoom, leaveRoom, broadcast } from "./connectionManager.js";
import { getDocument, updateDocument } from "../collab/documentStore.js";
import type { ClientMessage, InitMessage, BroadcastUpdateMessage } from "../types/messages.js";

export function setupWebSocket(server: any): void {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let currentDocId: string | null = null;

    console.log("New WebSocket connection");

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientMessage;

        // JOIN document
        if (msg.type === "join") {
          currentDocId = msg.docId;
          joinRoom(currentDocId, ws);

          // Send initial document content
          const content = getDocument(currentDocId);
          const initMessage: InitMessage = {
            type: "init",
            content,
          };

          ws.send(JSON.stringify(initMessage));
          console.log(`Client initialized with doc ${currentDocId}`);
        }

        // UPDATE document
        if (msg.type === "update") {
          if (!currentDocId) {
            console.warn("Update received but no document joined");
            return;
          }

          updateDocument(currentDocId, msg.content);

          // Broadcast update to other clients in same room
          const updateMessage: BroadcastUpdateMessage = {
            type: "update",
            content: msg.content,
          };

          broadcast(currentDocId, updateMessage, ws);
          console.log(`Document ${currentDocId} updated and broadcasted`);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      if (currentDocId) {
        leaveRoom(currentDocId, ws);
        console.log(`Client disconnected from doc ${currentDocId}`);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  console.log("WebSocket server initialized");
}
