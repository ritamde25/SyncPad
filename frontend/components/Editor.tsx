"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Cursor } from "@/hooks/socketProtocol";
import { toApiUrl } from "@/lib/runtimeUrls";

interface EditorProps {
  docId: string;
  title: string;
}

type RenderedCursor = Cursor & {
  left: number;
  top: number;
  height: number;
};

function createMirror(textarea: HTMLTextAreaElement): HTMLDivElement {
  const computedStyle = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.boxSizing = computedStyle.boxSizing;
  mirror.style.fontFamily = computedStyle.fontFamily;
  mirror.style.fontSize = computedStyle.fontSize;
  mirror.style.fontWeight = computedStyle.fontWeight;
  mirror.style.fontStyle = computedStyle.fontStyle;
  mirror.style.letterSpacing = computedStyle.letterSpacing;
  mirror.style.lineHeight = computedStyle.lineHeight;
  mirror.style.textTransform = computedStyle.textTransform;
  mirror.style.textAlign = computedStyle.textAlign;
  mirror.style.padding = computedStyle.padding;
  mirror.style.border = computedStyle.border;
  mirror.style.width = `${textarea.clientWidth}px`;

  return mirror;
}

function measureCursorPosition(
  textarea: HTMLTextAreaElement,
  value: string,
  position: number
): { left: number; top: number; height: number } {
  const mirror = createMirror(textarea);
  const safePosition = Math.max(0, Math.min(position, value.length));

  mirror.textContent = value.slice(0, safePosition);

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  marker.style.display = "inline-block";
  marker.style.width = "0";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || Number.parseFloat(computedStyle.fontSize) * 1.2;

  const left = markerRect.left - mirrorRect.left - textarea.scrollLeft;
  const top = markerRect.top - mirrorRect.top - textarea.scrollTop;

  mirror.remove();

  return {
    left,
    top,
    height: Number.isFinite(lineHeight) ? lineHeight : 20,
  };
}

function measureRemoteCursors(
  textarea: HTMLTextAreaElement,
  value: string,
  cursors: Cursor[]
): RenderedCursor[] {
  return cursors.map((cursor) => {
    const { left, top, height } = measureCursorPosition(textarea, value, cursor.position);

    return {
      ...cursor,
      left,
      top,
      height,
    };
  });
}

function colorFromClientId(clientId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < clientId.length; i += 1) {
    hash ^= clientId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hue = (hash >>> 0) % 360;
  const saturation = 72;
  const lightness = 48;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function Editor({ docId, title: initialTitle }: EditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [cursorLayoutTick, setCursorLayoutTick] = useState(0);
  const [renderedCursors, setRenderedCursors] = useState<RenderedCursor[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { content, isConnected, sendUpdate, sendCursor, localCursor, remoteCursors } = useWebSocket(docId);

  const reportCursor = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    sendCursor(textarea.selectionStart ?? 0, textarea.selectionEnd ?? undefined);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    sendUpdate(newContent);
    sendCursor(e.target.selectionStart ?? 0, e.target.selectionEnd ?? undefined);
  };

  const handleSaveTitle = async () => {
    const newTitle = draftTitle.trim() || "New Document";

    if (newTitle === title) return;

    const response = await fetch(toApiUrl(`/documents/${docId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    }).catch(() => null);

    if (!response?.ok) {
      setDraftTitle(title);
      return;
    }

    const doc = await response.json();
    setTitle(doc.title);
    setDraftTitle(doc.title);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === "Escape") {
      handleSaveTitle();
      (e.target as HTMLInputElement).blur();
    }
  };

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    setRenderedCursors(measureRemoteCursors(textarea, content, remoteCursors));
  }, [content, cursorLayoutTick, remoteCursors]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea || !localCursor || document.activeElement !== textarea) {
      return;
    }

    const selectionStart = Math.max(0, Math.min(localCursor.position, content.length));
    const selectionEnd = Math.max(0, Math.min(localCursor.selectionEnd ?? localCursor.position, content.length));

    if (textarea.selectionStart !== selectionStart || textarea.selectionEnd !== selectionEnd) {
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }
  }, [content, localCursor]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const handleScroll = () => {
      setCursorLayoutTick((value) => value + 1);
    };

    textarea.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      textarea.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-800/90 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="w-fit">
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleSaveTitle}
              className="text-2xl font-semibold text-zinc-900 dark:text-white bg-transparent px-2 py-1 rounded-lg border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700/70 focus:bg-white dark:focus:bg-zinc-700 focus:border-indigo-500 outline-none w-full"
              title="Rename document"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-full ${
                isConnected
                  ? "bg-green-100 dark:bg-green-900"
                  : "bg-red-100 dark:bg-red-900"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-green-600" : "bg-red-600"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  isConnected
                    ? "text-green-800 dark:text-green-200"
                    : "text-red-800 dark:text-red-200"
                }`}
              >
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto w-full px-4 sm:px-8 py-6">
          <div className="relative h-full">
            {renderedCursors.map((cursor) => {
              const cursorColor = colorFromClientId(cursor.userId);

              return (
                <div
                  key={cursor.userId}
                  className="absolute pointer-events-none z-20"
                  style={{
                    left: `${cursor.left}px`,
                    top: `${cursor.top}px`,
                    height: `${cursor.height}px`,
                  }}
                  aria-hidden="true"
                >
                  <div
                    className="remote-cursor-line h-full w-0.5"
                    style={{
                      backgroundColor: cursorColor,
                      boxShadow: `0 0 0 1px color-mix(in srgb, ${cursorColor} 25%, transparent)`,
                    }}
                  />
                </div>
              );
            })}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onSelect={reportCursor}
              onClick={reportCursor}
              onKeyUp={reportCursor}
              onMouseUp={reportCursor}
              onFocus={reportCursor}
              placeholder="Start writing..."
              className="relative z-10 h-full w-full p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none resize-none text-base sm:text-lg leading-8 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 shadow-sm focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-6 py-3">
        <div className="flex items-center justify-between gap-4 text-xs text-zinc-600 dark:text-zinc-400">
          <p>
            {words} words • {chars} characters
          </p>
          <p className="truncate">
            Share: <span className="font-mono text-zinc-900 dark:text-white">/doc?docId={docId}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
