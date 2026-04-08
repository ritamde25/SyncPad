import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import path from "path";

import documentRoutes from "./routes/docRoutes.js";
import { connectDB } from "./config/db.js";
import { setupWebSocket } from "./ws/wsServer.js";

const app = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.resolve();

if (process.env.NODE_ENV !== "production") {
    app.use(cors());
}

app.use(express.json());

app.use("/documents", documentRoutes);

if (process.env.NODE_ENV === "production") {
    const frontendBuildPath = path.join(__dirname, "../frontend/out");

    app.get(/^\/doc\/?$/, (_req, res) => {
        res.sendFile(path.join(frontendBuildPath, "doc.html"));
    });

    app.use(express.static(frontendBuildPath, { redirect: false }));

    app.use((req, res) => {
        res.sendFile(path.join(frontendBuildPath, "index.html"));
    });
}

connectDB().then(() => {
    const server = http.createServer(app);
    setupWebSocket(server);

    server.listen(PORT, () => console.log(`Server started on PORT: ${PORT}`));
});