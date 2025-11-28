



import { useState, useEffect } from "react";
import KanbanBoard from "../components/KanbanBoard";
import GanttChart from "../components/GanttChart";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:4000";

// Normalize backend task shape to UI
function normalizeTask(raw) {
  const depsArray =
    typeof raw.dependencies === "string" && raw.dependencies.length > 0
      ? raw.dependencies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.isArray(raw.dependencies)
      ? raw.dependencies
      : [];

  return {
    ...raw,
    start: raw.start_date,
    end: raw.end_date,
    dependencies: depsArray,
  };
}

export default function Home({ currentUser, onLogout }) {
  const [tasks, setTasks] = useState([]);

  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState("todo");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  // Load tasks for this employee
  useEffect(() => {
    if (!currentUser) return;
    fetch(`${API_BASE}/tasks?employeeId=${currentUser.id}`)
      .then((res) => res.json())
      .then((rows) => setTasks(rows.map(normalizeTask)))
      .catch(console.error);
  }, [currentUser]);

  // WebSocket real-time updates (filter by assigned_employee)
  useEffect(() => {
    if (!currentUser) return;

    const socket = new WebSocket(WS_BASE);
    window.taskSocket = socket;

    socket.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);

      if (type === "initial_tasks") {
        const mine = payload.filter(
          (t) => t.assigned_employee === currentUser.id
        );
        setTasks(mine.map(normalizeTask));
      }

      if (type === "task_created") {
        if (payload.assigned_employee !== currentUser.id) return;
        setTasks((prev) => [...prev, normalizeTask(payload)]);
      }

      if (type === "task_updated") {
        if (payload.assigned_employee !== currentUser.id) return;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === payload.id ? normalizeTask(payload) : t
          )
        );
      }

      if (type === "task_deleted") {
        setTasks((prev) => prev.filter((t) => t.id !== payload.id));
      }

      if (type === "critical_path_updated") {
        console.log("Critical path:", payload);
      }
    };

    return () => socket.close();
  }, [currentUser]);

  const handleAddTask = async (e) => {
    e.preventDefault();

    if (!newTitle || !newStart || !newEnd) {
      alert("Please fill title, start date and end date.");
      return;
    }

    try {
      await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          status: newStatus,
          start_date: newStart,
          end_date: newEnd,
          dependencies: [],
          assigned_employee: currentUser.id,
        }),
      });

      setNewTitle("");
      setNewStatus("todo");
      setNewStart("");
      setNewEnd("");
    } catch (err) {
      console.error("Error creating task:", err);
      alert("Failed to create task");
    }
  };

  const handleDeleteTask = async (id) => {
    const confirmDelete = window.confirm("Delete this task?");
    if (!confirmDelete) return;

    try {
      await fetch(`${API_BASE}/tasks/${id}`, {
        method: "DELETE",
      });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Error deleting task:", err);
      alert("Failed to delete task");
    }
  };

  return (
    <div className="home-layout">
      <div className="home-header-row">
        <div className="home-user-info">
          <span className="home-user-name">
            Logged in as <strong>{currentUser.name}</strong>
          </span>
          <span className="home-user-role">{currentUser.role}</span>
        </div>
        <button className="btn-outline" onClick={onLogout}>
          Logout
        </button>
      </div>

      {/* Add Task Form */}
      <section className="section-block">
        <div className="section-header">
          <h2>Add Task</h2>
          <p>Create a new task assigned to you.</p>
        </div>

        <form className="task-form" onSubmit={handleAddTask}>
          <div className="task-form-row">
            <div className="task-form-field">
              <label>Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter task title"
              />
            </div>

            <div className="task-form-field">
              <label>Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <div className="task-form-row">
            <div className="task-form-field">
              <label>Start Date</label>
              <input
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>

            <div className="task-form-field">
              <label>End Date</label>
              <input
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="task-form-actions">
            <button type="submit" className="btn-primary">
              Add Task
            </button>
          </div>
        </form>
      </section>

      {/* Kanban */}
      <section className="section-block">
        <div className="section-header">
          <h2>Kanban Board</h2>
          <p>Drag and drop your tasks between stages.</p>
        </div>
        <KanbanBoard
          tasks={tasks}
          onTasksChange={setTasks}
          onDeleteTask={handleDeleteTask}
        />
      </section>

      {/* Gantt */}
      <section className="section-block">
        <div className="section-header">
          <h2>Gantt Timeline</h2>
        </div>
        <GanttChart tasks={tasks} />
      </section>
    </div>
  );
}





