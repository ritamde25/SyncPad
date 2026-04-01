import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

import notesRoutes from "./routes/tempRoutes.js"
import { connectDB } from "./config/db.js"
import rateLimiter from "./middleware/rateLimiter.js";

const app = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.resolve();

if (process.env.NODE_ENV !== "production") {
    app.use(cors());
}

app.use(express.json());
app.use(rateLimiter);

app.use("/", notesRoutes);

if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    app.use((req, res) => {
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
    });
}

connectDB().then(() => {
    app.listen(PORT,  () => console.log(`Server started on PORT: ${PORT}`));
});