import { randomUUID } from "crypto";
import { DocumentModel, DocumentRecord } from "../models/document.js";

export async function createDocument(
  title: string,
  userId: string
): Promise<DocumentRecord> {
  const docId = randomUUID();
  const doc = await DocumentModel.create({
    _id: docId,
    title: title,
    content: "",
    version: 0,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return doc;
}

export async function getDocumentsByUser(userId: string): Promise<DocumentRecord[]> {
  return DocumentModel.find({ createdBy: userId })
    .sort({ updatedAt: -1 })
    .lean();
}

export async function getDocumentById(docId: string): Promise<DocumentRecord | null> {
  return DocumentModel.findById(docId).lean();
}

export async function updateDocumentTitle(
  docId: string,
  title: string
): Promise<DocumentRecord | null> {
  return DocumentModel.findByIdAndUpdate(
    docId,
    {
      title,
      updatedAt: new Date(),
    },
    { new: true }
  ).lean();
}
