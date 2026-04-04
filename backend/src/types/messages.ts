/**
 * WebSocket message types for collaborative editor
 */

import type { Operation } from "./operation.js";

export interface JoinMessage {
  type: "join";
  docId: string;
}

export interface OperationMessage {
  type: "operation";
  operation: Operation;
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

export type ClientMessage = JoinMessage | OperationMessage;
export type ServerMessage = InitMessage | BroadcastOperationMessage;

