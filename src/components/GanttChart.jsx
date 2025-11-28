







import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

function getDurationInDays(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const diffMs = e - s;
  const days = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.round(days));
}

export default function GanttChart({ tasks }) {
  const data = tasks.map((task, index) => ({
    id: task.id,
    name: task.title,
    order: index + 1,
    duration: getDurationInDays(task.start, task.end),
    status: task.status,
  }));

  const getBarColor = (status) => {
    switch (status) {
      case "done":
        return "#16a34a";
      case "in-progress":
        return "#6366f1";
      case "todo":
      default:
        return "#0ea5e9";
    }
  };

  return (
    <div className="gantt-container">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 24, bottom: 10, left: 140 }}
          barCategoryGap={12}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#64748b" }}
            label={{
              value: "Duration (days)",
              position: "insideBottom",
              offset: -4,
              style: { fontSize: 11, fill: "#64748b" },
            }}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={150}
            tick={{ fontSize: 11, fill: "#475569" }}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "duration") {
                return [`${value} day(s)`, "Duration"];
              }
              return [value, name];
            }}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="duration" radius={[8, 8, 8, 8]}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={getBarColor(entry.status)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
