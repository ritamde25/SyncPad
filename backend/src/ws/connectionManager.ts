import WebSocket from "ws";

const rooms = new Map<string, Map<WebSocket, number>>();    // Map<docId, Map<ws, clientVersion>>

export function joinRoom(docId: string, ws: WebSocket, version = 0): void {
  if (!rooms.has(docId)) {
    rooms.set(docId, new Map());
  }
  rooms.get(docId)!.set(ws, version);
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

export function setClientVersion(docId: string, ws: WebSocket, version: number): void {
  const room = rooms.get(docId);
  if (!room || !room.has(ws)) {
    return;
  }

  room.set(ws, version);
}

export function getClientVersion(docId: string, ws: WebSocket): number | undefined {
  return rooms.get(docId)?.get(ws);
}

export function getLowestActiveVersion(docId: string): number | null {
  const room = rooms.get(docId);
  if (!room || room.size === 0) {
    return null;
  }

  let lowestVersion: number | null = null;

  room.forEach((version) => {
    if (lowestVersion === null || version < lowestVersion) {
      lowestVersion = version;
    }
  });

  return lowestVersion;
}

export function broadcast(docId: string, message: any): void {
  const clients = rooms.get(docId);
  if (!clients) return;

  const messageStr = JSON.stringify(message);
  const version = typeof message?.operation?.version === "number"
    ? message.operation.version
    : typeof message?.version === "number"
      ? message.version
      : undefined;

  clients.forEach((clientVersion, client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (typeof version === "number") {
        clients.set(client, version);
      }

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
