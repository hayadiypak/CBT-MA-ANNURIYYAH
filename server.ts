import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Set up body parsers with generous limits for bulk downloads/uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// local offline data file directories
const DATA_DIR = path.join(process.cwd(), "offline_data");
const RESULTS_DIR = path.join(DATA_DIR, "results");

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Helper methods to read/write master lists
function readJsonFile(filename: string, defaultValue: any = []) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf-8");
    return defaultValue;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Gagal membaca berkas ${filename}:`, err);
    return defaultValue;
  }
}

function writeJsonFile(filename: string, data: any) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Gagal menulis berkas ${filename}:`, err);
  }
}

// API: Health probe
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", offlineServer: true });
});

// API: Get and set exam mode
app.get("/api/offline/exam-mode", (req, res) => {
  const modeData = readJsonFile("exam_mode.json", { examMode: "offline" });
  res.json(modeData);
});

app.post("/api/offline/exam-mode", (req, res) => {
  const { examMode } = req.body;
  if (examMode) {
    writeJsonFile("exam_mode.json", { examMode, updatedAt: new Date().toISOString() });
    res.json({ success: true, examMode });
  } else {
    res.status(400).json({ error: "examMode parameter is required" });
  }
});

// API: Exams
app.get("/api/offline/exams", (req, res) => {
  const exams = readJsonFile("exams.json", []);
  res.json({ data: exams });
});

app.post("/api/offline/exams", (req, res) => {
  const { data } = req.body;
  if (Array.isArray(data)) {
    writeJsonFile("exams.json", data);
    res.json({ success: true, count: data.length });
  } else {
    res.status(400).json({ error: "data must be an array of exams" });
  }
});

// API: Students
app.get("/api/offline/students", (req, res) => {
  const students = readJsonFile("students.json", []);
  res.json({ data: students });
});

app.post("/api/offline/students", (req, res) => {
  const { data } = req.body;
  if (Array.isArray(data)) {
    writeJsonFile("students.json", data);
    res.json({ success: true, count: data.length });
  } else {
    res.status(400).json({ error: "data must be an array of students" });
  }
});

// API: Teachers
app.get("/api/offline/teachers", (req, res) => {
  const teachers = readJsonFile("teachers.json", []);
  res.json({ data: teachers });
});

app.post("/api/offline/teachers", (req, res) => {
  const { data } = req.body;
  if (Array.isArray(data)) {
    writeJsonFile("teachers.json", data);
    res.json({ success: true, count: data.length });
  } else {
    res.status(400).json({ error: "data must be an array of teachers" });
  }
});

// API: Active Proctored Sessions (Live Screen monitoring data)
app.get("/api/offline/active-sessions", (req, res) => {
  const sessions = readJsonFile("active_sessions.json", []);
  res.json({ data: sessions });
});

app.post("/api/offline/active-sessions", (req, res) => {
  const { data } = req.body;
  if (Array.isArray(data)) {
    writeJsonFile("active_sessions.json", data);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "data must be an array of sessions" });
  }
});

app.post("/api/offline/active-sessions/update", (req, res) => {
  const session = req.body;
  if (!session || !session.studentId) {
    return res.status(400).json({ error: "Invalid session data" });
  }
  const sessions = readJsonFile("active_sessions.json", []);
  const idx = sessions.findIndex((s: any) => s.studentId === session.studentId);
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...session };
  } else {
    sessions.push(session);
  }
  writeJsonFile("active_sessions.json", sessions);
  res.json({ success: true, count: sessions.length });
});

app.delete("/api/offline/active-sessions/delete/:studentId", (req, res) => {
  const { studentId } = req.params;
  const sessions = readJsonFile("active_sessions.json", []);
  const filtered = sessions.filter((s: any) => s.studentId !== studentId);
  writeJsonFile("active_sessions.json", filtered);
  res.json({ success: true, count: filtered.length });
});

app.post("/api/offline/active-sessions/status", (req, res) => {
  const { studentId, status } = req.body;
  if (!studentId || !status) {
    return res.status(400).json({ error: "studentId and status are required" });
  }
  const sessions = readJsonFile("active_sessions.json", []);
  const idx = sessions.findIndex((s: any) => s.studentId === studentId);
  if (idx >= 0) {
    sessions[idx].status = status;
    writeJsonFile("active_sessions.json", sessions);
    res.json({ success: true });
  } else {
    // If not in session, just ignore or create
    res.json({ success: false, message: "Session not found" });
  }
});

// API: Submission of a single student's exam result (Saves directly as separate file to prevent race condition write-locks)
app.post("/api/offline/submit-result", (req, res) => {
  const result = req.body;
  if (!result || !result.id) {
    return res.status(400).json({ error: "Data hasil ujian tidak valid (butuh id)" });
  }

  try {
    const resultFilePath = path.join(RESULTS_DIR, `${result.id}.json`);
    fs.writeFileSync(resultFilePath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`[Offline Server] Sukses menyimpan hasil ujian siswa: ${result.studentName} (${result.studentNisn})`);
    res.json({ success: true, message: "Hasil ujian berhasil disimpan pada PC Server Offline!" });
  } catch (err: any) {
    console.error("Gagal menyimpan hasil ujian offline ke disk:", err);
    res.status(500).json({ error: "Internal Server Error saat menyimpan nilai." });
  }
});

// API: Get all results merged together from both lists and loose files
app.get("/api/offline/results", (req, res) => {
  try {
    const files = fs.readdirSync(RESULTS_DIR);
    const results: any[] = [];
    
    // Read individual files
    files.forEach((file) => {
      if (file.endsWith(".json")) {
        try {
          const raw = fs.readFileSync(path.join(RESULTS_DIR, file), "utf-8");
          results.push(JSON.parse(raw));
        } catch (e) {
          console.error(`Gagal membaca berkas hasil individu ${file}:`, e);
        }
      }
    });

    // Sort by completion time (newest first)
    results.sort((a, b) => (b.completedTime || 0) - (a.completedTime || 0));

    res.json({ data: results });
  } catch (err: any) {
    console.error("Gagal menarik daftar hasil offline server:", err);
    res.status(500).json({ error: err.message });
  }
});

// API: Save / import bulk results
app.post("/api/offline/results/bulk", (req, res) => {
  const { data } = req.body;
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: "data harus berupa array array hasil ujian" });
  }

  try {
    data.forEach((result: any) => {
      if (result && result.id) {
        const resultFilePath = path.join(RESULTS_DIR, `${result.id}.json`);
        fs.writeFileSync(resultFilePath, JSON.stringify(result, null, 2), "utf-8");
      }
    });
    res.json({ success: true, count: data.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete result file if deleted from dashboard
app.delete("/api/offline/results/:id", (req, res) => {
  const { id } = req.params;
  try {
    const resultFilePath = path.join(RESULTS_DIR, `${id}.json`);
    if (fs.existsSync(resultFilePath)) {
      fs.unlinkSync(resultFilePath);
      res.json({ success: true, message: "Berhasil menghapus hasil offline." });
    } else {
      res.status(404).json({ error: "Berkas hasil tidak ditemukan." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function start() {
  // Vite middleware for development vs static asset serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`=======================================================`);
    console.log(`   CBT MA ANNURIYYAH OFFLINE SERVER IS READY!        `);
    console.log(`   Port Akses Utama  : http://localhost:${PORT}        `);
    console.log(`   Internal LAN URL  : http://<Alamat_IP_Server>:${PORT} `);
    console.log(`=======================================================`);
  });
}

start();
