"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { applyOperationToContent, deriveOperations, transform, type Operation } from "./collabOperations";
import { generateId, resolveWebSocketUrl, type WebSocketMessage } from "./socketProtocol";

export function useWebSocket(docId: string) {
  const [content, setContent] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const contentRef = useRef<string>("");
  const versionRef = useRef<number>(0);
  const pendingOperationsRef = useRef<Operation[]>([]);
  const clientIdRef = useRef<string>("");

  // Establish Socket connection
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current = generateId("client");
    }

    const wsUrl = resolveWebSocketUrl();

    console.log(`Connecting to WebSocket: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (wsRef.current !== ws) {
        return;
      }

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
      if (wsRef.current !== ws) {
        return;
      }

      try {
        const msg: WebSocketMessage = JSON.parse(event.data);

        if (msg.type === "init") {
          pendingOperationsRef.current = [];
          contentRef.current = msg.content || "";
          versionRef.current = msg.version || 0;
          setContent(contentRef.current);
          return;
        }

        if (msg.type === "operation" && msg.operation) {
          const incomingOperation = msg.operation as Operation;

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
          versionRef.current = msg.operation.version;
          setContent(contentRef.current);
          return;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) {
        return;
      }

      wsRef.current = null;
      console.log("WebSocket disconnected");
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
        const operationWithId: Operation = {
          ...operation,
          opId: generateId("op"),
        };

        pendingOperationsRef.current.push(operationWithId);
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
  }, []);

  return {
    content,
    isConnected,
    sendUpdate,
  };
}
