"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { useSearchParams } from "next/navigation";

export function Editor() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId") || "default-doc";

  const { content, isConnected, sendUpdate } =
    useWebSocket(docId);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    sendUpdate(newContent);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              SyncPad
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Document: <span className="font-mono">{docId}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Start typing..."
          className="flex-1 w-full px-6 py-4 border-none outline-none resize-none text-base leading-relaxed bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600"
        />
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-6 py-3">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {content.length} characters • Share this link to collaborate:{" "}
          <span className="font-mono text-zinc-900 dark:text-white">
            ?docId={docId}
          </span>
        </p>
      </div>
    </div>
  );
}
