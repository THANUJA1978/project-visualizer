import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

sqlite3.verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB file path: backend/project.db
const dbPath = path.join(__dirname, "project.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite:", err.message);
  } else {
    console.log("Connected to SQLite at", dbPath);
    initDb();
  }
});

function initDb() {
  // Enable foreign keys
  db.run("PRAGMA foreign_keys = ON");

  // Employees table
  db.run(
    `
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL
    );
  `,
    (err) => {
      if (err) {
        console.error("Error creating employees table:", err.message);
      } else {
        console.log("employees table ready ✅");
      }
    }
  );

  // Tasks table
  db.run(
    `
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,          -- e.g. 'todo', 'in-progress', 'done'
      start_date TEXT NOT NULL,      -- ISO date string
      end_date TEXT NOT NULL,        -- ISO date string
      dependencies TEXT,             -- comma-separated task IDs, e.g. "1,2"
      assigned_employee INTEGER,     -- FK to employees.id (nullable)
      FOREIGN KEY (assigned_employee) REFERENCES employees(id)
    );
  `,
    (err) => {
      if (err) {
        console.error("Error creating tasks table:", err.message);
      } else {
        console.log("tasks table ready ✅");
      }
    }
  );
}

export default db;