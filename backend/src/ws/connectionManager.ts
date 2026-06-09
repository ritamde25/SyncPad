import WebSocket from "ws";

const rooms = new Map<string, Set<WebSocket>>();

interface CursorInfo {
  userId: string;
  userName?: string;
  position: number;
  selectionEnd?: number;
}

const roomCursors = new Map<string, Map<WebSocket, CursorInfo>>();

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

  // Remove cursor info
  const cursors = roomCursors.get(docId);
  if (cursors) {
    cursors.delete(ws);
    if (cursors.size === 0) {
      roomCursors.delete(docId);
    }
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

export function updateCursor(docId: string, ws: WebSocket, cursorInfo: CursorInfo): void {
  if (!roomCursors.has(docId)) {
    roomCursors.set(docId, new Map());
  }

  roomCursors.get(docId)!.set(ws, cursorInfo);
}

export function getActiveCursors(docId: string): CursorInfo[] {
  const cursors = roomCursors.get(docId);
  if (!cursors) return [];

  return Array.from(cursors.values());
}
