



import { DndContext, useDroppable, closestCenter } from "@dnd-kit/core";
import TaskCard from "./TaskCard";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

function Column({ columnId, title, count, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <span className="kanban-column-title">{title}</span>
        <span className="kanban-column-count">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={
          "kanban-column-body" + (isOver ? " kanban-column-body-over" : "")
        }
      >
        {children}
        {count === 0 && !isOver && (
          <p className="kanban-empty-text">
            Drop tasks here to move them to <strong>{title}</strong>.
          </p>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks, onTasksChange, onDeleteTask }) {
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;

    if (!["todo", "in-progress", "done"].includes(newStatus)) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    onTasksChange(updatedTasks);

    fetch(`${API_BASE}/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...task,
        status: newStatus,
        start_date: task.start_date || task.start,
        end_date: task.end_date || task.end,
        dependencies: task.dependencies || [],
        assigned_employee: task.assigned_employee || null,
      }),
    });
  };

  const tasksByStatus = (status) =>
    tasks.filter((task) => task.status === status);

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const columnTasks = tasksByStatus(column.id);
          return (
            <Column
              key={column.id}
              columnId={column.id}
              title={column.title}
              count={columnTasks.length}
            >
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDelete={() => onDeleteTask(task.id)}
                />
              ))}
            </Column>
          );
        })}
      </div>
    </DndContext>
  );
}
