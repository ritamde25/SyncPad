import type { Operation } from "./collabOperations";
import { resolveWebSocketUrl } from "@/lib/runtimeUrls";

export interface WebSocketMessage {
  type: "join" | "init" | "operation";
  content?: string;
  docId?: string;
  version?: number;
  operation?: Operation;
  clientId?: string;
}

export function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export { resolveWebSocketUrl };