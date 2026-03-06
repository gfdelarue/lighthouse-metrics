import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.mjs";
import { buildReport } from "../src/report.mjs";

const writeMetricsFiles = (root, data, extraHistory = []) => {
  const metricsDir = path.join(root, "metrics");
  const historyDir = path.join(metricsDir, "history");
  fs.mkdirSync(historyDir, { recursive: true });

  fs.writeFileSync(path.join(metricsDir, "metrics.json"), JSON.stringify(data, null, 2));
  fs.writeFileSync(
    path.join(historyDir, "metrics-01.02.25.12.30.00.json"),
    JSON.stringify(data, null, 2)
  );
  for (const { name, content } of extraHistory) {
    fs.writeFileSync(path.join(historyDir, name), JSON.stringify(content, null, 2));
  }
};

const createProject = async (data, overrides = {}, extraHistory = []) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
  const config = await loadConfig(root, overrides);
  writeMetricsFiles(root, data, extraHistory);
  return { root, config };
};

const baseData = {
  generatedAt: "2026-02-05T13:31:55.035Z",
  cloc: { total: { code: 120 } },
  tests: { summary: { passRate: 100, durationMs: 2500, total: 10, passed: 10, failed: 0, skipped: 0 } },
};

describe("report branch coverage - formatDuration", () => {
  it("handles null duration in test summary", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 120 } },
      tests: { summary: { passRate: 100, durationMs: null, total: 1, passed: 1, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Metrics report");
  });

  it("handles minute-range durations (60s-3600s)", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 120 } },
      tests: { summary: { passRate: 95, durationMs: 125000, total: 10, passed: 10, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("2m");
  });

  it("handles hour-range durations (>=3600s)", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 120 } },
      tests: { summary: { passRate: 90, durationMs: 7200000, total: 50, passed: 45, failed: 5, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("2h");
  });
});

describe("report branch coverage - cloc tiered max", () => {
  it("tiers cloc to 2000 for small codebases", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 500 } },
      tests: { summary: { passRate: 100, durationMs: 1200, total: 1, passed: 1, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("2000.00");
  });

  it("tiers cloc to 10000 for mid codebases", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 8000 } },
      tests: { summary: { passRate: 100, durationMs: 1200, total: 1, passed: 1, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("10000.00");
  });

  it("tiers cloc to largest tier for very large codebases", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 3000000 } },
      tests: { summary: { passRate: 100, durationMs: 1200, total: 1, passed: 1, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("2000000.00");
  });
});

describe("report branch coverage - delta formatting", () => {
  it("computes delta between two history entries", async () => {
    const previous = {
      generatedAt: "2026-01-05T12:00:00.000Z",
      cloc: { total: { code: 100 } },
      tests: { summary: { passRate: 90, durationMs: 2000, total: 10, passed: 9, failed: 1, skipped: 0 } },
      coverage: { overall: { lines: { pct: 70 }, functions: { pct: 60 }, branches: { pct: 50 }, statements: { pct: 65 } } },
    };
    const latest = {
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 150 } },
      tests: { summary: { passRate: 95, durationMs: 1800, total: 12, passed: 11, failed: 1, skipped: 0 } },
      coverage: { overall: { lines: { pct: 80 }, functions: { pct: 70 }, branches: { pct: 60 }, statements: { pct: 75 } } },
    };

    const { config } = await createProject(latest, {}, [
      { name: "metrics-01.01.25.12.00.00.json", content: previous },
    ]);

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    // Delta coverage should be +10.00%
    expect(html).toContain("+10.00%");
    // Delta cloc should show +50
    expect(html).toContain("+50");
  });

  it("shows delta-down for worse metrics", async () => {
    const previous = {
      generatedAt: "2026-01-05T12:00:00.000Z",
      cloc: { total: { code: 200 } },
      tests: { summary: { passRate: 100, durationMs: 1000, total: 10, passed: 10, failed: 0, skipped: 0 } },
      coverage: { overall: { lines: { pct: 90 }, functions: { pct: 80 }, branches: { pct: 70 }, statements: { pct: 85 } } },
    };
    const latest = {
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 180 } },
      tests: { summary: { passRate: 80, durationMs: 3000, total: 10, passed: 8, failed: 2, skipped: 0 } },
      coverage: { overall: { lines: { pct: 75 }, functions: { pct: 70 }, branches: { pct: 60 }, statements: { pct: 72 } } },
    };

    const { config } = await createProject(latest, {}, [
      { name: "metrics-01.01.25.12.00.00.json", content: previous },
    ]);

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("delta-down");
  });
});

describe("report branch coverage - chart disabled", () => {
  it("disables cloc chart when config says so", async () => {
    const { config } = await createProject(baseData, {
      report: { charts: { cloc: { enabled: false } } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).not.toContain("Code lines (from cloc snapshots)");
  });

  it("disables coverage chart when config says so", async () => {
    const { config } = await createProject(baseData, {
      report: { charts: { coverage: { enabled: false } } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).not.toContain("Overall coverage (Lines%)");
  });

  it("disables pass rate chart when config says so", async () => {
    const { config } = await createProject(baseData, {
      report: { charts: { passRateDuration: { enabled: false } } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).not.toContain("Tests pass rate vs duration");
  });

  it("disables test category chart when config says so", async () => {
    const { config } = await createProject(baseData, {
      report: { charts: { testCategoryCoverage: { enabled: false } } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).not.toContain("Test Category Coverage (latest)");
  });

  it("disables table when config says so", async () => {
    const { config } = await createProject(baseData, {
      report: { table: { enabled: false } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).not.toContain("<table>");
  });
});

describe("report branch coverage - cloc series toggles", () => {
  it("hides total series legend when showTotal is false", async () => {
    const { config } = await createProject(
      {
        generatedAt: "2026-02-05T13:31:55.035Z",
        cloc: { total: { code: 120 }, ts: { code: 80 }, tsx: { code: 40 } },
        tests: { summary: { passRate: 100, durationMs: 2500, total: 1, passed: 1, failed: 0, skipped: 0 } },
      },
      { report: { charts: { cloc: { showTotal: false } } } }
    );

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    // Legend in the chart should not include "Total code" series
    expect(html).not.toContain('"legend-dot" style="background:#4c78a8"');
    expect(html).toContain("TS code");
  });

  it("hides ts series legend when showTs is false", async () => {
    const { config } = await createProject(
      {
        generatedAt: "2026-02-05T13:31:55.035Z",
        cloc: { total: { code: 120 }, ts: { code: 80 }, tsx: { code: 40 } },
        tests: { summary: { passRate: 100, durationMs: 2500, total: 1, passed: 1, failed: 0, skipped: 0 } },
      },
      { report: { charts: { cloc: { showTs: false } } } }
    );

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    // The chart legend should not include TS code series (uses #f58518)
    expect(html).not.toContain('"legend-dot" style="background:#f58518"');
    expect(html).toContain("TSX code");
  });

  it("hides tsx series legend when showTsx is false", async () => {
    const { config } = await createProject(
      {
        generatedAt: "2026-02-05T13:31:55.035Z",
        cloc: { total: { code: 120 }, ts: { code: 80 }, tsx: { code: 40 } },
        tests: { summary: { passRate: 100, durationMs: 2500, total: 1, passed: 1, failed: 0, skipped: 0 } },
      },
      { report: { charts: { cloc: { showTsx: false } } } }
    );

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    // The chart legend should not include TSX code series (uses #54a24b)
    expect(html).not.toContain('"legend-dot" style="background:#54a24b"');
    expect(html).toContain("TS code");
  });
});

describe("report branch coverage - test categories", () => {
  it("renders test category bar chart with passRate metric", async () => {
    const { config } = await createProject(
      {
        generatedAt: "2026-02-05T13:31:55.035Z",
        cloc: { total: { code: 120 } },
        tests: {
          summary: { passRate: 100, durationMs: 2500, total: 10, passed: 10, failed: 0, skipped: 0 },
          categories: {
            unit: { coveragePct: 85, results: { passRate: 100, durationMs: 1000 } },
            api: { coveragePct: 70, results: { passRate: 95, durationMs: 500 } },
          },
        },
      },
      { report: { charts: { testCategoryCoverage: { metric: "passRate" } } } }
    );

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Test Category Coverage (latest)");
  });

  it("renders test category bar chart with durationMs metric", async () => {
    const { config } = await createProject(
      {
        generatedAt: "2026-02-05T13:31:55.035Z",
        cloc: { total: { code: 120 } },
        tests: {
          summary: { passRate: 100, durationMs: 2500, total: 10, passed: 10, failed: 0, skipped: 0 },
          categories: {
            unit: { coveragePct: 85, results: { passRate: 100, durationMs: 1000 } },
          },
        },
      },
      { report: { charts: { testCategoryCoverage: { metric: "durationMs" } } } }
    );

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Test Category Coverage (latest)");
  });

  it("renders test category bar chart with durationSeconds metric", async () => {
    const { config } = await createProject(
      {
        generatedAt: "2026-02-05T13:31:55.035Z",
        cloc: { total: { code: 120 } },
        tests: {
          summary: { passRate: 100, durationMs: 2500, total: 10, passed: 10, failed: 0, skipped: 0 },
          categories: {
            unit: { coveragePct: 85, results: { passRate: 100, durationMs: 1000 } },
          },
        },
      },
      { report: { charts: { testCategoryCoverage: { metric: "durationSeconds" } } } }
    );

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Test Category Coverage (latest)");
  });
});

describe("report branch coverage - theme resolution", () => {
  it("applies custom inline theme object", async () => {
    const { config } = await createProject(baseData, {
      report: {
        theme: {
          bg: "#111111",
          ink: "#eeeeee",
        },
      },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("--bg: #111111");
    expect(html).toContain("--ink: #eeeeee");
  });

  it("throws for invalid theme name", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const configPath = path.join(root, "litehouse-metrics.config.json");
    fs.writeFileSync(configPath, JSON.stringify({ report: { theme: "no-such-theme" } }, null, 2));
    writeMetricsFiles(root, baseData);

    const config = await loadConfig(root);
    expect(() => buildReport(config)).toThrow('Unknown report theme "no-such-theme"');
  });

  it("throws for invalid layout name with special chars", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const configPath = path.join(root, "litehouse-metrics.config.json");
    fs.writeFileSync(configPath, JSON.stringify({ report: { theme: { layout: "../escape" } } }, null, 2));
    writeMetricsFiles(root, baseData);

    const config = await loadConfig(root);
    expect(() => buildReport(config)).toThrow('Invalid layout name');
  });
});

describe("report branch coverage - empty history", () => {
  it("renders report with no history files", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const metricsDir = path.join(root, "metrics");
    fs.mkdirSync(metricsDir, { recursive: true });
    fs.writeFileSync(path.join(metricsDir, "metrics.json"), JSON.stringify(baseData, null, 2));

    const config = await loadConfig(root);
    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Metrics report");
  });

  it("renders report with no metrics file", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const metricsDir = path.join(root, "metrics");
    const historyDir = path.join(metricsDir, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(
      path.join(historyDir, "metrics-01.02.25.12.30.00.json"),
      JSON.stringify(baseData, null, 2)
    );

    const config = await loadConfig(root);
    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Metrics report");
  });
});

describe("report branch coverage - useLocalTime", () => {
  it("formats dates using local time when configured", async () => {
    const { config } = await createProject(baseData, {
      report: { useLocalTime: true },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Metrics report");
  });
});

describe("report branch coverage - risograph layout", () => {
  it("renders the risograph layout when selected", async () => {
    const { config } = await createProject(baseData, {
      report: { theme: "risograph" },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Metrics Dashboard");
  });
});

describe("report branch coverage - coverage data present", () => {
  it("renders coverage data in table", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 120 }, ts: { code: 80 }, tsx: { code: 40 } },
      tests: { summary: { passRate: 100, durationMs: 2500, total: 10, passed: 10, failed: 0, skipped: 0 } },
      coverage: {
        overall: {
          lines: { pct: 85.5 },
          functions: { pct: 90.2 },
          branches: { pct: 72.3 },
          statements: { pct: 84.1 },
        },
      },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("85.50");
    expect(html).toContain("90.20");
  });

  it("hides cloc table rows when showCloc is false", async () => {
    const { config } = await createProject(baseData, {
      report: { table: { showCloc: false } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).not.toContain("Total Code Lines");
  });

  it("hides coverage table rows when showCoverage is false", async () => {
    const { config } = await createProject(baseData, {
      report: { table: { showCoverage: false } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).not.toContain("Coverage (Lines%)");
  });

  it("hides tests table rows when showTests is false", async () => {
    const { config } = await createProject(baseData, {
      report: { table: { showTests: false } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).not.toContain("Tests Pass Rate");
  });
});
