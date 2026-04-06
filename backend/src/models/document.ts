import { Schema, model, models } from "mongoose";

export interface DocumentRecord {
  _id: string;
  content: string;
  version: number;
}

const documentSchema = new Schema<DocumentRecord>(
  {
    _id: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      default: "",
    },
    version: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    versionKey: false,
  }
);

export const DocumentModel = model<DocumentRecord>("CollabDoc", documentSchema);