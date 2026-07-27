import { formatDateShort } from "./utils";

/**
 * Lightweight canvas chart rendering for the PDF report. Deliberately not
 * using a charting library (recharts is SVG/DOM-driven and awkward to
 * rasterize headlessly) — these draw directly onto an offscreen <canvas>
 * at 2x scale, which jsPDF then embeds as a PNG image via addImage.
 */

const CHART_W = 900;
const CHART_H = 380;
const SCALE = 2; // render at 2x for crisp print output, downscale in the PDF

export interface ChartSeries {
  label: string;
  color: string;
  values: (number | null)[];
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  return canvas;
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * magnitude;
}

function pickLabelIndices(count: number, maxLabels: number): number[] {
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil(count / maxLabels);
  const idx: number[] = [];
  for (let i = 0; i < count; i += step) idx.push(i);
  if (idx[idx.length - 1] !== count - 1) idx.push(count - 1);
  return idx;
}

const AXIS_COLOR = "#c9c4e6";
const GRID_COLOR = "#eae7f7";
const TEXT_COLOR = "#5a5580";
const TEXT_FONT = "12px 'Helvetica Neue', Arial, sans-serif";

/** Multi-series line chart (used for Weight Progress and Nutrition Trends). */
export function renderLineChart(dates: string[], series: ChartSeries[]): string {
  const canvas = makeCanvas(CHART_W, CHART_H);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, CHART_W, CHART_H);

  const padL = 56;
  const padR = 20;
  const padT = 24;
  const padB = 46;
  const plotW = CHART_W - padL - padR;
  const plotH = CHART_H - padT - padB;

  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const rawMax = allValues.length ? Math.max(...allValues) : 10;
  const rawMin = allValues.length ? Math.min(...allValues) : 0;
  const pad = Math.max(1, (rawMax - rawMin) * 0.15);
  const max = niceMax(rawMax + pad);
  const min = rawMin - pad <= 0 ? 0 : Math.floor((rawMin - pad) / (max / 5)) * (max / 5);

  const xFor = (i: number) => padL + (dates.length <= 1 ? plotW / 2 : (i / (dates.length - 1)) * plotW);
  const yFor = (v: number) => padT + plotH - ((v - min) / Math.max(1e-6, max - min)) * plotH;

  // Grid + y-axis labels
  ctx.strokeStyle = GRID_COLOR;
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = TEXT_FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const GRID_LINES = 5;
  for (let g = 0; g <= GRID_LINES; g++) {
    const v = min + ((max - min) * g) / GRID_LINES;
    const y = yFor(v);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(CHART_W - padR, y);
    ctx.stroke();
    ctx.fillText(Math.round(v).toLocaleString(), padL - 8, y);
  }

  // Axis line
  ctx.strokeStyle = AXIS_COLOR;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(CHART_W - padR, padT + plotH);
  ctx.stroke();

  // X labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelIdx = pickLabelIndices(dates.length, 8);
  for (const i of labelIdx) {
    ctx.fillText(formatDateShort(dates[i]), xFor(i), padT + plotH + 10);
  }

  // Series lines
  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let started = false;
    s.values.forEach((v, i) => {
      if (v === null) {
        started = false;
        return;
      }
      const x = xFor(i);
      const y = yFor(v);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Points
    ctx.fillStyle = s.color;
    s.values.forEach((v, i) => {
      if (v === null) return;
      ctx.beginPath();
      ctx.arc(xFor(i), yFor(v), dates.length > 60 ? 1.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Legend
  if (series.length > 1) {
    let lx = padL;
    const ly = 12;
    ctx.font = TEXT_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const s of series) {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, ly - 4, 10, 10);
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(s.label, lx + 14, ly + 1);
      lx += 14 + ctx.measureText(s.label).width + 18;
    }
  }

  return canvas.toDataURL("image/png");
}

/** Bar chart with a horizontal goal reference line (used for Water Intake). */
export function renderBarChartWithGoal(
  dates: string[],
  values: number[],
  goal: number,
  barColor: string,
  goalColor: string
): string {
  const canvas = makeCanvas(CHART_W, CHART_H);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, CHART_W, CHART_H);

  const padL = 56;
  const padR = 20;
  const padT = 24;
  const padB = 46;
  const plotW = CHART_W - padL - padR;
  const plotH = CHART_H - padT - padB;

  const max = niceMax(Math.max(goal * 1.15, ...values, 1));
  const yFor = (v: number) => padT + plotH - (v / max) * plotH;

  ctx.strokeStyle = GRID_COLOR;
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = TEXT_FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let g = 0; g <= 5; g++) {
    const v = (max * g) / 5;
    const y = yFor(v);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(CHART_W - padR, y);
    ctx.stroke();
    ctx.fillText(Math.round(v).toLocaleString(), padL - 8, y);
  }

  ctx.strokeStyle = AXIS_COLOR;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(CHART_W - padR, padT + plotH);
  ctx.stroke();

  const n = values.length;
  const slot = plotW / Math.max(1, n);
  const barW = Math.min(28, slot * 0.6);

  ctx.fillStyle = barColor;
  values.forEach((v, i) => {
    const cx = padL + slot * i + slot / 2;
    const y = yFor(v);
    ctx.fillRect(cx - barW / 2, y, barW, padT + plotH - y);
  });

  // Goal reference line
  if (goal > 0) {
    const gy = yFor(goal);
    ctx.strokeStyle = goalColor;
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, gy);
    ctx.lineTo(CHART_W - padR, gy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelIdx = pickLabelIndices(n, 8);
  for (const i of labelIdx) {
    ctx.fillText(formatDateShort(dates[i]), padL + slot * i + slot / 2, padT + plotH + 10);
  }

  return canvas.toDataURL("image/png");
}

/** Simple horizontal bar chart for "most consumed foods". */
export function renderTopFoodsChart(labels: string[], values: number[], color: string): string {
  const h = Math.max(180, labels.length * 34 + 40);
  const canvas = makeCanvas(CHART_W, h);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, CHART_W, h);

  const padL = 160;
  const padR = 40;
  const rowH = 34;
  const max = Math.max(1, ...values);
  const plotW = CHART_W - padL - padR;

  ctx.font = TEXT_FONT;
  labels.forEach((label, i) => {
    const y = 20 + i * rowH;
    const w = (values[i] / max) * plotW;

    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label.length > 20 ? label.slice(0, 19) + "…" : label, padL - 12, y + rowH / 2 - 4);

    ctx.fillStyle = color;
    ctx.fillRect(padL, y, Math.max(2, w), rowH - 12);

    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = "left";
    ctx.fillText(String(values[i]), padL + w + 8, y + rowH / 2 - 4);
  });

  return canvas.toDataURL("image/png");
}

export { CHART_W, CHART_H };
