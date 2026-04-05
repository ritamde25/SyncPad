"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  applyOperationToContent,
  deriveOperations,
  transform,
  type Operation,
} from "./collabOperations";
import {
  generateClientId,
  resolveWebSocketUrl,
  type WebSocketMessage,
} from "./socketProtocol";

export function useWebSocket(docId: string) {
  const [content, setContent] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const contentRef = useRef<string>("");
  const versionRef = useRef<number>(0);
  const pendingOperationsRef = useRef<Operation[]>([]);
  const clientIdRef = useRef<string>("");

  // Establish WebSocket connection
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = generateClientId();
    }

    const wsUrl = resolveWebSocketUrl();

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
