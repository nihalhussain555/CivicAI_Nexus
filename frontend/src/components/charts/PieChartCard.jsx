import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#4f46e5", "#6366f1", "#818cf8", "#0ea5e9", "#38bdf8", "#16a34a", "#d97706", "#dc2626", "#9aa1b1"];

const PieChartCard = ({ title, data, dataKey = "count", nameKey = "category", height = 280 }) => (
  <div className="card">
    <div className="section-title">{title}</div>
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
          {data?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5 }} />
        <Legend wrapperStyle={{ fontSize: 11.5 }} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

export default PieChartCard;
