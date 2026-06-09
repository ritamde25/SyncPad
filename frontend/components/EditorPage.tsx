"use client";

import { useState, useEffect } from "react";
import { Editor } from "@/components/Editor";
import { toApiUrl } from "@/lib/runtimeUrls";

interface DocumentInfo {
  _id: string;
  title: string;
}

interface EditorPageProps {
  docId: string;
}

export function EditorPage({ docId }: EditorPageProps) {
  const [doc, setDoc] = useState<DocumentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchDoc = async () => {
      setLoading(true);

      try {
        const response = await fetch(toApiUrl(`/documents/${docId}`));

        if (!response.ok) {
          if (!cancelled) {
            setDoc(null);
          }

          return;
        }

        const data = (await response.json()) as DocumentInfo | null;

        if (!cancelled) {
          setDoc(data);
        }
      } catch {
        if (!cancelled) {
          setDoc(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchDoc();

    return () => {
      cancelled = true;
    };
  }, [docId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">Document not found.</p>
      </div>
    );
  }

  return <Editor docId={docId} title={doc.title} />;
}
