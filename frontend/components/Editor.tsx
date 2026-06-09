"use client";

import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useUserManager, getInitial, getClientDisplayName, getClientColor } from "@/hooks/useUserManager";
import type { Cursor } from "@/hooks/socketProtocol";
import { toApiUrl } from "@/lib/runtimeUrls";

interface EditorProps {
  docId: string;
  title: string;
}

function getDisplayName(cursor: Cursor, fallbackGetDisplayName: (userId: string) => string): string {
  return cursor.userName || fallbackGetDisplayName(cursor.userId);
}

function renderContentWithCursors(
  content: string,
  cursors: Cursor[],
  getClientColor: (id: string) => string,
  getClientDisplayName: (id: string) => string
) {
  const sortedCursors = [...cursors].sort((a, b) => a.position - b.position);
  const elements: React.ReactNode[] = [];
  let lastPos = 0;

  sortedCursors.forEach((cursor) => {
    const pos = Math.max(0, Math.min(cursor.position, content.length));
    
    if (pos > lastPos) {
      elements.push(
        <span key={`text-${lastPos}-${pos}`}>
          {content.substring(lastPos, pos)}
        </span>
      );
      lastPos = pos;
    }

    const color = getClientColor(cursor.userId);
    const displayName = getDisplayName(cursor, getClientDisplayName);

    elements.push(
      <span
        key={`cursor-${cursor.userId}`}
        className="relative inline-block w-0 h-0 z-20 pointer-events-none"
      >
        <div
          className="absolute w-0.5"
          style={{ backgroundColor: color, height: '1.4em', top: '-1.1em' }}
        />
        <div
          className="absolute left-0 px-1.5 py-0.5 rounded text-[10px] text-white font-medium whitespace-nowrap"
          style={{ backgroundColor: color, top: '-2.5em' }}
        >
          {displayName}
        </div>
      </span>
    );
  });

  if (lastPos < content.length) {
    elements.push(
      <span key={`text-${lastPos}-end`}>
        {content.substring(lastPos)}
      </span>
    );
  }

  if (content.endsWith('\n') || content.length === 0) {
    elements.push(<span key="text-end-br">{"\u200B"}</span>);
  }

  return elements;
}

export function Editor({ docId, title: initialTitle }: EditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [draftUserName, setDraftUserName] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  
  const { user, mounted, updateUserName } = useUserManager();

  const { content, isConnected, sendUpdate, sendCursor, localCursor, remoteCursors } = useWebSocket(docId, user?.name);

  const reportCursor = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    sendCursor(textarea.selectionStart ?? 0, textarea.selectionEnd ?? undefined);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    sendUpdate(newContent);
    sendCursor(e.target.selectionStart ?? 0, e.target.selectionEnd ?? undefined);
  };

  const handleSaveTitle = async () => {
    const newTitle = draftTitle.trim() || "Untitled";
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

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/doc?docId=${docId}`;
    try {
      await navigator.clipboard.writeText(link);
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setShowShareTooltip(true);
        setTimeout(() => setShowShareTooltip(false), 2000);
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const handleNameClick = () => {
    setDraftUserName(user?.name || "");
    setShowNameDialog(true);
  };

  const handleNameSave = () => {
    const newName = draftUserName.trim();
    if (newName) {
      updateUserName(newName);
    }
    setShowNameDialog(false);
  };

  const handleNameCancel = () => {
    setShowNameDialog(false);
  };

  // Stats
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const lines = content.split("\n").length;
  const paragraphs = content.trim() ? content.split(/\n\s*\n/).filter(p => p.trim()).length : 0;
  const readingTime = Math.ceil(words / 200);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop;
      overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !localCursor || document.activeElement !== textarea) return;

    const selectionStart = Math.max(0, Math.min(localCursor.position, content.length));
    const selectionEnd = Math.max(0, Math.min(localCursor.selectionEnd ?? localCursor.position, content.length));

    if (textarea.selectionStart !== selectionStart || textarea.selectionEnd !== selectionEnd) {
      textarea.setSelectionRange(selectionStart, selectionEnd);
    }
  }, [content, localCursor]);

  useEffect(() => {
    if (isConnected && textareaRef.current) {
      sendCursor(0, undefined);
    }
  }, [isConnected, sendCursor]);

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
          <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Loading editor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-white dark:bg-zinc-950 flex flex-col font-sans">
      {/* Header */}
      <header className="flex-none h-14 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="group flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
            title="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:-translate-x-0.5 transition-transform">
              <path d="M19 12H5"></path>
              <path d="M12 19l-7-7 7-7"></path>
            </svg>
          </button>
          
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />
          
          <div className="flex-1 max-w-md relative flex items-center">
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleSaveTitle}
              className="w-full text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-700 outline-none placeholder-zinc-400 dark:placeholder-zinc-600 rounded px-2 py-1 transition-colors"
              placeholder="Untitled Document"
              spellCheck={false}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Active Status */}
          <div className="hidden md:flex items-center gap-2 text-xs mr-2">
            <div className="relative flex h-2 w-2">
              {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}></span>
            </div>
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">{isConnected ? "Connected" : "Reconnecting..."}</span>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block mx-1" />

          {remoteCursors.length > 0 && (
            <div className="flex -space-x-2">
              {remoteCursors.slice(0, 3).map((cursor) => {
                const displayName = getDisplayName(cursor, getClientDisplayName);
                const color = getClientColor(cursor.userId);
                return (
                  <div
                    key={cursor.userId}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold ring-2 ring-white dark:ring-zinc-950 shadow-sm transition-transform hover:-translate-y-0.5 hover:z-10 z-0"
                    style={{ backgroundColor: color }}
                    title={displayName}
                  >
                    {getInitial(displayName)}
                  </div>
                );
              })}
              {remoteCursors.length > 3 && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] font-semibold ring-2 ring-white dark:ring-zinc-950 shadow-sm">
                  +{remoteCursors.length - 3}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleNameClick}
            className="flex flex-shrink-0 items-center justify-center w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-950 text-white text-[11px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: getClientColor(user.id) }}
            title={`You: ${user.name}\nClick to change name`}
          >
            {getInitial(user.name)}
          </button>
          
          <div className="relative">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                <polyline points="16 6 12 2 8 6"></polyline>
                <line x1="12" y1="2" x2="12" y2="15"></line>
              </svg>
              <span className="hidden sm:inline">Share</span>
            </button>
            
            {showShareTooltip && (
              <div className="absolute top-[calc(100%+0.5rem)] right-0 px-2.5 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-medium rounded-md shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-top-1">
                Link copied to clipboard!
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 overflow-hidden relative flex justify-center bg-white dark:bg-zinc-950">
          <div className="w-full max-w-[800px] h-full relative">
            <div
              ref={overlayRef}
              className="absolute inset-y-0 left-0 right-0 z-0 pointer-events-none px-8 sm:px-12 py-16 text-base sm:text-lg whitespace-pre-wrap break-words overflow-auto text-transparent"
              style={{
                fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
                lineHeight: '1.7',
              }}
              aria-hidden="true"
            >
              {renderContentWithCursors(content, remoteCursors, getClientColor, getClientDisplayName)}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onScroll={handleScroll}
              onSelect={reportCursor}
              onClick={reportCursor}
              onKeyUp={reportCursor}
              onMouseUp={reportCursor}
              onFocus={reportCursor}
              placeholder="Start writing..."
              className="absolute inset-y-0 left-0 right-0 z-10 w-full h-full px-8 sm:px-12 py-16 text-base sm:text-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-300 dark:placeholder-zinc-700 bg-transparent border-0 outline-none resize-none whitespace-pre-wrap break-words"
              style={{
                fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
                lineHeight: '1.7',
              }}
            />
          </div>
        </div>

        {/* Right Sidebar with Stats */}
        <div className="w-64 flex-shrink-0 border-l border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/30 dark:bg-zinc-900/10 hidden lg:flex flex-col">
          <div className="p-6 space-y-8 overflow-y-auto w-full">
            {/* Document Info */}
            <div>
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Document Info
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Words</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{words}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Characters</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{chars}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Lines</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{lines}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Paragraphs</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{paragraphs}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-zinc-500 dark:text-zinc-400">Reading time</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{readingTime} min</span>
                </div>
              </div>
            </div>

            {/* Active Clients */}
            {remoteCursors.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Active Writers
                </h3>
                <div className="space-y-3">
                  {remoteCursors.map((cursor) => {
                    const displayName = getDisplayName(cursor, getClientDisplayName);
                    const color = getClientColor(cursor.userId);
                    return (
                      <div key={cursor.userId} className="flex items-center gap-2.5">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                          style={{ backgroundColor: color }}
                        >
                          {getInitial(displayName)}
                        </div>
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Name Change Dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-1">
              What's your name?
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
              This will be visible to other people editing this document.
            </p>
            <input
              type="text"
              value={draftUserName}
              onChange={(e) => setDraftUserName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSave();
                else if (e.key === "Escape") handleNameCancel();
              }}
              className="w-full px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all mb-6 placeholder-zinc-400"
              placeholder="e.g. Jane Doe"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={handleNameCancel}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNameSave}
                className="px-4 py-2 text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:opacity-90 shadow-sm transition-opacity"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}