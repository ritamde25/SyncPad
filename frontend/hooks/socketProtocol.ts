import type { Operation } from "./collabOperations";

export interface WebSocketMessage {
  type: "join" | "init" | "operation";
  content?: string;
  docId?: string;
  version?: number;
  operation?: Operation;
  clientId?: string;
}

export function generateClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `client-${Date.now().toString(36)}`;
}

export function resolveWebSocketUrl(): string {
  const origin =
    process.env.NODE_ENV === "production"
      ? window.location.origin
      : "http://localhost:8080";

  const parsedUrl = new URL(origin);
  const wsProtocol = parsedUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${parsedUrl.host}`;
}