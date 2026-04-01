import express from "express";
import { getMe } from "../controllers/tempController.js";

const router = express.Router();

router.get('/', getMe);

export default router;