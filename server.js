const fs = require("fs");
const path = require("path");
const express = require("express");

const PORT = process.env.PORT || 3000;
const TOKENS_FILE = path.join(__dirname, "tokens.txt");
const DATA_DIR = path.join(__dirname, "data");
const ADMIN_KEY = process.env.ADMIN_KEY || "change-me";

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const app = express();
app.use(express.json());

// Load tokens
let availableTokens = fs.readFileSync(TOKENS_FILE, "utf-8")
  .split(/\r?\n/)
  .filter(Boolean);

// Remove tokens that already have JSON files (taken)
availableTokens = availableTokens.filter(token => !fs.existsSync(path.join(DATA_DIR, token + ".json")));

// ---------- Helpers ----------
function getPlayerFile(token) {
  return path.join(DATA_DIR, token + ".json");
}

function readPlayer(token) {
  const file = getPlayerFile(token);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writePlayer(token, data) {
  const file = getPlayerFile(token);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- API ----------

// Take a new token (register new player)
app.post("/take-token", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ ok: false, error: "username_required" });

  if (availableTokens.length === 0) return res.status(400).json({ ok: false, error: "no_tokens_available" });

  // Assign first available token
  const token = availableTokens.shift();

  // Create player JSON
  const playerData = {
    token,
    username,
    xp: 0,
    wins: 0,
    runs: 0
  };
  writePlayer(token, playerData);

  res.json({ ok: true, token, data: playerData });
});

// Validate token
app.post("/validate", (req, res) => {
  const { token } = req.body;
  const player = readPlayer(token);
  if (!player) return res.status(401).json({ ok: false, valid: false });
  res.json({ ok: true, valid: true });
});

// Get player stats
app.get("/player/:token", (req, res) => {
  const token = req.params.token;
  const player = readPlayer(token);
  if (!player) return res.status(404).json({ error: "player_not_found" });
  res.json(player);
});

// Update player stats
app.post("/player/:token", (req, res) => {
  const token = req.params.token;
  const player = readPlayer(token);
  if (!player) return res.status(404).json({ error: "player_not_found" });

  const { username, xp, wins, runs } = req.body;
  if (username !== undefined) player.username = username;
  if (xp !== undefined) player.xp = xp;
  if (wins !== undefined) player.wins = wins;
  if (runs !== undefined) player.runs = runs;

  writePlayer(token, player);
  res.json({ ok: true, data: player });
});

// Leaderboard (top by xp, then wins)
app.get("/leaderboard", (req, res) => {
  const files = fs.readdirSync(DATA_DIR);
  const players = files.map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")));
  players.sort((a, b) => b.xp - a.xp || b.wins - a.wins);
  res.json(players.slice(0, 50));
});

// Admin endpoints
function checkAdmin(req) {
  const key = req.headers["x-admin-key"] || req.query.admin_key || req.body.admin_key;
  return key === ADMIN_KEY;
}

// Delete a player (admin)
app.delete("/admin/player/:token", (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ ok: false, error: "not_admin" });
  const token = req.params.token;
  const file = getPlayerFile(token);
  if (!fs.existsSync(file)) return res.status(404).json({ ok: false, error: "player_not_found" });
  fs.unlinkSync(file);
  availableTokens.push(token); // make token reusable
  res.json({ ok: true });
});

// List all players (admin)
app.get("/admin/players", (req, res) => {
  if (!checkAdmin(req)) return res.status(403).json({ ok: false, error: "not_admin" });
  const files = fs.readdirSync(DATA_DIR);
  const players = files.map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")));
  res.json(players);
});

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Start server
app.listen(PORT, () => console.log(`SuperMaze auth server running on port ${PORT} on Frankfurt, Germany (EU Central)`));
