import path from "path";
import http from "http";
import express from "express";
import compression from "compression";
import cors from "cors";
import { Buffer } from "node:buffer";

const app = express();

// Enable CORS configuration globally (MUST go before your routes)
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
    }),
);

// Enable gzip compression
app.use(compression());

// Serve all the files in "public" folder
app.use(express.static(path.join(process.cwd(), "public")));

// The APIs
app.get("/api/data", async (req, res) => {
    // Mock response for testing
    res.status(200).json({
        library: 'Udodi.js',
        author: 'Attamah Celestine'
    });
});

// SPA fallback (IMPORTANT)
app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public/index.html"));
});

// Read Hostinger's assigned port, fallback to 8080 only for local testing
const PORT = process.env.PORT || 8080;

// create HTTP server
const server = http.createServer(app);

// start the server
server.listen(PORT, () => {
    console.log(`Server is listening on port: ${PORT}`);
});
