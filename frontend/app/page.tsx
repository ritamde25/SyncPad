import { Suspense } from "react";
import { Editor } from "@/components/Editor";

function EditorContent() {
  return <Editor />;
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditorContent />
    </Suspense>
  );
}
