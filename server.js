// server.js - SuperMaze Auth Server (CORS enabled manually)
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());

// Manual CORS headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// --- In-memory token map ---
let tokens = [];

// Load tokens.txt into memory
function loadTokens() {
  const tokenFile = path.join(__dirname, "tokens.txt");
  if (!fs.existsSync(tokenFile)) fs.writeFileSync(tokenFile, "");
  const content = fs.readFileSync(tokenFile, "utf-8");
  tokens = content.split("\n").filter(Boolean);
}

// --- GET new token ---
app.get("/api/new-token", (req, res) => {
  if (!tokens.length) loadTokens();

  if (!tokens.length) return res.status(404).json({ error: "No tokens available" });

  const token = tokens.shift(); // take first available token
  const stats = getStats(token);

  res.json({ token, stats });

  console.log(`Token assigned: ${token}`);
});

// --- GET stats for token ---
app.get("/api/stats/:token", (req, res) => {
  const token = req.params.token;
  const stats = getStats(token);
  if (!stats) return res.status(404).json({ error: "Token not found" });
  res.json(stats);
});

// --- POST stats/update for token ---
app.post("/api/stats/:token", (req, res) => {
  const token = req.params.token;
  const { xp = 0, completed = 0, run = null } = req.body;

  const stats = getStats(token);
  stats.xp = xp;
  stats.completed = completed;
  if (run) stats.runs.push(run);

  saveStats(token, stats);
  console.log(`Data for ${token} updated: XP=${xp}, completed=${completed}`);
  res.json({ success: true, stats });
});

// --- Helpers ---
function getStats(token) {
  const file = path.join(DATA_DIR, token + ".json");
  if (!fs.existsSync(file)) {
    const defaultStats = { xp: 0, completed: 0, runs: [] };
    saveStats(token, defaultStats);
    return defaultStats;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    const defaultStats = { xp: 0, completed: 0, runs: [] };
    saveStats(token, defaultStats);
    return defaultStats;
  }
}

function saveStats(token, stats) {
  const file = path.join(DATA_DIR, token + ".json");
  fs.writeFileSync(file, JSON.stringify(stats, null, 2));
}

// --- Start server ---
app.listen(PORT, () => console.log(`SuperMaze Auth Server running on port ${PORT}`));
