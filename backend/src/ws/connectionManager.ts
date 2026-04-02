import WebSocket from "ws";

const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(docId: string, ws: WebSocket): void {
  if (!rooms.has(docId)) {
    rooms.set(docId, new Set());
  }
  rooms.get(docId)!.add(ws);
  console.log(`Client joined room ${docId}. Room size: ${rooms.get(docId)!.size}`);
}

export function leaveRoom(docId: string, ws: WebSocket): void {
  const room = rooms.get(docId);
  if (!room) return;

  room.delete(ws);
  console.log(`Client left room ${docId}. Room size: ${room.size}`);

  // Clean up empty rooms
  if (room.size === 0) {
    rooms.delete(docId);
  }
}

export function broadcast(
  docId: string,
  message: any,
  sender?: WebSocket
): void {
  const clients = rooms.get(docId);
  if (!clients) return;

  const messageStr = JSON.stringify(message);

  clients.forEach((client) => {
    // Don't send back to sender, only send to open connections
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

export function getRoomSize(docId: string): number {
  return rooms.get(docId)?.size || 0;
}

export function getAllRooms(): Map<string, number> {
  const result = new Map<string, number>();
  rooms.forEach((clients, docId) => {
    result.set(docId, clients.size);
  });
  return result;
}
