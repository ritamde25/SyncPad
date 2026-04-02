/**
 * WebSocket message types for collaborative editor
 */

export interface JoinMessage {
  type: "join";
  docId: string;
}

export interface UpdateMessage {
  type: "update";
  content: string;
}

export interface InitMessage {
  type: "init";
  content: string;
}

export interface BroadcastUpdateMessage {
  type: "update";
  content: string;
}

export type ClientMessage = JoinMessage | UpdateMessage;
export type ServerMessage = InitMessage | BroadcastUpdateMessage;
