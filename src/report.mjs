import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const THEME_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "report-themes"
);
const DEFAULT_THEME_NAME = "minimal";
const LAYOUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "report-layouts"
);
const require = createRequire(import.meta.url);

const renderLayout = (name, context) => {
  const normalized = String(name).trim().toLowerCase();
  if (!/^[a-z0-9-_]+$/.test(normalized)) {
    throw new Error(`Invalid layout name "${name}".`);
  }
  const layoutPath = path.join(LAYOUT_DIR, `${normalized}.cjs`);
  if (!fs.existsSync(layoutPath)) {
    throw new Error(`Unknown report layout "${name}".`);
  }
  const layoutModule = require(layoutPath);
  if (!layoutModule || typeof layoutModule.render !== "function") {
    throw new Error(`Layout "${name}" does not export a render() function.`);
  }
  return layoutModule.render(context);
};

const loadThemeByName = (name) => {
  const normalized = String(name).trim().toLowerCase();
  if (!/^[a-z0-9-_]+$/.test(normalized)) {
    throw new Error(`Invalid theme name "${name}".`);
  }
  const themePath = path.join(THEME_DIR, `${normalized}.json`);
  if (!fs.existsSync(themePath)) {
    throw new Error(`Unknown report theme "${name}".`);
  }
  const raw = fs.readFileSync(themePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse theme "${name}": ${error.message}`);
  }
};

const resolveThemeName = (themeValue) => {
  if (typeof themeValue === "string" && themeValue.trim().length > 0) {
    return themeValue.trim().toLowerCase();
  }
  return DEFAULT_THEME_NAME;
};

const resolveThemeTokens = (themeValue) => {
  const baseTheme = loadThemeByName(DEFAULT_THEME_NAME);
  if (typeof themeValue === "string" && themeValue.trim().length > 0) {
    return { ...baseTheme, ...loadThemeByName(themeValue) };
  }
  if (themeValue && typeof themeValue === "object" && !Array.isArray(themeValue)) {
    return { ...baseTheme, ...themeValue };
  }
  return baseTheme;
};

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

function formatNumber(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(decimals);
}

function formatDelta(value, { decimals = 2, unit = "", direction = "higher" } = {}) {
  if (value == null || Number.isNaN(value)) return { text: "-", className: "delta-flat" };
  if (value === 0) return { text: "0", className: "delta-flat" };
  const sign = value > 0 ? "+" : "-";
  const absText = formatNumber(Math.abs(value), decimals);
  const text = `${sign}${absText}${unit}`;
  if (direction === "neutral") return { text, className: "delta-flat" };
  const isGood = direction === "higher" ? value > 0 : value < 0;
  return { text, className: isGood ? "delta-up" : "delta-down" };
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

const CLOC_Y_MAX_TIERS = [
  2000,
  5000,
  10000,
  25000,
  50000,
  100000,
  250000,
  500000,
  1000000,
  2000000,
];

const DURATION_MS_TIERS = [100, 250, 500, 1000, 2000, 3000];
const DURATION_S_TIERS = [5, 10, 20, 30, 60, 120, 300, 600];
const DURATION_MS_THRESHOLD = 3000;

const getTieredMax = (value, tiers) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  for (const tier of tiers) {
    if (value <= tier) return tier;
  }
  return tiers[tiers.length - 1] ?? null;
};

const getClocTieredMax = (value) => getTieredMax(value, CLOC_Y_MAX_TIERS);

const getDurationMaxMs = (series) => {
  let maxValue = null;
  for (const point of series) {
    const value = point?.testsSummary?.durationMs;
    if (typeof value !== "number" || Number.isNaN(value)) continue;
    if (maxValue == null || value > maxValue) {
      maxValue = value;
    }
  }
  return maxValue;
};

const getMaxSeriesValue = (series) => {
  let maxValue = null;
  for (const line of series) {
    for (const point of line.points ?? []) {
      if (typeof point.value !== "number" || Number.isNaN(point.value)) continue;
      if (maxValue == null || point.value > maxValue) {
        maxValue = point.value;
      }
    }
  }
  return maxValue;
};

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
  const themeName = resolveThemeName(reportConfig.theme);
  const theme = resolveThemeTokens(reportConfig.theme ?? DEFAULT_THEME_NAME);
  const layoutName = theme.layout ?? (themeName === "neon-hud" ? "hud" : "minimal");
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

  const latestSeries = metricsSeries.at(-1) ?? null;
  const previousSeries = metricsSeries.length > 1 ? metricsSeries.at(-2) : null;
  const deltaCoverage =
    latestSeries?.coverageOverall?.lines?.pct != null && previousSeries?.coverageOverall?.lines?.pct != null
      ? latestSeries.coverageOverall.lines.pct - previousSeries.coverageOverall.lines.pct
      : null;
  const deltaPassRate =
    latestSeries?.testsSummary?.passRate != null && previousSeries?.testsSummary?.passRate != null
      ? latestSeries.testsSummary.passRate - previousSeries.testsSummary.passRate
      : null;
  const deltaDurationMs =
    latestSeries?.testsSummary?.durationMs != null && previousSeries?.testsSummary?.durationMs != null
      ? latestSeries.testsSummary.durationMs - previousSeries.testsSummary.durationMs
      : null;
  const deltaCloc =
    latestSeries?.clocTotal != null && previousSeries?.clocTotal != null
      ? latestSeries.clocTotal - previousSeries.clocTotal
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
  const clocSeriesMax = getMaxSeriesValue(clocSeries);
  const clocHasData = clocSeriesMax != null;
  const clocChart =
    clocChartConfig.enabled === false || !clocHasData
      ? ""
      : svgMultiLineChart({
          title: clocChartConfig.title ?? "Code lines (from cloc snapshots)",
          yMin: clocChartConfig.yMin ?? 0,
          yMax: clocChartConfig.yMax ?? getClocTieredMax(clocSeriesMax) ?? 50000,
          series: clocSeries,
          chart: chartConfig,
        });
  const clocMissingMessage =
    clocChartConfig.enabled === false || clocHasData
      ? ""
      : `<div class="card">
        <div class="chart-title">Code lines</div>
        <div class="empty">Install <code>cloc</code> to enable code lines metrics (https://github.com/AlDanial/cloc).</div>
      </div>`;

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
  const durationMaxMs = getDurationMaxMs(metricsSeries);
  const canAutoTierDuration = passRateChartConfig.yRightMax == null && durationMaxMs != null;
  const useDurationMs = canAutoTierDuration && durationMaxMs < DURATION_MS_THRESHOLD;
  const durationUnit = useDurationMs ? "ms" : "s";
  const durationMax = canAutoTierDuration
    ? useDurationMs
      ? getTieredMax(durationMaxMs, DURATION_MS_TIERS)
      : getTieredMax(durationMaxMs / 1000, DURATION_S_TIERS)
    : null;
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
              name: `Duration (${durationUnit})`,
              color: passRateChartConfig.durationColor ?? "#edc949",
              points: metricsSeries.map((p) => ({
                label: p.label,
                value:
                  p.testsSummary?.durationMs != null
                    ? useDurationMs
                      ? p.testsSummary.durationMs
                      : p.testsSummary.durationMs / 1000
                    : null,
              })),
            },
          ],
          yLeftMin: passRateChartConfig.yLeftMin ?? 0,
          yLeftMax: passRateChartConfig.yLeftMax ?? 100,
          yRightMin: passRateChartConfig.yRightMin ?? 0,
          yRightMax: passRateChartConfig.yRightMax ?? durationMax ?? 10,
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

  const coverageDelta = formatDelta(deltaCoverage, { decimals: 2, unit: "%", direction: "higher" });
  const passRateDelta = formatDelta(deltaPassRate, { decimals: 2, unit: "%", direction: "higher" });
  const durationDelta = formatDelta(
    deltaDurationMs != null ? deltaDurationMs / 1000 : null,
    { decimals: 2, unit: "s", direction: "lower" }
  );
  const clocDelta = formatDelta(deltaCloc, { decimals: 0, unit: "", direction: "neutral" });

  const generatedStamp = formatDateShort(new Date(), useLocalTime);
  const reportTitle = reportConfig.title ?? "Metrics Report";

  // Gamification helpers
  const getLevelFromCoverage = (pct) => {
    if (pct == null) return { level: 1, title: "NOVICE", color: "#ff6b6b" };
    if (pct >= 95) return { level: 10, title: "LEGEND", color: "#ffd700" };
    if (pct >= 90) return { level: 9, title: "MASTER", color: "#ff9f43" };
    if (pct >= 85) return { level: 8, title: "EXPERT", color: "#ee5a6f" };
    if (pct >= 80) return { level: 7, title: "ELITE", color: "#a55eea" };
    if (pct >= 75) return { level: 6, title: "VETERAN", color: "#26de81" };
    if (pct >= 70) return { level: 5, title: "ADEPT", color: "#20bf6b" };
    if (pct >= 60) return { level: 4, title: "SKILLED", color: "#45aaf2" };
    if (pct >= 50) return { level: 3, title: "APPRENTICE", color: "#4b7bec" };
    if (pct >= 40) return { level: 2, title: "TRAINEE", color: "#778ca3" };
    return { level: 1, title: "NOVICE", color: "#ff6b6b" };
  };

  const getPassRateRank = (rate) => {
    if (rate == null) return { rank: "F", color: "#ff6b6b", glow: "rgba(255, 107, 107, 0.5)" };
    if (rate >= 99) return { rank: "S", color: "#ffd700", glow: "rgba(255, 215, 0, 0.6)" };
    if (rate >= 95) return { rank: "A", color: "#26de81", glow: "rgba(38, 222, 129, 0.5)" };
    if (rate >= 90) return { rank: "B", color: "#45aaf2", glow: "rgba(69, 170, 242, 0.5)" };
    if (rate >= 80) return { rank: "C", color: "#fdcb6e", glow: "rgba(253, 203, 110, 0.5)" };
    if (rate >= 70) return { rank: "D", color: "#ff9f43", glow: "rgba(255, 159, 67, 0.5)" };
    return { rank: "F", color: "#ff6b6b", glow: "rgba(255, 107, 107, 0.5)" };
  };

  const coverageLevel = getLevelFromCoverage(latestCoverage?.overall?.lines?.pct);
  const passRateRank = getPassRateRank(latestTestSummary?.summary?.passRate);

  const { css, body } = renderLayout(layoutName, {
    theme,
    reportTitle,
    reportConfig,
    generatedStamp,
    latestCoverage,
    latestTestSummary,
    latestCloc,
    coverageDelta,
    passRateDelta,
    durationDelta,
    clocDelta,
    clocChart,
    clocMissingMessage,
    coverageChart,
    passRateDurationChart,
    testCategoryChart,
    formatNumber,
    formatDuration,
    formatDateShort,
    useLocalTime,
    coverageLevel,
    passRateRank,
  });
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${reportTitle}</title>
    <style>
${css}
    </style>
  </head>
  <body>
${body}
  </body>
</html>`;


  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, html, "utf8");
  return reportPath;
}
