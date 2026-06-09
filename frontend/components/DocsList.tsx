"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserManager, getInitial, getClientColor } from "@/hooks/useUserManager";
import { toApiUrl } from "@/lib/runtimeUrls";

interface Document {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export function DocsList() {
  const router = useRouter();
  const { user, updateUserName, mounted } = useUserManager();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const userId = user?.id || "";

    const fetchDocs = async () => {
      setLoading(true);

      try {
        const response = await fetch(toApiUrl(`/documents?userId=${encodeURIComponent(userId)}`));

        if (!response.ok) {
          setDocs([]);
          return;
        }

        const fetchedDocs = (await response.json()) as Document[];
        setDocs(Array.isArray(fetchedDocs) ? fetchedDocs : []);
      } catch {
        setDocs([]);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      void fetchDocs();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setNameInput(user.name);
    }
  }, [user]);

  const handleCreateDoc = async () => {
    const userId = user?.id || "";

    try {
      const response = await fetch(toApiUrl("/documents"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled",
          userId,
        }),
      });

      if (!response.ok) {
        return;
      }

      const doc = (await response.json()) as Document;
      setDocs((prevDocs) => [doc, ...prevDocs]);
      router.push(`/doc?docId=${doc._id}`);
    } catch {

    }
  };

  const handleOpenDoc = (docId: string) => {
    router.push(`/doc?docId=${docId}`);
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      updateUserName(nameInput.trim());
    } else {
      setNameInput(user?.name || "");
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setNameInput(user?.name || "");
      setIsEditingName(false);
    }
  };

  const handleDeleteDoc = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await fetch(toApiUrl(`/documents/${docId}`), {
        method: "DELETE",
      });

      if (!response.ok) {
        return;
      }

      setDocs((prevDocs) => prevDocs.filter((doc) => doc._id !== docId));
    } catch {

    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 dark:text-zinc-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-5 py-14">
        {/* Hero Section */}
        <div className="mb-14">
          <h1 className="text-7xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2.5">
            SyncPad
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400 mb-8">
            Real-time collaborative documents
          </p>
          
          <div className="flex items-center justify-between">
            <button
              onClick={handleCreateDoc}
              className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              New Document
            </button>
            
            <div 
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: getClientColor(user.id) }}
              onClick={() => setIsEditingName(true)}
              title={user.name}
            >
              {getInitial(user.name)}
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="mb-5">
          <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-4">
            Your Documents
          </h2>
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 dark:text-zinc-600">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
              No documents yet
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-5">
              Create your first document to get started
            </p>
            <button
              onClick={handleCreateDoc}
              className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Create Document
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc, index) => {
              const isMostRecent = index === 0;
              return (
                <div
                  key={doc._id}
                  onClick={() => handleOpenDoc(doc._id)}
                  className="group relative bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 cursor-pointer transition-all hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600 dark:text-zinc-400">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-base font-medium text-zinc-900 dark:text-white truncate">
                            {doc.title}
                          </h3>
                          {isMostRecent && (
                            <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium rounded-full">
                              Recent
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400">
                          <span>{formatDate(doc.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleDeleteDoc(doc._id, e)}
                        className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </button>
                      
                      <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                          <path d="M9 18l6-6-6-6"></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Name Edit Modal */}
      {isEditingName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-xs overflow-hidden">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                Edit your name
              </h3>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveName}
                autoFocus
                className="w-full px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-500 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none text-sm"
                placeholder="Your name"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}