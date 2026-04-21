import { DocumentModel } from "../models/document.js";

export interface DocumentSnapshot {
  content: string;
  version: number;
}

interface CachedSnapshot extends DocumentSnapshot {
  expiresAt: number;
}

const snapshotCache = new Map<string, CachedSnapshot>();
const CACHE_TTL_MS = 60_000;

export async function loadDocumentSnapshot(docId: string): Promise<DocumentSnapshot> {
  const now = Date.now();
  const cached = snapshotCache.get(docId);

  if (cached && cached.expiresAt > now) {
    return { content: cached.content, version: cached.version };
  }

  const document = await DocumentModel.findById(docId).lean();

  const snapshot: DocumentSnapshot = !document
    ? { content: "", version: 0 }
    : {
        content: document.content ?? "",
        version: document.version ?? 0,
      };

  snapshotCache.set(docId, {
    ...snapshot,
    expiresAt: now + CACHE_TTL_MS,
  });

  return snapshot;
}

export async function saveDocumentSnapshot(
  docId: string,
  content: string,
  version: number
): Promise<void> {
  snapshotCache.delete(docId);

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
