"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { useState } from "react";
import { toApiUrl } from "@/lib/runtimeUrls";

interface EditorProps {
  docId: string;
  title: string;
}

export function Editor({ docId, title: initialTitle }: EditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  
  const { content, isConnected, sendUpdate } = useWebSocket(docId);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    sendUpdate(newContent);
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
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Start writing..."
          className="h-full w-full p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none resize-none text-base sm:text-lg leading-8 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 shadow-sm focus:ring-2 focus:ring-indigo-500/40"
        />
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
