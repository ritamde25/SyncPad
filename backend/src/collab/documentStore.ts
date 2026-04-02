const documents = new Map<string, string>();

export function getDocument(docId: string): string {
  if (!documents.has(docId)) {
    documents.set(docId, "");
  }
  return documents.get(docId)!;
}

export function updateDocument(docId: string, content: string): void {
  documents.set(docId, content);
}

export function getAllDocuments(): Map<string, string> {
  return new Map(documents);
}

export function clearAllDocuments(): void {
  documents.clear();
}
