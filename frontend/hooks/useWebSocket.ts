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

export function useWebSocket(docId: string) {
  const [content, setContent] = useState<string>("");
  const [version, setVersion] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `client-${Math.random().toString(36).slice(2)}`
  );

  function applyOperationToContent(currentContent: string, operation: Operation) {
    const position = Math.max(0, Math.min(operation.position, currentContent.length));

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
    const baseVersion = version + operations.length;

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
        version: version + operations.length,
      });
    }

    return operations;
  }

  // Establish WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = "192.168.0.5:8080";
    const wsUrl = `${protocol}//${host}`;

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
          setContent(msg.content || "");
          setVersion(msg.version || 0);
        }

        if (msg.type === "operation" && msg.operation) {
          if (msg.operation.clientId === clientIdRef.current) {
            setVersion(msg.operation.version);
            return;
          }

          console.log("Received remote operation");
          setContent((currentContent) =>
            applyOperationToContent(currentContent, msg.operation as Operation)
          );
          setVersion(msg.operation.version);
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
      const previousContent = content;
      const operations = deriveOperations(previousContent, newContent);

      if (operations.length === 0) {
        return;
      }

      operations.forEach((operation) => {
        wsRef.current?.send(
          JSON.stringify({
            type: "operation",
            operation,
          })
        );
      });

      setVersion((currentVersion) => currentVersion + operations.length);
    }
  }, [content, version]);

  return {
    content,
    setContent,
    isConnected,
    sendUpdate,
  };
}
