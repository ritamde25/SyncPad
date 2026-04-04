import type { Operation } from "../types/operation.js";

export class DocumentSession {
  content = "";
  version = 0;
  baseVersion = 0;
  operations: Operation[] = [];
}

const sessions = new Map<string, DocumentSession>();

export function getDocumentSession(docId: string): DocumentSession {
  let session = sessions.get(docId);

  if (!session) {
    session = new DocumentSession();
    sessions.set(docId, session);
  }

  return session;
}

export function clearDocumentSessions(): void {
  sessions.clear();
}

export function getAllDocumentSessions(): Map<string, DocumentSession> {
  return new Map(sessions);
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
