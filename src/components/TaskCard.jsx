



import { useDraggable } from "@dnd-kit/core";

export default function TaskCard({ task, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
    });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const statusClass =
    task.status === "done"
      ? "task-status-done"
      : task.status === "in-progress"
      ? "task-status-progress"
      : "task-status-todo";

  return (
    <div ref={setNodeRef} style={style} className="task-card">
      <div
        className="task-card-header"
        {...listeners}
        {...attributes}
        style={{ cursor: "grab" }}
      >
        <h4 className="task-title">{task.title}</h4>
        <span className={`task-status-badge ${statusClass}`}>
          {task.status.replace("-", " ")}
        </span>
      </div>

      <div className="task-meta">
        <div className="task-line">
          <span className="task-label">Duration:</span>
          <span className="task-value">
            {task.start} → {task.end}
          </span>
        </div>

        {task.dependencies?.length > 0 && (
          <div className="task-line">
            <span className="task-label">Depends on:</span>
            <span className="task-tags">
              {task.dependencies.map((d) => (
                <span key={d} className="task-tag">
                  #{d}
                </span>
              ))}
            </span>
          </div>
        )}

        <div className="task-actions">
          <button
            type="button"
            className="btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              if (onDelete) onDelete();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
