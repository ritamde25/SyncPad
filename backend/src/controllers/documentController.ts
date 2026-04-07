import { Request, Response } from "express";
import * as repo from "../repositories/documentRepository.js";

function getParamValue(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value;
}

export async function createDoc(req: Request, res: Response) {
  const { title, userId } = req.body;

  if (typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required" });
  }

  const docTitle = typeof title === "string" && title.trim() ? title.trim() : "New Document";
  const doc = await repo.createDocument(docTitle, userId);
  res.status(201).json(doc);
}

export async function getDocs(req: Request, res: Response) {
  const { userId } = req.query;

  if (typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required" });
  }

  const docs = await repo.getDocumentsByUser(userId);
  res.json(docs);
}

export async function updateDoc(req: Request, res: Response) {
  const { id } = req.params;
  const { title } = req.body;
  const docId = getParamValue(id);

  if (!docId) {
    return res.status(400).json({ error: "invalid document id" });
  }

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  const doc = await repo.updateDocumentTitle(docId, title.trim());

  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  res.json(doc);
}

export async function getDoc(req: Request, res: Response) {
  const { id } = req.params;
  const docId = getParamValue(id);

  if (!docId) {
    return res.status(400).json({ error: "invalid document id" });
  }

  const doc = await repo.getDocumentById(docId);

  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  res.json(doc);
}
