"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EditorPage } from "@/components/EditorPage";

function DocContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");

  if (!docId) {
    return <div>Missing document id.</div>;
  }

  return <EditorPage docId={docId} />;
}

export default function DocPage() {
  return (
    <Suspense fallback={<div>Loading editor...</div>}>
      <DocContent />
    </Suspense>
  );
}
