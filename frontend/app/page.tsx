import { Suspense } from "react";
import { DocsList } from "@/components/DocsList";

function DocsContent() {
  return <DocsList />;
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DocsContent />
    </Suspense>
  );
}
