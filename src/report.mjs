import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const THEME_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "report-themes"
);
const DEFAULT_THEME_NAME = "minimal";

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

  const cssMinimal = `
      @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap");

      :root {
        color-scheme: ${theme.colorScheme ?? "light"};
        --bg: ${theme.bg ?? "#f4f2ec"};
        --bg-panel: ${theme.bgPanel ?? "#fbf8f1"};
        --bg-card: ${theme.bgCard ?? "#f1ede6"};
        --ink: ${theme.ink ?? "#1b1a17"};
        --muted: ${theme.muted ?? "#6a665f"};
        --grid: ${theme.grid ?? "#d7d1c6"};
        --axis: ${theme.axis ?? "#a19a8e"};
        --neon-cyan: ${theme.neonCyan ?? "#1f6f5c"};
        --neon-pink: ${theme.neonPink ?? "#a44f67"};
        --neon-yellow: ${theme.neonYellow ?? "#c5972e"};
        --neon-green: ${theme.neonGreen ?? "#2f855a"};
        --neon-purple: ${theme.neonPurple ?? "#6b5aa9"};
        --neon-orange: ${theme.neonOrange ?? "#d06b3d"};
        --border: ${theme.border ?? "rgba(27, 26, 23, 0.12)"};
        --shadow: ${theme.shadow ?? "0 24px 40px rgba(41, 36, 28, 0.12)"};
        --radius: ${theme.radius ?? "8px"};
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
        background: var(--bg);
        color: var(--ink);
      }

      main {
        max-width: 980px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }

      h1, h2, h3 {
        margin: 0;
        font-weight: 600;
      }

      h1 {
        font-size: 28px;
        letter-spacing: -0.01em;
      }

      .header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: end;
        margin-bottom: 24px;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.24em;
        font-size: 10px;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .sub {
        color: var(--muted);
        margin-top: 8px;
        font-size: 14px;
      }

      .stamp {
        font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 11px;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 6px 12px;
        color: var(--muted);
        background: var(--bg-panel);
      }

      .section-label {
        text-transform: uppercase;
        letter-spacing: 0.2em;
        font-size: 10px;
        color: var(--muted);
        margin: 24px 0 10px;
      }

      .card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 16px;
        box-shadow: var(--shadow);
        margin-bottom: 16px;
      }

      .chart-title {
        font-size: 14px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .chart-title::after {
        content: "";
        height: 2px;
        width: 48px;
        background: linear-gradient(90deg, var(--neon-cyan), transparent);
        border-radius: 999px;
      }

      .overview {
        display: grid;
        gap: 12px;
      }

      .metric-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
      }

      .metric-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .metric-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
      }

      .metric-value {
        font-size: 22px;
        font-weight: 600;
      }

      .metric-meta {
        text-align: right;
        display: grid;
        gap: 4px;
      }

      .metric-note {
        font-size: 12px;
        color: var(--muted);
      }

      .delta {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .delta-up {
        color: var(--neon-green);
      }

      .delta-down {
        color: var(--neon-pink);
      }

      .delta-flat {
        color: var(--muted);
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

      .chart svg {
        width: 100%;
        height: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      th, td {
        text-align: left;
        padding: 10px;
        border-bottom: 1px solid var(--border);
      }

      th {
        color: var(--muted);
        font-weight: 600;
      }

      .code {
        background: #1e1b17;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 12px;
        font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
        color: #bfe5d2;
        margin-top: 10px;
      }

      .empty {
        color: var(--muted);
        padding: 12px 0;
      }

      @media (max-width: 840px) {
        .header {
          grid-template-columns: 1fr;
          align-items: start;
        }
        .stamp {
          justify-self: start;
        }
        .metric-row {
          flex-direction: column;
          align-items: flex-start;
        }
        .metric-meta {
          text-align: left;
        }
      }
  `;

  const cssHud = `
      @import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap");

      :root {
        color-scheme: ${theme.colorScheme ?? "dark"};
        --bg: ${theme.bg ?? "#0a0a0f"};
        --bg-panel: ${theme.bgPanel ?? "#12121a"};
        --bg-card: ${theme.bgCard ?? "#1a1a25"};
        --ink: ${theme.ink ?? "#e8e8f0"};
        --muted: ${theme.muted ?? "#6b6b80"};
        --grid: ${theme.grid ?? "#252535"};
        --axis: ${theme.axis ?? "#3a3a50"};
        --neon-cyan: ${theme.neonCyan ?? "#00f5ff"};
        --neon-pink: ${theme.neonPink ?? "#ff006e"};
        --neon-yellow: ${theme.neonYellow ?? "#ffea00"};
        --neon-green: ${theme.neonGreen ?? "#39ff14"};
        --neon-purple: ${theme.neonPurple ?? "#bf00ff"};
        --neon-orange: ${theme.neonOrange ?? "#ff6b35"};
        --border: ${theme.border ?? "rgba(0, 245, 255, 0.2)"};
        --shadow: ${theme.shadow ?? "0 0 40px rgba(0, 245, 255, 0.1)"};
        --radius: ${theme.radius ?? "4px"};
        --scanline: ${theme.scanline ?? "rgba(0, 0, 0, 0.1)"};
        --grid-line: ${theme.gridLine ?? "rgba(0, 245, 255, 0.03)"};
        --title-glow: ${theme.titleGlow ?? "rgba(0, 245, 255, 0.5)"};
        --top-glow: ${theme.topGlow ?? "rgba(0, 245, 255, 0.05)"};
        --eyebrow-glow: ${theme.eyebrowGlow ?? "rgba(0, 245, 255, 0.5)"};
        --stamp-glow: ${theme.stampGlow ?? "rgba(255, 234, 0, 0.1)"};
        --section-glow: ${theme.sectionGlow ?? "rgba(191, 0, 255, 0.4)"};
        --card-glow: ${theme.cardGlow ?? "0 0 0 1px rgba(0, 245, 255, 0.1), inset 0 0 40px rgba(0, 245, 255, 0.02)"};
        --panel-divider: ${theme.panelDivider ?? "rgba(0, 245, 255, 0.2)"};
        --stat-card-glow: ${theme.statCardGlow ?? "rgba(0, 245, 255, 0.05)"};
        --stat-card-border: ${theme.statCardBorder ?? "rgba(0, 245, 255, 0.15)"};
        --stat-card-border-hover: ${theme.statCardBorderHover ?? "rgba(0, 245, 255, 0.4)"};
        --stat-card-shadow: ${theme.statCardShadow ?? "0 0 30px rgba(0, 245, 255, 0.1)"};
        --progress-track: ${theme.progressTrack ?? "rgba(0, 0, 0, 0.4)"};
        --progress-border: ${theme.progressBorder ?? "rgba(255, 255, 255, 0.1)"};
        --progress-shimmer: ${theme.progressShimmer ?? "rgba(255, 255, 255, 0.3)"};
        --progress-health: ${theme.progressHealth ?? "linear-gradient(90deg, #ff4757, #ff6b81, #ff4757)"};
        --progress-health-glow: ${theme.progressHealthGlow ?? "0 0 10px rgba(255, 71, 87, 0.5)"};
        --progress-xp: ${theme.progressXp ?? "linear-gradient(90deg, #3742fa, #5352ed, #3742fa)"};
        --progress-xp-glow: ${theme.progressXpGlow ?? "0 0 10px rgba(55, 66, 250, 0.5)"};
        --progress-energy: ${theme.progressEnergy ?? "linear-gradient(90deg, #2ed573, #7bed9f, #2ed573)"};
        --progress-energy-glow: ${theme.progressEnergyGlow ?? "0 0 10px rgba(46, 213, 115, 0.5)"};
        --progress-mana: ${theme.progressMana ?? "linear-gradient(90deg, #00d2d3, #54a0ff, #00d2d3)"};
        --progress-mana-glow: ${theme.progressManaGlow ?? "0 0 10px rgba(0, 210, 211, 0.5)"};
        --level-badge-bg: ${theme.levelBadgeBg ?? "rgba(255, 215, 0, 0.1)"};
        --level-badge-border: ${theme.levelBadgeBorder ?? "rgba(255, 215, 0, 0.3)"};
        --level-badge-color: ${theme.levelBadgeColor ?? "#ffd700"};
        --level-badge-glow: ${theme.levelBadgeGlow ?? "rgba(255, 215, 0, 0.5)"};
        --delta-up-bg: ${theme.deltaUpBg ?? "rgba(57, 255, 20, 0.1)"};
        --delta-up-border: ${theme.deltaUpBorder ?? "rgba(57, 255, 20, 0.3)"};
        --delta-up-glow: ${theme.deltaUpGlow ?? "rgba(57, 255, 20, 0.5)"};
        --delta-down-bg: ${theme.deltaDownBg ?? "rgba(255, 0, 110, 0.1)"};
        --delta-down-border: ${theme.deltaDownBorder ?? "rgba(255, 0, 110, 0.3)"};
        --delta-down-glow: ${theme.deltaDownGlow ?? "rgba(255, 0, 110, 0.5)"};
        --delta-flat-bg: ${theme.deltaFlatBg ?? "rgba(107, 107, 128, 0.1)"};
        --delta-flat-border: ${theme.deltaFlatBorder ?? "rgba(107, 107, 128, 0.3)"};
        --code-bg: ${theme.codeBg ?? "#0d0d12"};
        --code-ink: ${theme.codeInk ?? "#39ff14"};
        --code-glow: ${theme.codeGlow ?? "rgba(57, 255, 20, 0.3)"};
        --table-border: ${theme.tableBorder ?? "rgba(0, 245, 255, 0.1)"};
        --table-hover: ${theme.tableHover ?? "rgba(0, 245, 255, 0.03)"};
        --xp-bg: ${theme.xpBg ?? "linear-gradient(135deg, rgba(191, 0, 255, 0.08), transparent)"};
        --xp-border: ${theme.xpBorder ?? "rgba(191, 0, 255, 0.2)"};
        --achievement-bg: ${theme.achievementBg ?? "rgba(255, 234, 0, 0.05)"};
        --achievement-border: ${theme.achievementBorder ?? "rgba(255, 234, 0, 0.15)"};
        --achievement-icon-glow: ${theme.achievementIconGlow ?? "rgba(255, 234, 0, 0.3)"};
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Rajdhani", "Segoe UI", system-ui, sans-serif;
        background: var(--bg);
        color: var(--ink);
        min-height: 100vh;
        overflow-x: hidden;
      }

      /* CRT Scanline Effect */
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          var(--scanline),
          var(--scanline) 1px,
          transparent 1px,
          transparent 2px
        );
        pointer-events: none;
        z-index: 1000;
        opacity: 0.5;
      }

      /* Grid Background */
      body::after {
        content: "";
        position: fixed;
        inset: 0;
        background-image: 
          linear-gradient(var(--grid-line) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
        background-size: 50px 50px;
        pointer-events: none;
        z-index: 0;
      }

      main {
        max-width: 1280px;
        margin: 0 auto;
        padding: 32px 24px 72px;
        position: relative;
        z-index: 1;
      }

      h1, h2, h3 {
        font-family: "Orbitron", "Rajdhani", sans-serif;
        font-weight: 700;
        margin: 0;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      h1 {
        font-size: 28px;
        background: linear-gradient(90deg, var(--neon-cyan), var(--neon-pink));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 0 20px var(--title-glow));
      }

      /* Header */
      .top {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 24px;
        align-items: start;
        margin-bottom: 32px;
        padding: 24px;
        background: linear-gradient(135deg, var(--bg-panel), var(--top-glow));
        border: 1px solid var(--border);
        border-radius: var(--radius);
        position: relative;
        overflow: hidden;
      }

      .top::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, var(--neon-cyan), var(--neon-pink), var(--neon-yellow));
        animation: scanline 3s linear infinite;
      }

      @keyframes scanline {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .eyebrow {
        font-family: "Share Tech Mono", monospace;
        text-transform: uppercase;
        letter-spacing: 0.3em;
        font-size: 11px;
        color: var(--neon-cyan);
        margin-bottom: 8px;
        text-shadow: 0 0 10px var(--eyebrow-glow);
      }

      .sub {
        color: var(--muted);
        margin-top: 8px;
        font-size: 14px;
        letter-spacing: 0.05em;
      }

      .stamp {
        font-family: "Share Tech Mono", monospace;
        font-size: 11px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 8px 16px;
        color: var(--neon-yellow);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        box-shadow: 0 0 20px var(--stamp-glow);
      }

      /* Layout */
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
        gap: 24px;
      }

      .rail {
        display: grid;
        gap: 20px;
        align-content: start;
      }

      .deck {
        display: grid;
        gap: 20px;
      }

      .section-label {
        font-family: "Orbitron", sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        font-size: 12px;
        color: var(--neon-purple);
        margin: 0 0 12px;
        text-shadow: 0 0 15px var(--section-glow);
      }

      /* Cards - HUD Style */
      .card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 20px;
        position: relative;
        overflow: hidden;
        box-shadow: var(--card-glow);
      }

      /* Corner accents */
      .card::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        border-top: 2px solid var(--neon-cyan);
        border-left: 2px solid var(--neon-cyan);
        border-radius: var(--radius) 0 0 0;
      }

      .card::after {
        content: "";
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        border-bottom: 2px solid var(--neon-pink);
        border-right: 2px solid var(--neon-pink);
        border-radius: 0 0 var(--radius) 0;
      }

      .card > * {
        position: relative;
        z-index: 1;
      }

      .card--chart {
        padding: 24px;
      }

      /* Panel Title */
      .panel-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: "Orbitron", sans-serif;
        font-size: 12px;
        color: var(--neon-cyan);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--panel-divider);
      }

      /* Stat Cards - Gaming Style */
      .stat-card {
        display: grid;
        gap: 12px;
        padding: 16px;
        background: linear-gradient(135deg, var(--stat-card-glow), transparent);
        border: 1px solid var(--stat-card-border);
        border-radius: var(--radius);
        position: relative;
        transition: all 0.3s ease;
      }

      .stat-card:hover {
        border-color: var(--stat-card-border-hover);
        box-shadow: var(--stat-card-shadow);
      }

      .stat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .stat-label {
        font-family: "Share Tech Mono", monospace;
        color: var(--muted);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.15em;
      }

      .stat-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }

      .stat-value-row {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }

      .stat-value {
        font-family: "Orbitron", sans-serif;
        font-size: 32px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .stat-rank {
        font-family: "Orbitron", sans-serif;
        font-size: 24px;
        font-weight: 900;
        padding: 4px 12px;
        border-radius: var(--radius);
        text-shadow: 0 0 20px currentColor;
      }

      /* Progress Bars - Health/XP Style */
      .progress-container {
        display: grid;
        gap: 8px;
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        font-family: "Share Tech Mono", monospace;
        font-size: 10px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .progress-bar {
        height: 8px;
        background: var(--progress-track);
        border-radius: 4px;
        overflow: hidden;
        position: relative;
        border: 1px solid var(--progress-border);
      }

      .progress-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 1s ease-out;
        position: relative;
        overflow: hidden;
      }

      .progress-fill::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, var(--progress-shimmer), transparent);
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .progress-fill.health {
        background: var(--progress-health);
        box-shadow: var(--progress-health-glow);
      }

      .progress-fill.xp {
        background: var(--progress-xp);
        box-shadow: var(--progress-xp-glow);
      }

      .progress-fill.energy {
        background: var(--progress-energy);
        box-shadow: var(--progress-energy-glow);
      }

      .progress-fill.mana {
        background: var(--progress-mana);
        box-shadow: var(--progress-mana-glow);
      }

      /* Level Badge */
      .level-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: var(--level-badge-bg);
        border: 1px solid var(--level-badge-border);
        border-radius: var(--radius);
        font-family: "Orbitron", sans-serif;
        font-size: 11px;
        color: var(--level-badge-color);
        text-shadow: 0 0 10px var(--level-badge-glow);
      }

      .level-num {
        font-size: 14px;
        font-weight: 700;
      }

      /* Delta indicators */
      .delta {
        font-family: "Share Tech Mono", monospace;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 4px 8px;
        border-radius: 3px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .delta-up {
        color: var(--neon-green);
        background: var(--delta-up-bg);
        border: 1px solid var(--delta-up-border);
        text-shadow: 0 0 10px var(--delta-up-glow);
      }

      .delta-down {
        color: var(--neon-pink);
        background: var(--delta-down-bg);
        border: 1px solid var(--delta-down-border);
        text-shadow: 0 0 10px var(--delta-down-glow);
      }

      .delta-flat {
        color: var(--muted);
        background: var(--delta-flat-bg);
        border: 1px solid var(--delta-flat-border);
      }

      /* Code block */
      .info {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.6;
        letter-spacing: 0.02em;
      }

      .code {
        background: var(--code-bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 16px;
        font-family: "Share Tech Mono", ui-monospace, monospace;
        font-size: 12px;
        color: var(--code-ink);
        margin-top: 12px;
        text-shadow: 0 0 5px var(--code-glow);
      }

      /* Charts */
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
        font-family: "Share Tech Mono", monospace;
      }

      .chart-title {
        font-family: "Orbitron", sans-serif;
        font-size: 14px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--neon-cyan);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .chart-title::after {
        content: "";
        height: 2px;
        flex: 1;
        margin-left: 16px;
        background: linear-gradient(90deg, var(--neon-cyan), transparent);
        border-radius: 999px;
      }

      .legend {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;
        color: var(--muted);
        font-size: 11px;
        font-family: "Share Tech Mono", monospace;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        box-shadow: 0 0 10px currentColor;
      }

      .chart svg {
        width: 100%;
        height: auto;
      }

      /* Table */
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      th, td {
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid var(--table-border);
      }

      th {
        font-family: "Orbitron", sans-serif;
        color: var(--neon-cyan);
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      td {
        color: var(--ink);
        font-family: "Rajdhani", sans-serif;
      }

      tr:hover td {
        background: var(--table-hover);
      }

      .empty {
        color: var(--muted);
        padding: 16px;
        font-family: "Share Tech Mono", monospace;
        text-align: center;
      }

      /* Stat Stack */
      .stat-stack {
        display: grid;
        gap: 16px;
      }

      /* XP Bar Section */
      .xp-section {
        display: grid;
        gap: 12px;
        padding: 16px;
        background: var(--xp-bg);
        border: 1px solid var(--xp-border);
        border-radius: var(--radius);
      }

      .xp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .xp-title {
        font-family: "Orbitron", sans-serif;
        font-size: 11px;
        color: var(--neon-purple);
        text-transform: uppercase;
        letter-spacing: 0.15em;
      }

      .xp-value {
        font-family: "Share Tech Mono", monospace;
        font-size: 12px;
        color: var(--neon-yellow);
      }

      /* Achievement Badges */
      .achievement {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--achievement-bg);
        border: 1px solid var(--achievement-border);
        border-radius: var(--radius);
      }

      .achievement-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--neon-yellow), var(--neon-orange));
        border-radius: 50%;
        font-size: 20px;
        box-shadow: 0 0 20px var(--achievement-icon-glow);
      }

      .achievement-info {
        flex: 1;
      }

      .achievement-name {
        font-family: "Orbitron", sans-serif;
        font-size: 12px;
        color: var(--neon-yellow);
        letter-spacing: 0.05em;
      }

      .achievement-desc {
        font-size: 11px;
        color: var(--muted);
        margin-top: 2px;
      }

      /* Divider */
      .divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--border), transparent);
        margin: 16px 0;
      }

      .muted-line {
        font-size: 11px;
        color: var(--muted);
        font-family: "Share Tech Mono", monospace;
        text-align: center;
        letter-spacing: 0.05em;
      }

      /* Responsive */
      @media (max-width: 980px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .top {
          grid-template-columns: 1fr;
          align-items: start;
        }
        .stamp {
          justify-self: start;
        }
      }

      /* Animations */
      @keyframes glitch {
        0%, 100% { transform: translate(0); }
        20% { transform: translate(-2px, 2px); }
        40% { transform: translate(-2px, -2px); }
        60% { transform: translate(2px, 2px); }
        80% { transform: translate(2px, -2px); }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .reveal {
        animation: fadeUp 600ms ease forwards;
      }

      .reveal:nth-child(2) { animation-delay: 80ms; }
      .reveal:nth-child(3) { animation-delay: 160ms; }
      .reveal:nth-child(4) { animation-delay: 240ms; }
      .reveal:nth-child(5) { animation-delay: 320ms; }

      .glitch:hover {
        animation: glitch 0.3s ease infinite;
      }

      .pulse {
        animation: pulse 2s ease infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .reveal, .pulse, .glitch {
          animation: none;
        }
      }
  `;

  const bodyMinimal = `
    <main>
      <header class="header">
        <div>
          <div class="eyebrow">Metrics report</div>
          <h1>${reportTitle}</h1>
          ${
            reportConfig.subtitle
              ? `<div class="sub">${reportConfig.subtitle.replace(
                  "{date}",
                  generatedStamp
                )}</div>`
              : `<div class="sub">Generated ${generatedStamp}.</div>`
          }
        </div>
        <div class="stamp">Generated ${generatedStamp}</div>
      </header>

      <section class="card">
        <div class="chart-title">Overview</div>
        <div class="overview">
          <div class="metric-row">
            <div>
              <div class="metric-label">Coverage (lines)</div>
              <div class="metric-value">${latestCoverage?.overall?.lines?.pct != null ? `${formatNumber(latestCoverage.overall.lines.pct, 2)}%` : "-"}</div>
            </div>
            <div class="metric-meta">
              <div class="delta ${coverageDelta.className}">${coverageDelta.text}</div>
              <div class="metric-note">Change vs previous run</div>
            </div>
          </div>
          <div class="metric-row">
            <div>
              <div class="metric-label">Pass rate</div>
              <div class="metric-value">${latestTestSummary?.summary?.passRate != null ? `${formatNumber(latestTestSummary.summary.passRate, 2)}%` : "-"}</div>
            </div>
            <div class="metric-meta">
              <div class="delta ${passRateDelta.className}">${passRateDelta.text}</div>
              <div class="metric-note">Test success ratio</div>
            </div>
          </div>
          <div class="metric-row">
            <div>
              <div class="metric-label">Test duration</div>
              <div class="metric-value">${latestTestSummary?.summary?.durationMs != null ? formatDuration(latestTestSummary.summary.durationMs) : "-"}</div>
            </div>
            <div class="metric-meta">
              <div class="delta ${durationDelta.className}">${durationDelta.text}</div>
              <div class="metric-note">Lower is better</div>
            </div>
          </div>
          <div class="metric-row">
            <div>
              <div class="metric-label">Code lines</div>
              <div class="metric-value">${latestCloc?.total ?? "-"}</div>
            </div>
            <div class="metric-meta">
              <div class="delta ${clocDelta.className}">${clocDelta.text}</div>
              <div class="metric-note">Total LOC snapshot</div>
            </div>
          </div>
        </div>
      </section>

      <div class="section-label">Trends</div>
      ${clocChart ? `<div class="card">${clocChart}</div>` : ""}
      ${clocMissingMessage}

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

      <div class="card">
        <div class="chart-title">Quick commands</div>
        <div class="code">
          npx @gfdlr/lighthouse-metrics run<br />
          npx @gfdlr/lighthouse-metrics serve --open
        </div>
      </div>
    </main>
  `;

  const bodyHud = `
    <main>
      <div class="top reveal">
        <div>
          <div class="eyebrow">⚡ Developer Metrics HUD v2.0</div>
          <h1 class="glitch">${reportTitle}</h1>
          ${
            reportConfig.subtitle
              ? `<div class="sub">${reportConfig.subtitle.replace(
                  "{date}",
                  generatedStamp
                )}</div>`
              : `<div class="sub">Session recorded: ${generatedStamp}</div>`
          }
        </div>
        <div class="stamp pulse">● LIVE // ${generatedStamp}</div>
      </div>

      <div class="layout">
        <aside class="rail">
          <div class="card reveal">
            <div class="panel-title">
              <span>⚔️ Player Stats</span>
              <span class="level-badge">
                <span>LVL</span>
                <span class="level-num">${coverageLevel.level}</span>
              </span>
            </div>
            
            <div class="stat-stack">
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">❤️ Coverage Health</span>
                  <span class="stat-rank" style="color: ${coverageLevel.color}; text-shadow: 0 0 15px ${coverageLevel.color};">${coverageLevel.title}</span>
                </div>
                <div class="stat-value-row">
                  <span class="stat-value" style="color: ${coverageLevel.color};">${latestCoverage?.overall?.lines?.pct != null ? formatNumber(latestCoverage.overall.lines.pct, 1) : "--"}%</span>
                  <span class="delta ${coverageDelta.className}">${coverageDelta.text}</span>
                </div>
                <div class="progress-container" style="margin-top: 8px;">
                  <div class="progress-bar">
                    <div class="progress-fill health" style="width: ${latestCoverage?.overall?.lines?.pct ?? 0}%"></div>
                  </div>
                  <div class="progress-header">
                    <span>HP</span>
                    <span>${Math.round(latestCoverage?.overall?.lines?.pct ?? 0)}/100</span>
                  </div>
                </div>
              </div>
              
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">⭐ Pass Rate Rank</span>
                  <span class="stat-rank" style="color: ${passRateRank.color}; text-shadow: 0 0 15px ${passRateRank.glow};">${passRateRank.rank}</span>
                </div>
                <div class="stat-value-row">
                  <span class="stat-value" style="color: ${passRateRank.color};">${latestTestSummary?.summary?.passRate != null ? formatNumber(latestTestSummary.summary.passRate, 1) : "--"}%</span>
                  <span class="delta ${passRateDelta.className}">${passRateDelta.text}</span>
                </div>
                <div class="progress-container" style="margin-top: 8px;">
                  <div class="progress-bar">
                    <div class="progress-fill energy" style="width: ${latestTestSummary?.summary?.passRate ?? 0}%"></div>
                  </div>
                  <div class="progress-header">
                    <span>XP</span>
                    <span>${Math.round(latestTestSummary?.summary?.passRate ?? 0)}/100</span>
                  </div>
                </div>
              </div>
              
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">⚡ Test Duration</span>
                  <span class="stat-icon">⏱️</span>
                </div>
                <div class="stat-value-row">
                  <span class="stat-value" style="color: var(--neon-yellow);">${latestTestSummary?.summary?.durationMs != null ? formatDuration(latestTestSummary.summary.durationMs) : "--"}</span>
                  <span class="delta ${durationDelta.className}">${durationDelta.text}</span>
                </div>
                <div class="progress-container" style="margin-top: 8px;">
                  <div class="progress-bar">
                    <div class="progress-fill mana" style="width: ${Math.min(100, (latestTestSummary?.summary?.durationMs ?? 0) / 100)}%"></div>
                  </div>
                  <div class="progress-header">
                    <span>MP</span>
                    <span>${latestTestSummary?.summary?.durationMs ?? 0}ms</span>
                  </div>
                </div>
              </div>
              
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">💎 Code Score</span>
                  <span class="stat-icon">💰</span>
                </div>
                <div class="stat-value-row">
                  <span class="stat-value" style="color: var(--neon-purple);">${latestCloc?.total?.toLocaleString() ?? "--"}</span>
                  <span class="delta ${clocDelta.className}">${clocDelta.text}</span>
                </div>
                <div class="progress-container" style="margin-top: 8px;">
                  <div class="progress-bar">
                    <div class="progress-fill xp" style="width: ${Math.min(100, Math.log10(latestCloc?.total ?? 1) * 10)}%"></div>
                  </div>
                  <div class="progress-header">
                    <span>LINES</span>
                    <span>${latestCloc?.total?.toLocaleString() ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="divider"></div>
            <div class="muted-line">◄ STATS COMPARED VS PREVIOUS RUN ►</div>
          </div>
          
          ${latestCoverage?.overall?.lines?.pct >= 80 ? `
          <div class="card reveal">
            <div class="panel-title">🏆 Achievement Unlocked</div>
            <div class="achievement">
              <div class="achievement-icon">🛡️</div>
              <div class="achievement-info">
                <div class="achievement-name">Code Guardian</div>
                <div class="achievement-desc">Reach 80%+ coverage</div>
              </div>
            </div>
          </div>
          ` : ""}

          <div class="card reveal">
            <div class="panel-title">⌨️ Command Terminal</div>
            <div class="info">Execute commands to rebuild metrics</div>
            <div class="code">
              > npx @gfdlr/lighthouse-metrics run<br />
              > npx @gfdlr/lighthouse-metrics serve --open<br />
              <span style="color: var(--muted);">_</span>
            </div>
          </div>
        </aside>

        <section class="deck">
          <div class="section-label reveal">📊 Mission Trends</div>
          ${clocChart ? `<div class="card card--chart reveal">${clocChart}</div>` : ""}
          ${clocMissingMessage}

          ${coverageChart ? `<div class="card card--chart reveal">${coverageChart}</div>` : ""}

          ${passRateDurationChart ? `<div class="card card--chart reveal">${passRateDurationChart}</div>` : ""}

          ${testCategoryChart ? `<div class="card card--chart reveal">${testCategoryChart}</div>` : ""}

          ${
            reportConfig.table?.enabled !== false
              ? `<div class="card reveal">
            <div class="chart-title">📋 Latest Snapshot Data</div>
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
                  <td>💎 Total Code Lines</td>
                  <td>${latestCloc?.total?.toLocaleString() ?? "-"}</td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>📘 TS Code Lines</td>
                  <td>${latestCloc?.ts?.toLocaleString() ?? "-"}</td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>📗 TSX Code Lines</td>
                  <td>${latestCloc?.tsx?.toLocaleString() ?? "-"}</td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>`
                    : ""
                }
                ${
                  reportConfig.table?.showCoverage !== false
                    ? `<tr>
                  <td>🎯 Coverage (Lines%)</td>
                  <td>${latestCoverage?.overall?.lines?.pct?.toFixed(2) ?? "-"}%</td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>🔧 Coverage (Funcs%)</td>
                  <td>${latestCoverage?.overall?.functions?.pct?.toFixed(2) ?? "-"}%</td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>🌿 Coverage (Branch%)</td>
                  <td>${latestCoverage?.overall?.branches?.pct?.toFixed(2) ?? "-"}%</td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>📝 Coverage (Stmts%)</td>
                  <td>${latestCoverage?.overall?.statements?.pct?.toFixed(2) ?? "-"}%</td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>`
                    : ""
                }
                ${
                  reportConfig.table?.showTests !== false
                    ? `<tr>
                  <td>✅ Tests Pass Rate</td>
                  <td>${latestTestSummary?.summary?.passRate != null
                    ? `${latestTestSummary.summary.passRate.toFixed(2)}%`
                    : "-"}</td>
                  <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>⏱️ Tests Duration</td>
                  <td>${latestTestSummary?.summary?.durationMs != null
                    ? formatDuration(latestTestSummary.summary.durationMs)
                    : "-"}</td>
                  <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>🎮 Tests Score (P/F/S)</td>
                  <td>${latestTestSummary?.summary
                    ? `${latestTestSummary.summary.total} <span style="color:var(--neon-green)">${latestTestSummary.summary.passed}</span>/<span style="color:var(--neon-pink)">${latestTestSummary.summary.failed}</span>/<span style="color:var(--neon-yellow)">${latestTestSummary.summary.skipped}</span>`
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
        </section>
      </div>
    </main>
  `;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${reportTitle}</title>
    <style>
${layoutName === "hud" ? cssHud : cssMinimal}
    </style>
  </head>
  <body>
${layoutName === "hud" ? bodyHud : bodyMinimal}
  </body>
</html>`;


  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, html, "utf8");
  return reportPath;
}
