import fs from "fs";
import path from "path";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseTimestamp = (value, format, useLocalTime) => {
  const tokens = [];
  const tokenRegex = /YYYY|YY|MM|DD|HH|mm|ss/g;
  let regexSource = "";
  let lastIndex = 0;

  for (const match of format.matchAll(tokenRegex)) {
    const token = match[0];
    const index = match.index ?? 0;
    regexSource += escapeRegex(format.slice(lastIndex, index));
    tokens.push(token);
    switch (token) {
      case "YYYY":
        regexSource += "(\\d{4})";
        break;
      case "YY":
        regexSource += "(\\d{2})";
        break;
      default:
        regexSource += "(\\d{2})";
        break;
    }
    lastIndex = index + token.length;
  }
  regexSource += escapeRegex(format.slice(lastIndex));

  const match = value.match(new RegExp(`^${regexSource}$`));
  if (!match) return null;

  const parts = Object.fromEntries(
    tokens.map((token, idx) => [token, Number(match[idx + 1])])
  );

  const year = parts.YYYY ?? (parts.YY != null ? 2000 + parts.YY : 0);
  const month = (parts.MM ?? 1) - 1;
  const day = parts.DD ?? 1;
  const hour = parts.HH ?? 0;
  const minute = parts.mm ?? 0;
  const second = parts.ss ?? 0;

  return useLocalTime
    ? new Date(year, month, day, hour, minute, second)
    : new Date(Date.UTC(year, month, day, hour, minute, second));
};

function parseTimestampFromName(name, config) {
  const pattern = config.history?.filePattern ?? "metrics-{timestamp}.json";
  const format = config.history?.timestampFormat ?? "DD.MM.YY.HH.mm.ss";
  const regexSource =
    config.history?.fileRegex ??
    `^${escapeRegex(pattern).replace("\\{timestamp\\}", "(.+)")}$`;
  const match = name.match(new RegExp(regexSource));
  if (!match) return null;
  const timestampValue = match[1] ?? match[0];
  return parseTimestamp(timestampValue, format, config.history?.useLocalTime);
}

function formatDateShort(date, useLocalTime) {
  if (!date) return "";
  if (!useLocalTime) {
    return date.toISOString().replace("T", " ").slice(0, 16);
  }
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return "-";
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(2)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  if (minutes < 60) return `${minutes}m ${seconds.toFixed(1)}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes - hours * 60;
  return `${hours}h ${remMinutes}m`;
}

function readMetricsFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const generatedAt = data.generatedAt ? new Date(data.generatedAt) : null;
  const clocTotal = data?.cloc?.total?.code ?? null;
  const clocTs = data?.cloc?.ts?.code ?? null;
  const clocTsx = data?.cloc?.tsx?.code ?? null;
  const coverageOverall = data?.coverage?.overall ?? null;
  const testCategories = data?.tests?.categories ?? {};
  const testsSummary = data?.tests?.summary ?? null;
  return {
    generatedAt,
    clocTotal,
    clocTs,
    clocTsx,
    coverageOverall,
    testCategories,
    testsSummary,
    raw: data,
  };
}

function listMetricFiles(dir, prefix, config) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => ({
      name,
      path: path.join(dir, name),
      date: parseTimestampFromName(name, config),
    }))
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date);
}

function svgMultiLineChart({ title, series, yMin, yMax, chart }) {
  const width = chart?.width ?? 900;
  const height = chart?.height ?? 260;
  const pad = chart?.padding ?? { top: 28, right: 16, bottom: 42, left: 60 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const labels = series[0]?.points.map((p) => p.label) ?? [];
  if (labels.length === 0) {
    return `<div class="empty">No data</div>`;
  }

  let minVal = yMin ?? Infinity;
  let maxVal = yMax ?? -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.value == null || Number.isNaN(p.value)) continue;
      if (yMin == null) minVal = Math.min(minVal, p.value);
      if (yMax == null) maxVal = Math.max(maxVal, p.value);
    }
  }
  if (!Number.isFinite(minVal)) minVal = 0;
  if (!Number.isFinite(maxVal)) maxVal = 1;
  if (minVal === maxVal) {
    minVal -= 1;
    maxVal += 1;
  }

  const xStep = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const yScale = (val) => pad.top + (innerH - ((val - minVal) / (maxVal - minVal)) * innerH);

  const yTicks = chart?.yTicks ?? 5;
  const yTickLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minVal + ((maxVal - minVal) * i) / yTicks;
    const y = yScale(val);
    return `<g>
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="grid" />
      <text x="${pad.left - 8}" y="${y + 4}" class="axis-label" text-anchor="end">${val.toFixed(2)}</text>
    </g>`;
  }).join("");

  const labelStep = Math.max(1, Math.ceil(labels.length / (chart?.maxLabels ?? 8)));
  const xLabels = labels
    .map((label, i) => {
      if (i % labelStep !== 0 && i !== labels.length - 1) return "";
      const x = pad.left + i * xStep;
      return `<text x="${x}" y="${height - 10}" class="axis-label" text-anchor="middle">${label}</text>`;
    })
    .join("");

  const lines = series
    .map((s) => {
      const points = s.points
        .map((p, i) => {
          const x = pad.left + i * xStep;
          const y = yScale(p.value ?? minVal);
          return `${x},${y}`;
        })
        .join(" ");
      return `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${points}" />`;
    })
    .join("");

  const dots = series
    .map((s) =>
      s.points
        .map((p, i) => {
          const x = pad.left + i * xStep;
          const y = yScale(p.value ?? minVal);
          return `<circle cx="${x}" cy="${y}" r="2.5" fill="${s.color}" />`;
        })
        .join("")
    )
    .join("");

  const legend = series
    .map(
      (s) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.name}</span>`
    )
    .join("");

  return `
    <div class="chart">
      <div class="chart-title">${title}</div>
      <div class="legend">${legend}</div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
        ${yTickLines}
        <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" class="axis" />
        <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" class="axis" />
        ${lines}
        ${dots}
        ${xLabels}
      </svg>
    </div>
  `;
}

function svgDualAxisChart({
  title,
  leftSeries,
  rightSeries,
  yLeftMin,
  yLeftMax,
  yRightMin,
  yRightMax,
  chart,
}) {
  const width = chart?.width ?? 900;
  const height = chart?.height ?? 260;
  const basePad = chart?.padding ?? { top: 28, right: 16, bottom: 42, left: 60 };
  const pad = { ...basePad, right: chart?.dualAxisPaddingRight ?? 60 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const labels =
    leftSeries?.[0]?.points.map((p) => p.label) ??
    rightSeries?.[0]?.points.map((p) => p.label) ??
    [];
  if (labels.length === 0) {
    return `<div class="empty">No data</div>`;
  }

  let leftMin = yLeftMin ?? Infinity;
  let leftMax = yLeftMax ?? -Infinity;
  for (const s of leftSeries ?? []) {
    for (const p of s.points) {
      if (p.value == null || Number.isNaN(p.value)) continue;
      if (yLeftMin == null) leftMin = Math.min(leftMin, p.value);
      if (yLeftMax == null) leftMax = Math.max(leftMax, p.value);
    }
  }
  if (!Number.isFinite(leftMin)) leftMin = 0;
  if (!Number.isFinite(leftMax)) leftMax = 1;
  if (leftMin === leftMax) {
    leftMin -= 1;
    leftMax += 1;
  }

  let rightMin = yRightMin ?? Infinity;
  let rightMax = yRightMax ?? -Infinity;
  for (const s of rightSeries ?? []) {
    for (const p of s.points) {
      if (p.value == null || Number.isNaN(p.value)) continue;
      if (yRightMin == null) rightMin = Math.min(rightMin, p.value);
      if (yRightMax == null) rightMax = Math.max(rightMax, p.value);
    }
  }
  if (!Number.isFinite(rightMin)) rightMin = 0;
  if (!Number.isFinite(rightMax)) rightMax = 1;
  if (rightMin === rightMax) {
    rightMin -= 1;
    rightMax += 1;
  }

  const xStep = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const yScaleLeft = (val) =>
    pad.top + (innerH - ((val - leftMin) / (leftMax - leftMin)) * innerH);
  const yScaleRight = (val) =>
    pad.top + (innerH - ((val - rightMin) / (rightMax - rightMin)) * innerH);

  const yTicks = chart?.yTicks ?? 5;
  const yTickLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = leftMin + ((leftMax - leftMin) * i) / yTicks;
    const y = yScaleLeft(val);
    return `<g>
      <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="grid" />
      <text x="${pad.left - 8}" y="${y + 4}" class="axis-label" text-anchor="end">${val.toFixed(2)}</text>
    </g>`;
  }).join("");

  const rightTickLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = rightMin + ((rightMax - rightMin) * i) / yTicks;
    const y = yScaleRight(val);
    return `<text x="${width - pad.right + 8}" y="${y + 4}" class="axis-label" text-anchor="start">${val.toFixed(2)}</text>`;
  }).join("");

  const labelStep = Math.max(1, Math.ceil(labels.length / (chart?.maxLabels ?? 8)));
  const xLabels = labels
    .map((label, i) => {
      if (i % labelStep !== 0 && i !== labels.length - 1) return "";
      const x = pad.left + i * xStep;
      return `<text x="${x}" y="${height - 10}" class="axis-label" text-anchor="middle">${label}</text>`;
    })
    .join("");

  const lineForSeries = (series, scale) =>
    (series ?? [])
      .map((s) => {
        const points = s.points
          .map((p, i) => {
            const x = pad.left + i * xStep;
            const y = scale(p.value ?? (scale === yScaleLeft ? leftMin : rightMin));
            return `${x},${y}`;
          })
          .join(" ");
        return `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${points}" />`;
      })
      .join("");

  const dotsForSeries = (series, scale) =>
    (series ?? [])
      .map((s) =>
        s.points
          .map((p, i) => {
            const x = pad.left + i * xStep;
            const y = scale(p.value ?? (scale === yScaleLeft ? leftMin : rightMin));
            return `<circle cx="${x}" cy="${y}" r="2.5" fill="${s.color}" />`;
          })
          .join("")
      )
      .join("");

  const legend = [...(leftSeries ?? []), ...(rightSeries ?? [])]
    .map(
      (s) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.name}</span>`
    )
    .join("");

  return `
    <div class="chart">
      <div class="chart-title">${title}</div>
      <div class="legend">${legend}</div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
        ${yTickLines}
        <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" class="axis" />
        <line x1="${width - pad.right}" y1="${pad.top}" x2="${width - pad.right}" y2="${height - pad.bottom}" class="axis" />
        <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" class="axis" />
        ${lineForSeries(leftSeries, yScaleLeft)}
        ${lineForSeries(rightSeries, yScaleRight)}
        ${dotsForSeries(leftSeries, yScaleLeft)}
        ${dotsForSeries(rightSeries, yScaleRight)}
        ${xLabels}
        ${rightTickLines}
      </svg>
    </div>
  `;
}

function svgBarChart({ title, items, yMax = 100, chart }) {
  const width = chart?.width ?? 900;
  const rowH = chart?.bar?.rowHeight ?? 28;
  const pad =
    chart?.bar?.padding ?? { top: 28, right: 24, bottom: 20, left: 140 };
  const height = pad.top + pad.bottom + items.length * rowH;
  const innerW = width - pad.left - pad.right;

  if (!items.length) {
    return `<div class="empty">No data</div>`;
  }

  const rows = items
    .map((item, idx) => {
      const y = pad.top + idx * rowH;
      const value = Math.max(0, Math.min(yMax, item.value ?? 0));
      const barW = (value / yMax) * innerW;
      return `
        <text x="${pad.left - 8}" y="${y + 18}" class="axis-label" text-anchor="end">${item.label}</text>
        <rect x="${pad.left}" y="${y + 6}" width="${barW}" height="12" rx="6" fill="${item.color}" />
        <text x="${pad.left + barW + 6}" y="${y + 18}" class="axis-label">${value.toFixed(2)}%</text>
      `;
    })
    .join("");

  const grid = [0, 25, 50, 75, 100]
    .map((tick) => {
      const x = pad.left + (tick / yMax) * innerW;
      return `
        <line x1="${x}" y1="${pad.top - 6}" x2="${x}" y2="${height - pad.bottom}" class="grid" />
        <text x="${x}" y="${height - 4}" class="axis-label" text-anchor="middle">${tick}%</text>
      `;
    })
    .join("");

  return `
    <div class="chart">
      <div class="chart-title">${title}</div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
        ${grid}
        ${rows}
      </svg>
    </div>
  `;
}

export function buildReport(config) {
  const root = config.cwd;
  const metricsDir = path.resolve(root, config.metricsDir);
  const historyDir = path.resolve(root, config.historyDir);
  const reportDir = path.resolve(root, config.reportDir);
  const reportPath = path.resolve(root, config.reportFile);
  const reportConfig = config.report ?? {};
  const chartConfig = reportConfig.chart ?? {};
  const theme = reportConfig.theme ?? {};
  const useLocalTime = reportConfig.useLocalTime ?? false;

  const historyPattern = config.history?.filePattern ?? "metrics-{timestamp}.json";
  const prefix = historyPattern.split("{timestamp}")[0] ?? "";
  const metricFiles = listMetricFiles(historyDir, prefix, config);

  const metricsSeries = metricFiles.map((file) => {
    const parsed = readMetricsFile(file.path);
    const date = parsed.generatedAt || file.date;
    return {
      date,
      label: formatDateShort(date, useLocalTime),
      clocTotal: parsed.clocTotal,
      clocTs: parsed.clocTs,
      clocTsx: parsed.clocTsx,
      coverageOverall: parsed.coverageOverall,
      testsSummary: parsed.testsSummary,
    };
  });

  const latestPath = path.resolve(root, config.metricsFile);
  const latestParsed = fs.existsSync(latestPath) ? readMetricsFile(latestPath) : null;
  const latestFallback = metricsSeries.at(-1) ?? null;
  const latestCloc = latestParsed
    ? {
        total: latestParsed.clocTotal,
        ts: latestParsed.clocTs,
        tsx: latestParsed.clocTsx,
        date: latestParsed.generatedAt,
      }
    : latestFallback
      ? {
          total: latestFallback.clocTotal,
          ts: latestFallback.clocTs,
          tsx: latestFallback.clocTsx,
          date: latestFallback.date,
        }
      : null;
  const latestCoverage = latestParsed?.coverageOverall
    ? { overall: latestParsed.coverageOverall, date: latestParsed.generatedAt }
    : latestFallback?.coverageOverall
      ? { overall: latestFallback.coverageOverall, date: latestFallback.date }
      : null;
  const latestTestCategories = latestParsed?.testCategories ?? {};
  const latestTestSummary = latestParsed?.testsSummary
    ? { summary: latestParsed.testsSummary, date: latestParsed.generatedAt }
    : latestFallback?.testsSummary
      ? { summary: latestFallback.testsSummary, date: latestFallback.date }
      : null;

  const clocChartConfig = reportConfig.charts?.cloc ?? {};
  const clocSeries = [];
  if (clocChartConfig.showTotal !== false) {
    clocSeries.push({
      name: "Total code",
      color: clocChartConfig.colors?.total ?? "#4c78a8",
      points: metricsSeries.map((p) => ({ label: p.label, value: p.clocTotal })),
    });
  }
  if (clocChartConfig.showTs !== false) {
    clocSeries.push({
      name: "TS code",
      color: clocChartConfig.colors?.ts ?? "#f58518",
      points: metricsSeries.map((p) => ({ label: p.label, value: p.clocTs })),
    });
  }
  if (clocChartConfig.showTsx !== false) {
    clocSeries.push({
      name: "TSX code",
      color: clocChartConfig.colors?.tsx ?? "#54a24b",
      points: metricsSeries.map((p) => ({ label: p.label, value: p.clocTsx })),
    });
  }
  const clocChart =
    clocChartConfig.enabled === false
      ? ""
      : svgMultiLineChart({
          title: clocChartConfig.title ?? "Code lines (from cloc snapshots)",
          yMin: clocChartConfig.yMin ?? 0,
          yMax: clocChartConfig.yMax ?? 50000,
          series: clocSeries,
          chart: chartConfig,
        });

  const coverageChartConfig = reportConfig.charts?.coverage ?? {};
  const coverageMetric = coverageChartConfig.metric ?? "lines";
  const coverageChart =
    coverageChartConfig.enabled === false
      ? ""
      : svgMultiLineChart({
          title: coverageChartConfig.title ?? "Overall coverage (Lines%)",
          series: [
            {
              name: `${coverageMetric}%`,
              color: coverageChartConfig.color ?? "#e45756",
              points: metricsSeries.map((p) => ({
                label: p.label,
                value: p.coverageOverall?.[coverageMetric]?.pct ?? null,
              })),
            },
          ],
          yMin: coverageChartConfig.yMin ?? 0,
          yMax: coverageChartConfig.yMax ?? 100,
          chart: chartConfig,
        });

  const passRateChartConfig = reportConfig.charts?.passRateDuration ?? {};
  const passRateDurationChart =
    passRateChartConfig.enabled === false
      ? ""
      : svgDualAxisChart({
          title: passRateChartConfig.title ?? "Tests pass rate vs duration",
          leftSeries: [
            {
              name: "Pass rate (%)",
              color: passRateChartConfig.passRateColor ?? "#59a14f",
              points: metricsSeries.map((p) => ({
                label: p.label,
                value: p.testsSummary?.passRate ?? null,
              })),
            },
          ],
          rightSeries: [
            {
              name: "Duration (s)",
              color: passRateChartConfig.durationColor ?? "#edc949",
              points: metricsSeries.map((p) => ({
                label: p.label,
                value: p.testsSummary?.durationMs != null ? p.testsSummary.durationMs / 1000 : null,
              })),
            },
          ],
          yLeftMin: passRateChartConfig.yLeftMin ?? 0,
          yLeftMax: passRateChartConfig.yLeftMax ?? 100,
          yRightMin: passRateChartConfig.yRightMin ?? 0,
          yRightMax: passRateChartConfig.yRightMax ?? 10,
          chart: chartConfig,
        });

  const testCategoryChartConfig = reportConfig.charts?.testCategoryCoverage ?? {};
  const testCategoryMetric = testCategoryChartConfig.metric ?? "coveragePct";
  const testCategoryChart =
    testCategoryChartConfig.enabled === false
      ? ""
      : svgBarChart({
          title: testCategoryChartConfig.title ?? "Test Category Coverage (latest)",
          items: Object.entries(latestTestCategories).map(([name, item]) => {
            let value = item?.[testCategoryMetric];
            if (testCategoryMetric === "passRate") {
              value = item?.results?.passRate ?? 0;
            } else if (testCategoryMetric === "durationMs") {
              value = item?.results?.durationMs ?? 0;
            } else if (testCategoryMetric === "durationSeconds") {
              value = item?.results?.durationMs != null ? item.results.durationMs / 1000 : 0;
            }
            return {
              label: name,
              value: value ?? 0,
              color: testCategoryChartConfig.color ?? "#72b7b2",
            };
          }),
          yMax: testCategoryChartConfig.yMax ?? 100,
          chart: chartConfig,
        });

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${reportConfig.title ?? "Metrics Report"}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: ${theme.background ?? "#0f1115"};
        --bg-accent: ${theme.backgroundAccent ?? "#1a1f2b"};
        --panel: ${theme.panel ?? "#171a21"};
        --muted: ${theme.muted ?? "#a3acc2"};
        --text: ${theme.text ?? "#e6e9ef"};
        --grid: ${theme.grid ?? "#2a2f3a"};
        --axis: ${theme.axis ?? "#4b5263"};
      }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
        background: radial-gradient(1200px 500px at 20% 0%, var(--bg-accent), var(--bg));
        color: var(--text);
      }
      main {
        max-width: 1000px;
        margin: 0 auto;
        padding: 32px 24px 56px;
      }
      h1 {
        font-size: 28px;
        letter-spacing: 0.2px;
        margin: 0 0 6px;
      }
      .sub {
        color: var(--muted);
        margin-bottom: 24px;
      }
      .card {
        background: var(--panel);
        border: 1px solid #222836;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.18);
      }
      .grid {
        stroke: var(--grid);
        stroke-width: 1;
      }
      .axis {
        stroke: var(--axis);
        stroke-width: 1;
      }
      .axis-label {
        fill: var(--muted);
        font-size: 10px;
      }
      .chart-title {
        font-size: 16px;
        margin-bottom: 8px;
      }
      .legend {
        display: flex;
        gap: 12px;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 12px;
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th, td {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid #232a38;
      }
      th {
        color: var(--muted);
        font-weight: 600;
      }
      .empty {
        color: var(--muted);
        padding: 12px 0;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${reportConfig.title ?? "Metrics Report"}</h1>
      ${
        reportConfig.subtitle
          ? `<div class="sub">${reportConfig.subtitle.replace(
              "{date}",
              formatDateShort(new Date(), useLocalTime)
            )}</div>`
          : ""
      }

      ${clocChart ? `<div class="card">${clocChart}</div>` : ""}

      ${coverageChart ? `<div class="card">${coverageChart}</div>` : ""}

      ${passRateDurationChart ? `<div class="card">${passRateDurationChart}</div>` : ""}

      ${testCategoryChart ? `<div class="card">${testCategoryChart}</div>` : ""}

      ${
        reportConfig.table?.enabled !== false
          ? `<div class="card">
        <div class="chart-title">Latest snapshot</div>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${
              reportConfig.table?.showCloc !== false
                ? `<tr>
              <td>Total code lines</td>
              <td>${latestCloc?.total ?? "-"}</td>
              <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
            </tr>
            <tr>
              <td>TS code lines</td>
              <td>${latestCloc?.ts ?? "-"}</td>
              <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
            </tr>
            <tr>
              <td>TSX code lines</td>
              <td>${latestCloc?.tsx ?? "-"}</td>
              <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
            </tr>`
                : ""
            }
            ${
              reportConfig.table?.showCoverage !== false
                ? `<tr>
              <td>Coverage (Lines%)</td>
              <td>${latestCoverage?.overall?.lines?.pct?.toFixed(2) ?? "-"}</td>
              <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
            </tr>
            <tr>
              <td>Coverage (Funcs%)</td>
              <td>${latestCoverage?.overall?.functions?.pct?.toFixed(2) ?? "-"}</td>
              <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
            </tr>
            <tr>
              <td>Coverage (Branch%)</td>
              <td>${latestCoverage?.overall?.branches?.pct?.toFixed(2) ?? "-"}</td>
              <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
            </tr>
            <tr>
              <td>Coverage (Stmts%)</td>
              <td>${latestCoverage?.overall?.statements?.pct?.toFixed(2) ?? "-"}</td>
              <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
            </tr>`
                : ""
            }
            ${
              reportConfig.table?.showTests !== false
                ? `<tr>
              <td>Tests pass rate</td>
              <td>${latestTestSummary?.summary?.passRate != null
                ? `${latestTestSummary.summary.passRate.toFixed(2)}%`
                : "-"}</td>
              <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
            </tr>
            <tr>
              <td>Tests duration</td>
              <td>${latestTestSummary?.summary?.durationMs != null
                ? formatDuration(latestTestSummary.summary.durationMs)
                : "-"}</td>
              <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
            </tr>
            <tr>
              <td>Tests total (passed/failed/skipped)</td>
              <td>${latestTestSummary?.summary
                ? `${latestTestSummary.summary.total} (${latestTestSummary.summary.passed}/${latestTestSummary.summary.failed}/${latestTestSummary.summary.skipped})`
                : "-"}</td>
              <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
            </tr>`
                : ""
            }
          </tbody>
        </table>
      </div>`
          : ""
      }
    </main>
  </body>
</html>`;

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, html, "utf8");
  return reportPath;
}
