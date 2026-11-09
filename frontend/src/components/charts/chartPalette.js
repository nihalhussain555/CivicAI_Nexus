/*
 * Categorical series colours for Recharts. They resolve to the --chart-*
 * tokens in index.css, so a chart repaints correctly when the theme switch
 * changes those tokens — a literal hex palette would leave dark mode with
 * near-black slices on a near-black card.
 */
const RAMP = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
];

export const seriesColor = (index) => `var(${RAMP[index % RAMP.length]})`;
