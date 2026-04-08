"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { applyOperationToContent, deriveOperations, transform, type Operation } from "./collabOperations";
import { generateId, type ClientMessage, type Cursor, type ServerMessage } from "./socketProtocol";
import { resolveWebSocketUrl } from "@/lib/runtimeUrls";

function transformPosition(position: number, operation: Operation): number {
  if (operation.type === "insert") {
    const insertLength = operation.value?.length ?? 0;
    return position >= operation.position ? position + insertLength : position;
  }

  const deleteLength = Math.max(0, operation.length ?? 0);
  const deleteEnd = operation.position + deleteLength;

  if (position > deleteEnd) {
    return position - deleteLength;
  }

  if (position >= operation.position) {
    return operation.position;
  }

  return position;
}

function transformCursor(cursor: Cursor, operation: Operation): Cursor {
  const nextCursor: Cursor = {
    ...cursor,
    position: transformPosition(cursor.position, operation),
  };

  if (typeof cursor.selectionEnd === "number") {
    nextCursor.selectionEnd = transformPosition(cursor.selectionEnd, operation);
  }

  return nextCursor;
}

export function useWebSocket(docId: string) {
  const [content, setContent] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [remoteCursors, setRemoteCursors] = useState<Cursor[]>([]);
  const [localCursor, setLocalCursor] = useState<Cursor | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const contentRef = useRef<string>("");
  const versionRef = useRef<number>(0);
  const pendingOperationsRef = useRef<Operation[]>([]);
  const clientIdRef = useRef<string>("");
  const remoteCursorsRef = useRef<Map<string, Cursor>>(new Map());
  const lastCursorSignatureRef = useRef<string>("");
  const localCursorRef = useRef<Cursor | null>(null);

  const syncRemoteCursors = useCallback(() => {
    setRemoteCursors(Array.from(remoteCursorsRef.current.values()));
  }, []);

  const updateLocalCursor = useCallback((position: number, selectionEnd?: number) => {
    const nextSelectionEnd = typeof selectionEnd === "number" && selectionEnd !== position ? selectionEnd : undefined;
    const nextCursor: Cursor = {
      userId: clientIdRef.current,
      position,
      selectionEnd: nextSelectionEnd,
    };

    localCursorRef.current = nextCursor;
    setLocalCursor(nextCursor);
  }, []);

  const updateRemoteCursorsFromOperation = useCallback((operation: Operation) => {
    const nextRemoteCursors = new Map<string, Cursor>();

    remoteCursorsRef.current.forEach((cursor) => {
      nextRemoteCursors.set(cursor.userId, transformCursor(cursor, operation));
    });

    remoteCursorsRef.current = nextRemoteCursors;
    syncRemoteCursors();
  }, [syncRemoteCursors]);

  // Establish Socket connection
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = generateId("client");
    }

    lastCursorSignatureRef.current = "";
    remoteCursorsRef.current = new Map();
    syncRemoteCursors();

    const wsUrl = resolveWebSocketUrl();

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (wsRef.current !== ws) {
        return;
      }

      setIsConnected(true);

      // Join the document
      const joinMessage: ClientMessage = {
        type: "join",
        docId,
        clientId: clientIdRef.current,
      };
      ws.send(JSON.stringify(joinMessage));
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) {
        return;
      }

      let parsedMessage: ServerMessage;

      try {
        parsedMessage = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      try {
        if (parsedMessage.type === "init") {
          pendingOperationsRef.current = [];
          contentRef.current = parsedMessage.content;
          versionRef.current = parsedMessage.version;
          remoteCursorsRef.current = new Map();
          syncRemoteCursors();
          setContent(contentRef.current);
          return;
        }

        if (parsedMessage.type === "cursor") {
          const cursor = parsedMessage.cursor;

          if (cursor.userId === clientIdRef.current) {
            return;
          }

          remoteCursorsRef.current.set(cursor.userId, cursor);
          syncRemoteCursors();
          return;
        }

        if (parsedMessage.type === "cursor-remove") {
          remoteCursorsRef.current.delete(parsedMessage.userId);
          syncRemoteCursors();
          return;
        }

        if (parsedMessage.type !== "operation") {
          return;
        }

        const incomingOperation = parsedMessage.operation;

        const ownOperationIndex = pendingOperationsRef.current.findIndex(
          (operation) => operation.opId === incomingOperation.opId
        );

        if (ownOperationIndex !== -1) {
          // Own operation echoed back from server
          pendingOperationsRef.current.splice(ownOperationIndex, 1);
          versionRef.current = incomingOperation.version;
          return;
        }

        // Remote operation from another client - need to transform against pending
        let transformedIncoming = { ...incomingOperation };
        const updatedPending: Operation[] = [];

        for (const pendingOp of pendingOperationsRef.current) {
          const pendingTransformed = transform(pendingOp, transformedIncoming);
          transformedIncoming = transform(transformedIncoming, pendingOp);
          updatedPending.push(pendingTransformed);
        }

        pendingOperationsRef.current = updatedPending;
        contentRef.current = applyOperationToContent(contentRef.current, transformedIncoming);
        versionRef.current = incomingOperation.version;
        if (localCursorRef.current) {
          const transformedLocalCursor = transformCursor(localCursorRef.current, transformedIncoming);
          localCursorRef.current = transformedLocalCursor;
          setLocalCursor(transformedLocalCursor);
        }
        updateRemoteCursorsFromOperation(transformedIncoming);
        setContent(contentRef.current);
        return;
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) {
        return;
      }

      wsRef.current = null;
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      if (wsRef.current !== ws) {
        return;
      }

      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }

      ws.close();
    };
  }, [docId, syncRemoteCursors, updateRemoteCursorsFromOperation]);

  // Send updates to server
  const sendUpdate = useCallback((newContent: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const previousContent = contentRef.current;
      const operations = deriveOperations(
        previousContent,
        newContent,
        clientIdRef.current,
        versionRef.current + pendingOperationsRef.current.length
      );

      if (operations.length === 0) {
        return;
      }

      operations.forEach((operation) => {
        const operationWithId: Operation = {
          ...operation,
          opId: generateId("op"),
        };

        pendingOperationsRef.current.push(operationWithId);
        updateRemoteCursorsFromOperation(operationWithId);
        wsRef.current?.send(
          JSON.stringify({
            type: "operation",
            operation: operationWithId,
          })
        );
      });

      contentRef.current = newContent;
      setContent(newContent);
    }
  }, [updateRemoteCursorsFromOperation]);

  const sendCursor = useCallback((position: number, selectionEnd?: number) => {
    updateLocalCursor(position, selectionEnd);

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const normalizedSelectionEnd = typeof selectionEnd === "number" && selectionEnd !== position
      ? selectionEnd
      : undefined;
    const signature = `${position}:${normalizedSelectionEnd ?? ""}`;

    if (lastCursorSignatureRef.current === signature) {
      return;
    }

    lastCursorSignatureRef.current = signature;

    const cursorMessage: ClientMessage = {
      type: "cursor",
      cursor: {
        userId: clientIdRef.current,
        position,
        selectionEnd: normalizedSelectionEnd,
      },
    };

    wsRef.current.send(JSON.stringify(cursorMessage));
  }, [updateLocalCursor]);

  return {
    content,
    isConnected,
    sendUpdate,
    sendCursor,
    localCursor,
    remoteCursors,
  };
}
