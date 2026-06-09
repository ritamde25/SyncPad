import type { Operation } from "./collabOperations";

export interface Cursor {
  userId: string;
  userName?: string;
  position: number;
  selectionEnd?: number;
}

export interface JoinMessage {
  type: "join";
  docId: string;
  clientId: string;
  userName?: string;
}

export interface InitMessage {
  type: "init";
  content: string;
  version: number;
}

export interface OperationMessage {
  type: "operation";
  operation: Operation;
}

export interface ResyncMessage {
  type: "resync";
  docId: string;
}

export interface CursorMessage {
  type: "cursor";
  cursor: Cursor;
}

export interface CursorRemoveMessage {
  type: "cursor-remove";
  userId: string;
}

export interface ActiveUsersMessage {
  type: "active-users";
  cursors: Cursor[];
}

export type ClientMessage = JoinMessage | OperationMessage | CursorMessage | ResyncMessage;
export type ServerMessage = InitMessage | OperationMessage | CursorMessage | CursorRemoveMessage | ActiveUsersMessage;

export function generateId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}
