// backend/server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");

// --- CONFIG ---
const PORT = process.env.PORT || 4000;
const DB_FILE = path.join(__dirname, "project.db");
const SALT_ROUNDS = 10;

// --- INIT EXPRESS & HTTP SERVER ---
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// --- INIT WEBSOCKET SERVER ---
const wss = new WebSocket.Server({ server });

function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// --- INIT SQLITE DB ---
const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      dependencies TEXT,
      assigned_employee INTEGER,
      FOREIGN KEY (assigned_employee) REFERENCES employees(id)
    )
  `);
});

// --- HELPERS: deps <-> string ---
function parseDependencies(depStr) {
  if (!depStr) return [];
  return depStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
}

function depsToString(depsArray) {
  if (!Array.isArray(depsArray)) return "";
  return depsArray.join(",");
}

// --- PASSWORD HELPERS (sync for simplicity) ---
function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function checkPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// --- HELPER: Critical Path Calculation ---
function computeCriticalPath(tasks) {
  if (!tasks || tasks.length === 0) {
    return { criticalTaskIds: [], projectDuration: 0, details: [] };
  }

  const taskMap = new Map();
  tasks.forEach((t) => {
    const deps = parseDependencies(t.dependencies);
    const start = new Date(t.start_date);
    const end = new Date(t.end_date);
    const durationMs = end - start;
    const durationDays = Math.max(
      1,
      Math.round(durationMs / (1000 * 60 * 60 * 24))
    );

    taskMap.set(t.id, {
      ...t,
      deps,
      duration: durationDays,
      ES: 0,
      EF: 0,
      LS: 0,
      LF: 0,
      float: 0,
    });
  });

  const adj = new Map();
  const indegree = new Map();

  taskMap.forEach((_, id) => {
    adj.set(id, []);
    indegree.set(id, 0);
  });

  taskMap.forEach((task, id) => {
    task.deps.forEach((depId) => {
      if (!adj.has(depId)) return;
      adj.get(depId).push(id);
      indegree.set(id, (indegree.get(id) || 0) + 1);
    });
  });

  // Topological sort
  const queue = [];
  indegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const topo = [];
  while (queue.length > 0) {
    const id = queue.shift();
    topo.push(id);
    (adj.get(id) || []).forEach((succ) => {
      indegree.set(succ, indegree.get(succ) - 1);
      if (indegree.get(succ) === 0) queue.push(succ);
    });
  }

  if (topo.length !== taskMap.size) {
    return { criticalTaskIds: [], projectDuration: 0, details: [] };
  }

  // Forward pass
  topo.forEach((id) => {
    const task = taskMap.get(id);
    if (task.deps.length === 0) {
      task.ES = 0;
    } else {
      let maxEF = 0;
      task.deps.forEach((depId) => {
        const dep = taskMap.get(depId);
        if (dep) {
          maxEF = Math.max(maxEF, dep.EF);
        }
      });
      task.ES = maxEF;
    }
    task.EF = task.ES + task.duration;
  });

  const projectDuration = Math.max(
    ...Array.from(taskMap.values()).map((t) => t.EF)
  );

  // Backward pass
  const reverseTopo = [...topo].reverse();
  reverseTopo.forEach((id) => {
    const task = taskMap.get(id);
    const succs = adj.get(id) || [];

    if (succs.length === 0) {
      task.LF = projectDuration;
    } else {
      let minLS = Infinity;
      succs.forEach((succId) => {
        const succ = taskMap.get(succId);
        if (succ) {
          minLS = Math.min(minLS, succ.LS);
        }
      });
      task.LF = minLS;
    }

    task.LS = task.LF - task.duration;
    task.float = task.LS - task.ES;
  });

  const criticalTaskIds = [];
  const details = [];

  taskMap.forEach((task, id) => {
    if (Math.abs(task.float) < 1e-9) {
      criticalTaskIds.push(id);
    }
    details.push({
      id,
      ES: task.ES,
      EF: task.EF,
      LS: task.LS,
      LF: task.LF,
      float: task.float,
      duration: task.duration,
    });
  });

  return {
    criticalTaskIds,
    projectDuration,
    details,
  };
}

// --- DB helpers ---
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// --- AUTH ROUTES ---

// POST /auth/signup
app.post("/auth/signup", async (req, res) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !role || !password) {
    return res
      .status(400)
      .json({ error: "name, email, role and password are required" });
  }

  try {
    const existing = await dbGet(
      "SELECT id FROM employees WHERE email = ?",
      [email]
    );
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = hashPassword(password);
    const result = await dbRun(
      "INSERT INTO employees (name, email, role, password_hash) VALUES (?, ?, ?, ?)",
      [name, email, role, hash]
    );

    const employee = await dbGet(
      "SELECT id, name, email, role FROM employees WHERE id = ?",
      [result.lastID]
    );

    res.status(201).json(employee);
  } catch (err) {
    console.error("POST /auth/signup error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "email and password are required" });
  }

  try {
    const employee = await dbGet(
      "SELECT * FROM employees WHERE email = ?",
      [email]
    );
    if (!employee) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const match = checkPassword(password, employee.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const { id, name, role } = employee;
    res.json({ id, name, email, role });
  } catch (err) {
    console.error("POST /auth/login error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- EMPLOYEE ROUTES (no password exposure) ---

// GET /employees
app.get("/employees", async (req, res) => {
  try {
    const employees = await dbAll(
      "SELECT id, name, email, role FROM employees"
    );
    res.json(employees);
  } catch (err) {
    console.error("GET /employees error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /employees (admin create)
app.post("/employees", async (req, res) => {
  const { name, email, role, password } = req.body;
  if (!name || !email || !role || !password) {
    return res.status(400).json({
      error: "name, email, role and password are required",
    });
  }
  try {
    const existing = await dbGet(
      "SELECT id FROM employees WHERE email = ?",
      [email]
    );
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = hashPassword(password);
    const result = await dbRun(
      "INSERT INTO employees (name, email, role, password_hash) VALUES (?, ?, ?, ?)",
      [name, email, role, hash]
    );
    const newEmployee = await dbGet(
      "SELECT id, name, email, role FROM employees WHERE id = ?",
      [result.lastID]
    );
    res.status(201).json(newEmployee);
  } catch (err) {
    console.error("POST /employees error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /employees/:id
app.put("/employees/:id", async (req, res) => {
  const id = req.params.id;
  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({
      error: "name, email, and role are required",
    });
  }
  try {
    const result = await dbRun(
      "UPDATE employees SET name = ?, email = ?, role = ? WHERE id = ?",
      [name, email, role, id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    const updatedEmployee = await dbGet(
      "SELECT id, name, email, role FROM employees WHERE id = ?",
      [id]
    );
    res.json(updatedEmployee);
  } catch (err) {
    console.error("PUT /employees/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /employees/:id
app.delete("/employees/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await dbRun("DELETE FROM employees WHERE id = ?", [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /employees/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- TASK ROUTES ---

// GET /tasks?employeeId=...
app.get("/tasks", async (req, res) => {
  const employeeId = req.query.employeeId;
  try {
    let sql = "SELECT * FROM tasks";
    const params = [];
    if (employeeId) {
      sql += " WHERE assigned_employee = ?";
      params.push(employeeId);
    }
    const tasks = await dbAll(sql, params);
    res.json(tasks);
  } catch (err) {
    console.error("GET /tasks error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /tasks
app.post("/tasks", async (req, res) => {
  const {
    title,
    status,
    start_date,
    end_date,
    dependencies,
    assigned_employee,
  } = req.body;

  if (!title || !status || !start_date || !end_date) {
    return res.status(400).json({
      error: "title, status, start_date, and end_date are required",
    });
  }

  const depsString = Array.isArray(dependencies)
    ? depsToString(dependencies)
    : dependencies || "";

  try {
    const result = await dbRun(
      `INSERT INTO tasks 
       (title, status, start_date, end_date, dependencies, assigned_employee)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title,
        status,
        start_date,
        end_date,
        depsString,
        assigned_employee || null,
      ]
    );

    const newTask = await dbGet("SELECT * FROM tasks WHERE id = ?", [
      result.lastID,
    ]);

    broadcast("task_created", newTask);
    await broadcastCriticalPath();

    res.status(201).json(newTask);
  } catch (err) {
    console.error("POST /tasks error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /tasks/:id
app.put("/tasks/:id", async (req, res) => {
  const id = req.params.id;
  const {
    title,
    status,
    start_date,
    end_date,
    dependencies,
    assigned_employee,
  } = req.body;

  if (!title || !status || !start_date || !end_date) {
    return res.status(400).json({
      error: "title, status, start_date, and end_date are required",
    });
  }

  const depsString = Array.isArray(dependencies)
    ? depsToString(dependencies)
    : dependencies || "";

  try {
    const result = await dbRun(
      `UPDATE tasks
       SET title = ?, status = ?, start_date = ?, end_date = ?, 
           dependencies = ?, assigned_employee = ?
       WHERE id = ?`,
      [
        title,
        status,
        start_date,
        end_date,
        depsString,
        assigned_employee || null,
        id,
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updatedTask = await dbGet("SELECT * FROM tasks WHERE id = ?", [id]);

    broadcast("task_updated", updatedTask);
    broadcast("task_moved", {
      id: updatedTask.id,
      status: updatedTask.status,
    });

    await broadcastCriticalPath();

    res.json(updatedTask);
  } catch (err) {
    console.error("PUT /tasks/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /tasks/:id
app.delete("/tasks/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const existing = await dbGet("SELECT * FROM tasks WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: "Task not found" });
    }

    const result = await dbRun("DELETE FROM tasks WHERE id = ?", [id]);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    broadcast("task_deleted", { id: parseInt(id, 10) });
    await broadcastCriticalPath();

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /tasks/:id error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Critical Path broadcast helper ---
async function broadcastCriticalPath() {
  try {
    const tasks = await dbAll("SELECT * FROM tasks");
    const cp = computeCriticalPath(tasks);
    broadcast("critical_path_updated", cp);
  } catch (err) {
    console.error("Critical path computation error:", err.message);
  }
}

// --- WEBSOCKET EVENTS ---
wss.on("connection", async (ws) => {
  console.log("Client connected to WebSocket");

  try {
    const tasks = await dbAll("SELECT * FROM tasks");
    ws.send(JSON.stringify({ type: "initial_tasks", payload: tasks }));

    const cp = computeCriticalPath(tasks);
    ws.send(JSON.stringify({ type: "critical_path_updated", payload: cp }));
  } catch (err) {
    console.error("Error sending initial data to WS client:", err.message);
  }

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

// --- START SERVER ---
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket server on ws://localhost:${PORT}`);
});
