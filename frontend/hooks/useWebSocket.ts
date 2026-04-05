"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface WebSocketMessage {
  type: "join" | "init" | "operation";
  content?: string;
  docId?: string;
  version?: number;
  operation?: Operation;
  clientId?: string;
}

interface Operation {
  type: "insert" | "delete";
  position: number;
  value?: string;
  length?: number;
  clientId: string;
  version: number;
}

function clampPosition(position: number, contentLength: number): number {
  return Math.max(0, Math.min(position, contentLength));
}

function getInsertLength(op: Operation): number {
  return op.value?.length ?? 0;
}

function getDeleteLength(op: Operation): number {
  return Math.max(0, op.length ?? 0);
}

function cloneOperation(op: Operation): Operation {
  return {
    ...op,
    value: op.value,
  };
}

function transform(incoming: Operation, existing: Operation): Operation {
  const transformed = cloneOperation(incoming);

  if (existing.type === "insert") {
    const existingLength = getInsertLength(existing);

    if (transformed.type === "insert") {
      if (transformed.position > existing.position) {
        transformed.position += existingLength;
      } else if (
        transformed.position === existing.position &&
        transformed.clientId > existing.clientId
      ) {
        transformed.position += existingLength;
      }
      return transformed;
    }

    if (transformed.position >= existing.position) {
      transformed.position += existingLength;
    }

    return transformed;
  }

  const existingLength = getDeleteLength(existing);

  if (transformed.type === "insert") {
    if (transformed.position > existing.position + existingLength) {
      transformed.position -= existingLength;
    } else if (transformed.position >= existing.position) {
      transformed.position = existing.position;
    }

    return transformed;
  }

  const incomingStart = transformed.position;
  const incomingLength = getDeleteLength(transformed);
  const incomingEnd = incomingStart + incomingLength;
  const existingStart = existing.position;
  const existingEnd = existing.position + existingLength;

  if (incomingEnd <= existingStart) {
    return transformed;
  }

  if (incomingStart >= existingEnd) {
    transformed.position -= existingLength;
    return transformed;
  }

  if (incomingStart < existingStart) {
    const overlap = incomingEnd - existingStart;
    transformed.length = Math.max(0, incomingLength - overlap);
    return transformed;
  }

  const overlapInsideDelete = existingEnd - incomingStart;
  transformed.position = existingStart;
  transformed.length = Math.max(0, incomingLength - overlapInsideDelete);

  return transformed;
}

function applyOperationToContent(currentContent: string, operation: Operation): string {
  const position = clampPosition(operation.position, currentContent.length);

  if (operation.type === "insert") {
    return (
      currentContent.slice(0, position) +
      (operation.value || "") +
      currentContent.slice(position)
    );
  }

  const length = Math.max(0, operation.length || 0);
  return currentContent.slice(0, position) + currentContent.slice(position + length);
}

function generateClientId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `client-${Date.now().toString(36)}`;
}

export function useWebSocket(docId: string) {
  const [content, setContent] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const contentRef = useRef<string>("");
  const versionRef = useRef<number>(0);
  const pendingOperationsRef = useRef<Operation[]>([]);
  const clientIdRef = useRef<string>("");

  function deriveOperations(previousContent: string, nextContent: string): Operation[] {
    if (previousContent === nextContent) {
      return [];
    }

    let start = 0;
    while (
      start < previousContent.length &&
      start < nextContent.length &&
      previousContent[start] === nextContent[start]
    ) {
      start += 1;
    }

    let previousEnd = previousContent.length - 1;
    let nextEnd = nextContent.length - 1;

    while (
      previousEnd >= start &&
      nextEnd >= start &&
      previousContent[previousEnd] === nextContent[nextEnd]
    ) {
      previousEnd -= 1;
      nextEnd -= 1;
    }

    const removedText = previousContent.slice(start, previousEnd + 1);
    const insertedText = nextContent.slice(start, nextEnd + 1);

    const operations: Operation[] = [];
    const baseVersion = versionRef.current + pendingOperationsRef.current.length;

    if (removedText.length > 0) {
      operations.push({
        type: "delete",
        position: start,
        length: removedText.length,
        clientId: clientIdRef.current,
        version: baseVersion,
      });
    }

    if (insertedText.length > 0) {
      operations.push({
        type: "insert",
        position: start,
        value: insertedText,
        clientId: clientIdRef.current,
        version: baseVersion + operations.length,
      });
    }

    return operations;
  }

  // Establish WebSocket connection
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = generateClientId();
    }

    const SocketUrl =
      process.env.NODE_ENV === "production"
        ? window.location.origin
        : "http://localhost:8080";
    const resolvedUrl = SocketUrl;
    const parsedUrl = new URL(resolvedUrl);
    const wsProtocol = parsedUrl.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${parsedUrl.host}`;

    console.log(`Connecting to WebSocket: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);

      // Join the document
      const joinMessage: WebSocketMessage = {
        type: "join",
        docId,
        clientId: clientIdRef.current,
      };
      ws.send(JSON.stringify(joinMessage));
      console.log(`Joined document: ${docId}`);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);

        if (msg.type === "init") {
          console.log("Received initial document content");
          const nextContent = msg.content || "";
          const nextVersion = msg.version || 0;

          pendingOperationsRef.current = [];
          contentRef.current = nextContent;
          versionRef.current = nextVersion;
          setContent(nextContent);
        }

        if (msg.type === "operation" && msg.operation) {
          if (msg.operation.clientId === clientIdRef.current) {
            pendingOperationsRef.current.shift();
            versionRef.current = msg.operation.version;
            return;
          }

          console.log("Received remote operation");
          let transformedIncoming = { ...(msg.operation as Operation) };
          const nextPending: Operation[] = [];

          for (const pendingOp of pendingOperationsRef.current) {
            const pendingTransformed = transform(pendingOp, transformedIncoming);
            transformedIncoming = transform(transformedIncoming, pendingOp);
            nextPending.push(pendingTransformed);
          }

          pendingOperationsRef.current = nextPending;
          const nextContent = applyOperationToContent(contentRef.current, transformedIncoming);
          contentRef.current = nextContent;
          versionRef.current = msg.operation.version;

          setContent(nextContent);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [docId]);

  // Send updates to server
  const sendUpdate = useCallback((newContent: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const previousContent = contentRef.current;
      const operations = deriveOperations(previousContent, newContent);

      if (operations.length === 0) {
        return;
      }

      operations.forEach((operation) => {
        pendingOperationsRef.current.push(operation);
        wsRef.current?.send(
          JSON.stringify({
            type: "operation",
            operation,
          })
        );
      });

      contentRef.current = newContent;
      setContent(newContent);
    }
  }, []);

  return {
    content,
    isConnected,
    sendUpdate,
  };
}
