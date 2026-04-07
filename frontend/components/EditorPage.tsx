"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import { Editor } from "@/components/Editor";
import { toApiUrl } from "@/lib/runtimeUrls";

interface DocumentInfo {
  _id: string;
  title: string;
}

interface EditorPageProps {
  params: {
    id: string;
  };
}

export function EditorPage({ params }: EditorPageProps) {
  const [doc, setDoc] = useState<DocumentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      setLoading(true);

      try {
        const response = await fetch(toApiUrl(`/documents/${params.id}`));
        if (!response.ok) return notFound();

        const data = await response.json();
        if (!data) return notFound();

        setDoc(data);
      } catch (err) {
        return notFound();
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <Editor docId={params.id} title={doc!.title} />
  );
}
