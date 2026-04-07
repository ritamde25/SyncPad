import { Schema, model } from "mongoose";

export interface DocumentRecord {
  _id: string;
  title: string;
  content: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

const documentSchema = new Schema<DocumentRecord>(
  {
    _id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      default: "New Document",
    },
    content: {
      type: String,
      default: "",
    },
    version: {
      type: Number,
      required: true,
      default: 0,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

export const DocumentModel = model<DocumentRecord>("CollabDoc", documentSchema);