import localtunnel from "localtunnel";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import { processImage } from "./image-processor";
import { promisify } from "util";
import { html } from "./html";

const LOCAL_PORT = 3000;
const LOCALTUNNEL_HOST = "https://processor-proxy.sook.ch/";
const LOCALTUNNEL_SUBDOMAIN = "heic2png";

const app = express();

app.use(express.json());
app.use(cors({ origin: "*" }));

declare let _STD_: any;
if (typeof _STD_ === "undefined") {
  // If _STD_ is not defined, we know it's not running in the Acurast Cloud.
  // Define _STD_ here for local testing.
  console.log("Running in local environment");
  (global as any)._STD_ = {
    job: { getId: () => "local", storageDir: path.join(__dirname, "..") },
  };
}

const STORAGE_DIR_PATH = path.join(_STD_.job.storageDir, "uploads");

// Create uploads directory if it doesn't exist
const uploadDir = STORAGE_DIR_PATH;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(_STD_.job.storageDir, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

// Configure multer
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".heic") {
      return cb(new Error("Only .heic files are allowed"));
    }
    cb(null, true);
  },
});

app.get("/", (req, res) => {
  res.send(html);
});

// TODO: Persist the image urls
const processedImages = new Map<string, string>();

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    console.log("HEIC FILE UPLOADED");
    if (!req.file) {
      res.status(400).json({ success: false, error: "No file uploaded." });
      return;
    }
    console.log("HEIC FILE: " + req.file);

    const isHeicFile = req.file.originalname.toLowerCase().endsWith(".heic");
    if (!isHeicFile) {
      // Delete the uploaded non-HEIC file
      fs.unlinkSync(req.file.path);
      res
        .status(400)
        .json({ success: false, error: "Please upload a HEIC file." });
      return;
    }

    const id = Math.random().toString(36).substring(2, 15);

    res.json({ success: true, id });

    // Here we could upload the file to a remote storage and save its url
    const inputBuffer = await promisify(fs.readFile)(req.file.path);
    const result = await processImage(id, inputBuffer);
    processedImages.set(id, result.url);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ success: false, error: "Upload failed." });
    return;
  }
});

app.get("/processed/:id", (req, res) => {
  try {
    if (!req.params.id) {
      res.status(400).json({ success: false, error: "No id provided." });
      return;
    }

    const filename = processedImages.get(req.params.id);
    if (!filename) {
      res
        .status(404)
        .json({ success: false, error: "Image not processed yet." });
      return;
    }

    const downloadUrl = `/download/${req.params.id}.png`;
    res.json({ success: true, url: downloadUrl });
  } catch (error) {
    console.error("Error checking file status:", error);
    res
      .status(500)
      .json({ success: false, error: "Error checking file status." });
    return;
  }
});

app.get("/download/:id.png", (req, res) => {
  try {
    const filePath = processedImages.get(req.params.id);
    if (!filePath) {
      res.status(404).json({ success: false, error: "Image not found" });
      return;
    }
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ success: false, error: "Error downloading file." });
    return;
  }
});

app.listen(LOCAL_PORT, () =>
  console.log(`Server listening on port ${LOCAL_PORT}!`)
);

const startTunnel = async () => {
  try {
    const tunnel = await localtunnel({
      subdomain: LOCALTUNNEL_SUBDOMAIN,
      host: LOCALTUNNEL_HOST,
      port: LOCAL_PORT,
    });

    console.log(`Tunnel started at ${tunnel.url}`);
  } catch (error) {
    console.error("Error starting tunnel:", error);
  }
};

startTunnel();
