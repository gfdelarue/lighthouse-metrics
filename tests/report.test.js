import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.mjs";
import { buildReport } from "../src/report.mjs";

const writeMetricsFiles = (root, data) => {
  const metricsDir = path.join(root, "metrics");
  const historyDir = path.join(metricsDir, "history");
  fs.mkdirSync(historyDir, { recursive: true });

  fs.writeFileSync(path.join(metricsDir, "metrics.json"), JSON.stringify(data, null, 2));
  fs.writeFileSync(
    path.join(historyDir, "metrics-01.02.25.12.30.00.json"),
    JSON.stringify(data, null, 2)
  );
};

const createProject = async (data) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lighthouse-metrics-"));
  const config = await loadConfig(root);
  writeMetricsFiles(root, data);
  return { root, config };
};

describe("report tiering and messages", () => {
  it("tiers cloc y-axis to 5000 for ~3k LOC", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 2978 } },
      tests: { summary: { passRate: 100, durationMs: 1200, total: 1, passed: 1, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Code lines (from cloc snapshots)");
    expect(html).toContain("5000.00");
  });

  it("shows cloc install message when no cloc data", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: null,
      tests: { summary: { passRate: 100, durationMs: 1200, total: 1, passed: 1, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain(
      "Install <code>cloc</code> to enable code lines metrics (https://github.com/AlDanial/cloc)."
    );
  });

  it("uses ms tiers for short durations", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 120 } },
      tests: { summary: { passRate: 100, durationMs: 2500, total: 1, passed: 1, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Duration (ms)");
    expect(html).toContain("3000.00");
  });

  it("uses seconds tiers for longer durations", async () => {
    const { config } = await createProject({
      generatedAt: "2026-02-05T13:31:55.035Z",
      cloc: { total: { code: 120 } },
      tests: { summary: { passRate: 100, durationMs: 4500, total: 1, passed: 1, failed: 0, skipped: 0 } },
    });

    const reportPath = buildReport(config);
    const html = fs.readFileSync(reportPath, "utf8");
    expect(html).toContain("Duration (s)");
    expect(html).toContain("5.00");
  });
});
