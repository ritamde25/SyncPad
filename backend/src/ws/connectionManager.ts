import WebSocket from "ws";

const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(docId: string, ws: WebSocket): void {
  if (!rooms.has(docId)) {
    rooms.set(docId, new Set());
  }

  rooms.get(docId)!.add(ws);
}

export function leaveRoom(docId: string, ws: WebSocket): void {
  const room = rooms.get(docId);
  if (!room) return;

  room.delete(ws);

  // Clean up empty rooms
  if (room.size === 0) {
    rooms.delete(docId);
  }
}

export function broadcast(docId: string, message: any, excludeWs?: WebSocket | null): void {
  const clients = rooms.get(docId);
  if (!clients) return;

  const messageStr = JSON.stringify(message);

  clients.forEach((client) => {
    if (excludeWs && client === excludeWs) {
      return;
    }

    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}
