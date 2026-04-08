import { randomUUID } from "crypto";
import { Router } from "express";
import { DocumentModel } from "../models/document.js";

const router = Router();

router.post("/", async (req, res) => {
	const { title, userId } = req.body;

	if (typeof userId !== "string" || !userId.trim()) {
		return res.status(400).json({ error: "userId is required" });
	}

	const docTitle = typeof title === "string" && title.trim() ? title.trim() : "New Document";
	const doc = await DocumentModel.create({
		_id: randomUUID(),
		title: docTitle,
		content: "",
		version: 0,
		createdBy: userId.trim(),
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	return res.status(201).json(doc);
});

router.get("/", async (req, res) => {
	const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";

	if (!userId) {
		return res.status(400).json({ error: "userId is required" });
	}

	const docs = await DocumentModel.find({ createdBy: userId }).sort({ updatedAt: -1 }).lean();
	return res.json(docs);
});

router.get("/:id", async (req, res) => {
	const docId = req.params.id?.trim();

	if (!docId) {
		return res.status(400).json({ error: "invalid document id" });
	}

	const doc = await DocumentModel.findById(docId).lean();

	if (!doc) {
		return res.status(404).json({ error: "Document not found" });
	}

	return res.json(doc);
});

router.put("/:id", async (req, res) => {
	const docId = req.params.id?.trim();
	const { title } = req.body;

	if (!docId) {
		return res.status(400).json({ error: "invalid document id" });
	}

	if (typeof title !== "string" || !title.trim()) {
		return res.status(400).json({ error: "title is required" });
	}

	const doc = await DocumentModel.findByIdAndUpdate(
		docId,
		{
			title: title.trim(),
			updatedAt: new Date(),
		},
		{ returnDocument: "after" }
	).lean();

	if (!doc) {
		return res.status(404).json({ error: "Document not found" });
	}

	return res.json(doc);
});

export default router;