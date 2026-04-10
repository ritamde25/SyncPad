/**
 * WebSocket message types for collaborative editor
 */

import type { Operation } from "./operation.js";

export interface Cursor {
  userId: string;
  position: number;
  selectionEnd?: number;
}

export interface JoinMessage {
  type: "join";
  docId: string;
  clientId: string;
}

export interface OperationMessage {
  type: "operation";
  operation: Operation;
}

export interface CursorMessage {
  type: "cursor";
  cursor: Cursor;
}

export interface ResyncMessage {
  type: "resync";
  docId: string;
}

export interface InitMessage {
  type: "init";
  content: string;
  version: number;
}

export interface BroadcastOperationMessage {
  type: "operation";
  operation: Operation;
}

export interface BroadcastCursorMessage {
  type: "cursor";
  cursor: Cursor;
}

export interface CursorRemoveMessage {
  type: "cursor-remove";
  userId: string;
}

export type ClientMessage = JoinMessage | OperationMessage | CursorMessage | ResyncMessage;
export type ServerMessage = InitMessage | BroadcastOperationMessage | BroadcastCursorMessage | CursorRemoveMessage;

