import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
  type ScriptableContext,
} from "chart.js";

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip);
Chart.defaults.font.family = "Inter, system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = "#AAB4C3";
Chart.defaults.borderColor = "#2b3a4f";
// Change only the duration: replacing the whole animation object drops Chart.js's internal easing setup.
if (Chart.defaults.animation) Chart.defaults.animation.duration = 500;
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: "#0D121B",
  borderColor: "#354154",
  borderWidth: 1,
  padding: 10,
  cornerRadius: 10,
  titleColor: "#F5F6FA",
  bodyColor: "#C9D1DD",
  boxPadding: 4,
  usePointStyle: true,
});

export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

export const yPct = () => ({
  min: 0,
  max: 100,
  ticks: { stepSize: 25, callback: (v: string | number) => `${v}%`, padding: 8 },
  grid: { color: "#2b3a4f", drawTicks: false },
  border: { display: false, dash: [4, 4] },
});
export const xPlain = (max = 8) => ({ grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: max, maxRotation: 0, padding: 6 } });

const areaGrad = (color: string) => (c: ScriptableContext<"line">) => {
  const { ctx, chartArea } = c.chart;
  if (!chartArea) return hexA(color, 0.15);
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, hexA(color, 0.38));
  g.addColorStop(1, hexA(color, 0));
  return g;
};

/** Draws the value bubble pinned on one point (today), like "87%" in the reference design. */
export const pinPlugin = (idx: number, color: string): Plugin<"line"> => ({
  id: "pin",
  afterDatasetsDraw(chart) {
    const pt = chart.getDatasetMeta(0).data[idx];
    const v = chart.data.datasets[0].data[idx];
    if (!pt || v == null) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = hexA(color, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y + 7);
    ctx.lineTo(pt.x, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    const txt = `${v}%`;
    ctx.font = "600 12px Inter, sans-serif";
    const w = ctx.measureText(txt).width + 18;
    const h = 22;
    const x = Math.max(chartArea.left, Math.min(chartArea.right - w + 8, pt.x - w / 2));
    const y = pt.y - h - 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 11);
    ctx.fill();
    ctx.fillStyle = "#1d1620";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
  },
});

type Line = { label: string; data: (number | null)[]; color: string; hidden?: boolean };

/** One line with a soft area fill and today's value pinned. Optional thin comparison line. */
export function areaLine(labels: string[], main: Line, comp?: Line, maxTicks = 8) {
  const pin = main.data.length - 1;
  const data: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: main.label,
        data: main.data,
        borderColor: main.color,
        borderWidth: 2.5,
        tension: 0.45,
        fill: true,
        spanGaps: true,
        backgroundColor: areaGrad(main.color),
        pointRadius: (c) => (c.dataIndex === pin ? 5 : 0),
        pointHoverRadius: 5,
        pointBackgroundColor: main.color,
        pointBorderColor: "#111722",
        pointBorderWidth: 2,
      },
      ...(comp
        ? [{ label: comp.label, data: comp.data, borderColor: comp.color, borderWidth: 1.6, tension: 0.45, fill: false, spanGaps: true, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: comp.color }]
        : []),
    ],
  };
  const options: ChartOptions<"line"> = {
    maintainAspectRatio: false,
    layout: { padding: { top: 30, right: 10 } },
    interaction: { mode: "index", intersect: false },
    scales: { y: yPct(), x: xPlain(maxTicks) },
    plugins: { tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%` } } },
  };
  return { data, options, plugins: [pinPlugin(pin, main.color)] };
}

/** One line per category (All Progress view). */
export function multiLine(labels: string[], lines: Line[], maxTicks = 8) {
  const n = labels.length;
  const data: ChartData<"line"> = {
    labels,
    datasets: lines.map((l) => ({
      label: l.label,
      data: l.data,
      hidden: l.hidden,
      borderColor: l.color,
      backgroundColor: l.color,
      borderWidth: 2.2,
      tension: 0.45,
      fill: false,
      spanGaps: true,
      pointRadius: (c: ScriptableContext<"line">) => (c.dataIndex === n - 1 ? 3.5 : 0),
      pointHoverRadius: 5,
      pointBorderColor: "#111722",
      pointBorderWidth: 1.5,
    })),
  };
  const options: ChartOptions<"line"> = {
    maintainAspectRatio: false,
    layout: { padding: { top: 10, right: 10 } },
    interaction: { mode: "index", intersect: false },
    scales: { y: yPct(), x: xPlain(maxTicks) },
    plugins: { tooltip: { itemSort: (a, b) => (b.parsed.y ?? 0) - (a.parsed.y ?? 0), callbacks: { label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%` } } },
  };
  return { data, options };
}

export function donut(labels: string[], values: number[], colors: string[], cutout = "74%", fmt: (v: number) => string = String) {
  const data: ChartData<"doughnut"> = { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "#202D3D", borderWidth: 3, hoverOffset: 4, borderRadius: 4 }] };
  const options: ChartOptions<"doughnut"> = { maintainAspectRatio: false, cutout, plugins: { tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmt(c.parsed)}` } } } };
  return { data, options };
}
