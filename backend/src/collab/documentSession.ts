import type { Operation } from "../types/operation.js";
import { loadDocumentSnapshot, saveDocumentSnapshot } from "./documentStore.js";

export class DocumentSession {
  content = "";
  version = 0;
  baseVersion = 0;
  operations: Operation[] = [];
  dirty = false;
  operationsSinceSave = 0;
  saveInFlight = false;
  saveRequested = false;
}

const sessions = new Map<string, DocumentSession>();
const loadingSessions = new Map<string, Promise<DocumentSession>>();
const saveTimers = new Map<string, ReturnType<typeof setInterval>>();

function startAutoSave(docId: string): void {
  if (saveTimers.has(docId)) {
    return;
  }

  const timer = setInterval(() => {
    void flushDocumentSession(docId);
  }, 5000);

  saveTimers.set(docId, timer);
}

export function getDocumentSession(docId: string): DocumentSession {
  let session = sessions.get(docId);

  if (!session) {
    session = new DocumentSession();
    sessions.set(docId, session);
  }

  return session;
}

export function peekDocumentSession(docId: string): DocumentSession | undefined {
  return sessions.get(docId);
}

export async function ensureDocumentSession(docId: string): Promise<DocumentSession> {
  const existingSession = sessions.get(docId);

  if (existingSession) {
    startAutoSave(docId);
    return existingSession;
  }

  const pendingLoad = loadingSessions.get(docId);

  if (pendingLoad) {
    return pendingLoad;
  }

  const loadPromise = (async () => {
    const snapshot = await loadDocumentSnapshot(docId);
    const session = new DocumentSession();
    session.content = snapshot.content;
    session.version = snapshot.version;
    session.baseVersion = snapshot.version;
    sessions.set(docId, session);
    startAutoSave(docId);
    return session;
  })()
    .finally(() => {
      loadingSessions.delete(docId);
    });

  loadingSessions.set(docId, loadPromise);
  return loadPromise;
}

export function markDocumentSessionDirty(docId: string): void {
  const session = sessions.get(docId);

  if (!session) {
    return;
  }

  session.dirty = true;
  session.operationsSinceSave += 1;

  if (session.operationsSinceSave >= 20) {
    void flushDocumentSession(docId);
  }
}

export async function flushDocumentSession(docId: string): Promise<void> {
  const session = sessions.get(docId);

  if (!session || !session.dirty) {
    return;
  }

  if (session.saveInFlight) {
    session.saveRequested = true;
    return;
  }

  session.saveInFlight = true;
  session.saveRequested = false;

  try {
    await saveDocumentSnapshot(docId, session.content, session.version);
    session.dirty = false;
    session.operationsSinceSave = 0;
  } catch (error) {
    console.error(`Failed to save document ${docId} to MongoDB:`, error);
  } finally {
    session.saveInFlight = false;

    if (session.saveRequested || session.dirty) {
      session.saveRequested = false;
      void flushDocumentSession(docId);
    }
  }
}

export function clearDocumentSessions(): void {
  saveTimers.forEach((timer) => clearInterval(timer));
  saveTimers.clear();
  loadingSessions.clear();
  sessions.clear();
}

export function pruneDocumentSession(
  session: DocumentSession,
  lowestActiveVersion: number
): void {
  const targetVersion = Math.max(session.baseVersion, Math.min(lowestActiveVersion, session.version));

  if (targetVersion <= session.baseVersion) {
    return;
  }

  const keepFromIndex = session.operations.findIndex((operation) => operation.version > targetVersion);

  if (keepFromIndex === -1) {
    session.operations = [];
  } else {
    session.operations = session.operations.slice(keepFromIndex);
  }

  session.baseVersion = targetVersion;
}
