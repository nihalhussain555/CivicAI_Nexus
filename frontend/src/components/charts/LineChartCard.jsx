import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const LineChartCard = ({ title, data, dataKey = "count", nameKey = "date", height = 260 }) => (
  <div className="card">
    <div className="section-title">{title}</div>
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5 }} />
        <Line type="monotone" dataKey={dataKey} stroke="#4f46e5" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default LineChartCard;
