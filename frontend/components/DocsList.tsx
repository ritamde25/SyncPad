"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateId } from "@/hooks/socketProtocol";
import { toApiUrl } from "@/lib/runtimeUrls";

interface Document {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

function getOrCreateUserId(): string {
  const existingUserId = localStorage.getItem("userId");

  if (existingUserId) {
    return existingUserId;
  }

  const nextUserId = generateId("user");
  localStorage.setItem("userId", nextUserId);
  return nextUserId;
}

export function DocsList() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getOrCreateUserId();

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

    void fetchDocs();
  }, []);

  const handleCreateDoc = async () => {
    const userId = getOrCreateUserId();

    try {
      const response = await fetch(toApiUrl("/documents"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Document",
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
      // Keep UX simple for MVP: failed create silently keeps the current list.
    }
  };

  const handleOpenDoc = (docId: string) => {
    router.push(`/doc?docId=${docId}`);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-semibold text-zinc-900 dark:text-white mb-2">SyncPad</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Real-time collaborative Notebook</p>
        </div>

        {/* Create Button */}
        <div className="mb-8">
          <button
            onClick={handleCreateDoc}
            className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 cursor-pointer rounded-lg font-medium hover:opacity-90 transition"
          >
            + New Document
          </button>
        </div>

        {/* Documents List */}
        <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">Loading documents...</div>
          ) : docs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
              <p className="mb-2">No documents yet</p>
              <p className="text-sm">Create your first document to get started</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {docs.map((doc) => (
                <li
                  key={doc._id}
                  onClick={() => handleOpenDoc(doc._id)}
                  className="p-4 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 cursor-pointer transition"
                >
                  <h2 className="text-lg font-medium text-zinc-900 dark:text-white">{doc.title}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Last edited: {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
