import { Router } from "express";
import { createDoc, getDocs, getDoc, updateDoc } from "../controllers/documentController.js";

// TYPE /documents
const router = Router();

router.post("/", createDoc);
router.get("/", getDocs);
router.get("/:id", getDoc);
router.put("/:id", updateDoc);

export default router;