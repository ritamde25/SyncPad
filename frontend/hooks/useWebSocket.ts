"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface WebSocketMessage {
  type: "join" | "update" | "init";
  content?: string;
  docId?: string;
}

export function useWebSocket(docId: string) {
  const [content, setContent] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

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
        }

        if (msg.type === "update") {
          console.log("Received remote update");
          setContent(msg.content || "");
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
      const updateMessage: WebSocketMessage = {
        type: "update",
        content: newContent,
      };
      wsRef.current.send(JSON.stringify(updateMessage));
    }
  }, []);

  return {
    content,
    setContent,
    isConnected,
    sendUpdate,
  };
}
