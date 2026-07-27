import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportData } from "./reportData";
import { renderBarChartWithGoal, renderLineChart, renderTopFoodsChart, CHART_W, CHART_H } from "./reportCharts";
import { formatDateLabel, formatDateShort } from "./utils";
import { GOAL_LABELS } from "./goalCopy";

// ── Brand palette (mirrors tailwind.config.ts) ──────────────────────────
const NOVA = "#7c5cf0";
const NOVA_DARK = "#5a32c9";
const AURORA = "#2ecfdd";
const EMBER = "#f5601f";
const VOID = "#0b0d1e";
const TEXT = "#191631";
const TEXT_MUTED = "#64608a";
const BORDER = "#e2ddf5";
const BG_SOFT = "#f6f4fd";
const SUCCESS = "#1a9f6b";

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** Draws the small BodyBuddy dumbbell-in-circle mark used on the cover and
 * in the running header. Vector-drawn so it never depends on rasterizing
 * the app's SVG icon. */
function drawLogoMark(doc: jsPDF, cx: number, cy: number, r: number) {
  const [r1, g1, b1] = hexToRgb(NOVA);
  const [r2, g2, b2] = hexToRgb(NOVA_DARK);
  // simple radial-ish two-tone circle
  doc.setFillColor(r2, g2, b2);
  doc.circle(cx, cy, r, "F");
  doc.setFillColor(r1, g1, b1);
  doc.circle(cx, cy, r * 0.86, "F");
  // dumbbell glyph
  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(r * 0.16);
  doc.line(cx - r * 0.42, cy, cx + r * 0.42, cy);
  doc.roundedRect(cx - r * 0.58, cy - r * 0.22, r * 0.22, r * 0.44, 1.2, 1.2, "F");
  doc.roundedRect(cx + r * 0.36, cy - r * 0.22, r * 0.22, r * 0.44, 1.2, 1.2, "F");
}

function addFooter(doc: jsPDF, pageIndex: number, totalPages: number, generatedOn: string) {
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.setFont("helvetica", "normal");
  doc.text("BodyBuddy · Health & Nutrition Report", MARGIN, PAGE_H - 24);
  doc.text(generatedOn, PAGE_W / 2, PAGE_H - 24, { align: "center" });
  doc.text(`Page ${pageIndex} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  doc.setDrawColor(...hexToRgb(BORDER));
  doc.setLineWidth(0.5);
  doc.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34);
}

function sectionHeader(doc: jsPDF, title: string, subtitle: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...hexToRgb(TEXT));
  doc.text(title, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...hexToRgb(TEXT_MUTED));
  doc.text(subtitle, MARGIN, y + 15);
  doc.setDrawColor(...hexToRgb(NOVA));
  doc.setLineWidth(1.5);
  doc.line(MARGIN, y + 24, MARGIN + 60, y + 24);
  return y + 42;
}

interface StatBox {
  label: string;
  value: string;
  accent?: string;
}

function drawStatGrid(doc: jsPDF, boxes: StatBox[], y: number, cols = 3): number {
  const gap = 10;
  const boxW = (CONTENT_W - gap * (cols - 1)) / cols;
  const boxH = 56;
  boxes.forEach((box, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (boxW + gap);
    const by = y + row * (boxH + gap);

    doc.setFillColor(...hexToRgb(BG_SOFT));
    doc.setDrawColor(...hexToRgb(BORDER));
    doc.roundedRect(x, by, boxW, boxH, 6, 6, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...hexToRgb(box.accent ?? NOVA_DARK));
    doc.text(box.value, x + 12, by + 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...hexToRgb(TEXT_MUTED));
    doc.text(box.label, x + 12, by + 40, { maxWidth: boxW - 20 });
  });
  const rows = Math.ceil(boxes.length / cols);
  return y + rows * (boxH + gap);
}

function fitImage(doc: jsPDF, dataUrl: string, y: number, aspect: number): number {
  const w = CONTENT_W;
  const h = w / aspect;
  doc.addImage(dataUrl, "PNG", MARGIN, y, w, h);
  return y + h + 14;
}

export interface HealthReportInput {
  data: ReportData;
  aiBullets: string[];
}

export function buildHealthReportPdf({ data, aiBullets }: HealthReportInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const generatedOn = new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const goalLabel = GOAL_LABELS[data.settings.goalMode];
  const periodLabel =
    data.period.startISO === data.period.endISO
      ? formatDateLabel(data.period.startISO)
      : `${formatDateLabel(data.period.startISO)} – ${formatDateLabel(data.period.endISO)}`;

  // ── 1. Cover Page ──────────────────────────────────────────────────
  doc.setFillColor(...hexToRgb(VOID));
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  // soft accent band
  doc.setFillColor(...hexToRgb(NOVA_DARK));
  doc.rect(0, 0, PAGE_W, 8, "F");

  drawLogoMark(doc, PAGE_W / 2, 210, 46);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text("BodyBuddy", PAGE_W / 2, 300, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...hexToRgb("#c9bdfd"));
  doc.text("Nutrition Progress Report", PAGE_W / 2, 324, { align: "center" });

  doc.setDrawColor(...hexToRgb("#3a2378"));
  doc.setLineWidth(1);
  doc.line(PAGE_W / 2 - 90, 348, PAGE_W / 2 + 90, 348);

  const coverRows: [string, string][] = [
    ["Name", data.userName],
    ["Email", data.userEmail || "—"],
    ["Goal", goalLabel],
    ["Selected Period", periodLabel],
    ["Generated on", generatedOn],
  ];
  let cy = 390;
  doc.setFontSize(11);
  for (const [label, value] of coverRows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...hexToRgb("#9793c2"));
    doc.text(label, PAGE_W / 2 - 140, cy, { align: "left" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(value, PAGE_W / 2 + 140, cy, { align: "right" });
    cy += 26;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb("#5a5580"));
  doc.text(
    "This report is generated for personal record-keeping and may be shared with a coach,",
    PAGE_W / 2,
    PAGE_H - 90,
    { align: "center" }
  );
  doc.text("nutritionist, or trainer. Data reflects entries logged in the BodyBuddy app.", PAGE_W / 2, PAGE_H - 76, {
    align: "center",
  });

  // ── 2. Summary ───────────────────────────────────────────────────────
  doc.addPage();
  let y = sectionHeader(doc, "1. Summary", "A one-page overview of the selected period.", MARGIN + 10);
  y = drawStatGrid(
    doc,
    [
      { label: "Days Included", value: String(data.summary.daysIncluded) },
      { label: "Goal", value: goalLabel },
      {
        label: "Current Weight",
        value: data.summary.currentWeightKg !== null ? `${data.summary.currentWeightKg} kg` : "—",
      },
      { label: "Goal Weight", value: `${data.summary.goalWeightKg} kg` },
      { label: "Average Calories/day", value: `${data.summary.avgCalories} kcal`, accent: EMBER },
      { label: "Average Protein/day", value: `${data.summary.avgProtein} g`, accent: NOVA_DARK },
      { label: "Average Carbs/day", value: `${data.summary.avgCarbs} g`, accent: NOVA_DARK },
      { label: "Average Fats/day", value: `${data.summary.avgFats} g`, accent: NOVA_DARK },
      { label: "Average Water Intake", value: `${(data.summary.avgWaterMl / 1000).toFixed(2)} L`, accent: AURORA },
      { label: "Consistency Score", value: `${data.summary.consistencyScore}%` },
      {
        label: "Days Goal Achieved",
        value: `${data.summary.daysGoalAchieved}/${data.summary.daysIncluded}`,
        accent: SUCCESS,
      },
    ],
    y
  );

  // ── 3. Weight Progress ───────────────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "2. Weight Progress", "Logged body weight across the selected period.", MARGIN + 10);
  if (data.weight.series.length > 0) {
    const img = renderLineChart(
      data.weight.series.map((w) => w.date),
      [{ label: "Weight (kg)", color: NOVA, values: data.weight.series.map((w) => w.weightKg) }]
    );
    y = fitImage(doc, img, y, CHART_W / CHART_H);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...hexToRgb(TEXT_MUTED));
    doc.text("No weight entries were logged during this period.", MARGIN, y + 20);
    y += 50;
  }
  drawStatGrid(
    doc,
    [
      { label: "Start Weight", value: data.weight.startWeightKg !== null ? `${data.weight.startWeightKg} kg` : "—" },
      { label: "End Weight", value: data.weight.endWeightKg !== null ? `${data.weight.endWeightKg} kg` : "—" },
      {
        label: "Weight Change",
        value: data.weight.changeKg !== null ? `${data.weight.changeKg >= 0 ? "+" : ""}${data.weight.changeKg} kg` : "—",
        accent: data.weight.changeKg !== null && data.weight.changeKg < 0 ? EMBER : SUCCESS,
      },
      {
        label: "Weekly Avg Gain/Loss",
        value:
          data.weight.weeklyAvgChangeKg !== null
            ? `${data.weight.weeklyAvgChangeKg >= 0 ? "+" : ""}${data.weight.weeklyAvgChangeKg} kg/wk`
            : "—",
      },
    ],
    y,
    4
  );

  // ── 4. Nutrition Trends ──────────────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "3. Nutrition Trends", "Calories, protein, carbs and fats over time.", MARGIN + 10);
  const dates = data.days.map((d) => d.date);
  const img2 = renderLineChart(dates, [
    { label: "Calories", color: EMBER, values: data.days.map((d) => (d.hasData ? d.calories : null)) },
    { label: "Protein", color: NOVA, values: data.days.map((d) => (d.hasData ? d.protein : null)) },
    { label: "Carbs", color: AURORA, values: data.days.map((d) => (d.hasData ? d.carbs : null)) },
    { label: "Fats", color: "#9793c2", values: data.days.map((d) => (d.hasData ? d.fats : null)) },
  ]);
  y = fitImage(doc, img2, y, CHART_W / CHART_H);
  y = drawStatGrid(
    doc,
    [
      { label: "Highest Calories", value: `${data.nutrition.highestCalories} kcal`, accent: EMBER },
      { label: "Lowest Calories", value: `${data.nutrition.lowestCalories} kcal`, accent: EMBER },
      { label: "Average Calories", value: `${data.nutrition.avgCalories} kcal`, accent: EMBER },
    ],
    y
  );
  drawStatGrid(
    doc,
    [
      { label: "Highest Protein", value: `${data.nutrition.highestProtein} g`, accent: NOVA_DARK },
      { label: "Average Protein", value: `${data.nutrition.avgProtein} g`, accent: NOVA_DARK },
    ],
    y,
    2
  );

  // ── 5. Water Intake ──────────────────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "4. Water Intake", "Daily hydration versus your goal.", MARGIN + 10);
  const img3 = renderBarChartWithGoal(
    dates,
    data.days.map((d) => d.waterMl),
    data.water.goalMl,
    AURORA,
    NOVA_DARK
  );
  y = fitImage(doc, img3, y, CHART_W / CHART_H);
  drawStatGrid(
    doc,
    [
      { label: "Water Goal", value: `${(data.water.goalMl / 1000).toFixed(2)} L`, accent: AURORA },
      { label: "Average Intake", value: `${(data.water.avgMl / 1000).toFixed(2)} L`, accent: AURORA },
      {
        label: "Best Day",
        value: data.water.bestDay ? `${formatDateShort(data.water.bestDay.date)} · ${(data.water.bestDay.waterMl / 1000).toFixed(2)}L` : "—",
      },
      { label: "Goal Completion %", value: `${data.water.completionPct}%`, accent: SUCCESS },
    ],
    y,
    4
  );

  // ── 6. Daily Breakdown ───────────────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "5. Daily Breakdown", "The complete day-by-day log for this period.", MARGIN + 10);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Date", "Calories", "Protein", "Carbs", "Fat", "Water", "Weight", "Goal Met"]],
    body: data.days.map((d) => [
      formatDateShort(d.date),
      d.hasData ? String(d.calories) : "—",
      d.hasData ? `${d.protein}g` : "—",
      d.hasData ? `${d.carbs}g` : "—",
      d.hasData ? `${d.fats}g` : "—",
      d.waterMl > 0 ? `${(d.waterMl / 1000).toFixed(2)}L` : "—",
      d.weightKg !== null ? `${d.weightKg}kg` : "—",
      d.hasData ? (d.calorieGoalMet ? "Yes" : "No") : "—",
    ]),
    styles: { fontSize: 8.5, cellPadding: 5, textColor: hexToRgb(TEXT) },
    headStyles: { fillColor: hexToRgb(NOVA_DARK), textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: hexToRgb(BG_SOFT) },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 7) {
        if (hookData.cell.raw === "Yes") hookData.cell.styles.textColor = hexToRgb(SUCCESS);
        else if (hookData.cell.raw === "No") hookData.cell.styles.textColor = hexToRgb(TEXT_MUTED);
      }
    },
  });

  // ── 7. Food Consumption Analysis ─────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "6. Food Consumption Analysis", "Your most-logged foods this period.", MARGIN + 10);
  if (data.foods.length > 0) {
    const top = data.foods.slice(0, 10);
    const img4 = renderTopFoodsChart(
      top.map((f) => f.name),
      top.map((f) => f.daysLogged),
      NOVA
    );
    const aspect = CHART_W / (Math.max(180, top.length * 34 + 40));
    y = fitImage(doc, img4, y, aspect);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Food", "Days Logged", "Total Qty", "Total Calories"]],
      body: top.map((f) => [f.name, `${f.daysLogged}`, `${Math.round(f.totalQuantity)} ${f.unit}`, `${f.totalCalories} kcal`]),
      styles: { fontSize: 9, cellPadding: 5, textColor: hexToRgb(TEXT) },
      headStyles: { fillColor: hexToRgb(NOVA_DARK), textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: hexToRgb(BG_SOFT) },
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...hexToRgb(TEXT_MUTED));
    doc.text("No foods were logged during this period.", MARGIN, y + 20);
  }

  // ── 8. Goal Achievement ──────────────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "7. Goal Achievement", "How often each daily goal was met.", MARGIN + 10);
  y = drawStatGrid(
    doc,
    [
      {
        label: "Calories Goal",
        value: `${data.goalAchievement.calorieDays} / ${data.goalAchievement.totalDays} days`,
        accent: EMBER,
      },
      {
        label: "Protein Goal",
        value: `${data.goalAchievement.proteinDays} / ${data.goalAchievement.totalDays} days`,
        accent: NOVA_DARK,
      },
      {
        label: "Water Goal",
        value: `${data.goalAchievement.waterDays} / ${data.goalAchievement.totalDays} days`,
        accent: AURORA,
      },
    ],
    y
  );
  drawStatGrid(
    doc,
    [{ label: "Checklist Completion", value: `${data.goalAchievement.checklistCompletionPct}%`, accent: SUCCESS }],
    y,
    3
  );

  // ── 9. Achievements ──────────────────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "8. Achievements", "Milestones unlocked during this period.", MARGIN + 10);
  if (data.achievements.length > 0) {
    for (const a of data.achievements) {
      doc.setFillColor(...hexToRgb(BG_SOFT));
      doc.setDrawColor(...hexToRgb(BORDER));
      doc.roundedRect(MARGIN, y, CONTENT_W, 44, 6, 6, "FD");
      doc.setTextColor(...hexToRgb(SUCCESS));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("\u2713", MARGIN + 14, y + 27);
      doc.setTextColor(...hexToRgb(TEXT));
      doc.text(a.title, MARGIN + 32, y + 19);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...hexToRgb(TEXT_MUTED));
      doc.text(a.description, MARGIN + 32, y + 34);
      doc.setFontSize(8.5);
      doc.text(formatDateShort(a.achievedAt), PAGE_W - MARGIN - 14, y + 22, { align: "right" });
      y += 54;
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...hexToRgb(TEXT_MUTED));
    doc.text("No new milestones were unlocked during this period.", MARGIN, y + 20);
  }

  // ── 10. AI Insights ──────────────────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "9. AI Insights", "An automatically generated summary of this period.", MARGIN + 10);
  doc.setFillColor(...hexToRgb(BG_SOFT));
  doc.setDrawColor(...hexToRgb(BORDER));
  const boxH = Math.max(120, aiBullets.length * 34 + 30);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 8, 8, "FD");
  let iy = y + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...hexToRgb(TEXT));
  doc.text("Overall Summary", MARGIN + 16, iy);
  iy += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const bullet of aiBullets) {
    const lines = doc.splitTextToSize(`•  ${bullet}`, CONTENT_W - 32);
    doc.setTextColor(...hexToRgb(TEXT));
    doc.text(lines, MARGIN + 16, iy);
    iy += lines.length * 14 + 6;
  }

  // ── 11. Appendix ─────────────────────────────────────────────────────
  doc.addPage();
  y = sectionHeader(doc, "10. Appendix", "Detailed daily food logs for this period.", MARGIN + 10);
  const loggedDays = data.dayDetails.filter((d) => d.items.length > 0);
  if (loggedDays.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...hexToRgb(TEXT_MUTED));
    doc.text("No food logs were recorded during this period.", MARGIN, y + 20);
  } else {
    for (const day of loggedDays) {
      if (y > PAGE_H - 140) {
        doc.addPage();
        y = MARGIN + 10;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...hexToRgb(NOVA_DARK));
      doc.text(formatDateLabel(day.date), MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...hexToRgb(TEXT_MUTED));
      doc.text(
        `${day.calories} kcal · ${day.protein}g protein · ${day.carbs}g carbs · ${day.fats}g fat · ${(day.waterMl / 1000).toFixed(2)}L water${
          day.weightKg !== null ? ` · ${day.weightKg}kg` : ""
        }`,
        MARGIN,
        y + 14
      );
      y += 26;

      const rows = day.items.map((it) => [
        it.name,
        `${it.quantity} ${it.unit === "count" ? "" : it.unit}`.trim(),
        `${it.calories} kcal`,
      ]);
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Food", "Quantity", "Calories"]],
        body: rows,
        styles: { fontSize: 8.5, cellPadding: 4, textColor: hexToRgb(TEXT) },
        headStyles: { fillColor: hexToRgb(BORDER), textColor: hexToRgb(TEXT), fontStyle: "bold" },
        theme: "grid",
        tableWidth: CONTENT_W,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 20;
    }
  }

  // ── Footers on every page ────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p === 1) continue; // cover page has its own footer-free design
    addFooter(doc, p, totalPages, generatedOn);
  }

  return doc;
}
