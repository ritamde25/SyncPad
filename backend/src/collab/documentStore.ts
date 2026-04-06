import { DocumentModel } from "../models/document.js";

export interface DocumentSnapshot {
  content: string;
  version: number;
}

export async function loadDocumentSnapshot(docId: string): Promise<DocumentSnapshot> {
  const document = await DocumentModel.findById(docId).lean();

  if (!document) {
    return {
      content: "",
      version: 0,
    };
  }

  return {
    content: document.content ?? "",
    version: document.version ?? 0,
  };
}

export async function saveDocumentSnapshot(
  docId: string,
  content: string,
  version: number
): Promise<void> {
  await DocumentModel.updateOne(
    { _id: docId },
    {
      $set: {
        content,
        version,
      },
    },
    {
      upsert: true,
    }
  );
}

export async function getDocument(docId: string): Promise<string> {
  const snapshot = await loadDocumentSnapshot(docId);
  return snapshot.content;
}

export async function updateDocument(docId: string, content: string): Promise<void> {
  const snapshot = await loadDocumentSnapshot(docId);
  await saveDocumentSnapshot(docId, content, snapshot.version);
}
