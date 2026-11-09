import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { seriesColor } from "./chartPalette";

const legendStyle = { fontSize: 11.5, color: "var(--text-muted)" };

const PieChartCard = ({ title, data, dataKey = "count", nameKey = "category", height = 280 }) => (
  <div className="card">
    <div className="section-title">{title}</div>
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
          {data?.map((_, i) => <Cell key={i} fill={seriesColor(i)} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5 }} />
        <Legend wrapperStyle={legendStyle} />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

export default PieChartCard;
