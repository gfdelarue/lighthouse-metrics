import { describe, expect, it } from "vitest";

const makeContext = (overrides = {}) => ({
  theme: { colorScheme: "dark", bg: "#0a0a0f", bgPanel: "#12121a", bgCard: "#1a1a25", ink: "#e8e8f0", muted: "#6b6b80", grid: "#252535", axis: "#3a3a50", neonCyan: "#00f5ff", neonPink: "#ff006e", neonYellow: "#ffea00", neonGreen: "#39ff14", neonPurple: "#bf00ff", neonOrange: "#ff6b35", border: "rgba(0, 245, 255, 0.2)", shadow: "0 0 40px rgba(0, 245, 255, 0.1)", radius: "4px" },
  reportTitle: "Test Report",
  reportConfig: { subtitle: "Generated {date} (UTC)", table: { enabled: true, showCloc: true, showCoverage: true, showTests: true } },
  generatedStamp: "2026-02-05 13:31",
  latestCoverage: { overall: { lines: { pct: 85 }, functions: { pct: 90 }, branches: { pct: 70 }, statements: { pct: 82 } }, date: new Date("2026-02-05T13:31:55.035Z") },
  latestTestSummary: { summary: { passRate: 100, durationMs: 2500, total: 10, passed: 10, failed: 0, skipped: 0 }, date: new Date("2026-02-05T13:31:55.035Z") },
  latestCloc: { total: 1200, ts: 800, tsx: 400, date: new Date("2026-02-05T13:31:55.035Z") },
  coverageDelta: { text: "+5.00%", className: "delta-up" },
  passRateDelta: { text: "0", className: "delta-flat" },
  durationDelta: { text: "-0.20s", className: "delta-up" },
  clocDelta: { text: "+50", className: "delta-flat" },
  clocChart: '<div class="chart">cloc chart</div>',
  clocMissingMessage: "",
  coverageChart: '<div class="chart">coverage chart</div>',
  passRateDurationChart: '<div class="chart">pass rate chart</div>',
  testCategoryChart: '<div class="chart">category chart</div>',
  formatNumber: (v, d = 2) => v == null ? "-" : Number(v).toFixed(d),
  formatDuration: (ms) => ms == null ? "-" : `${(ms / 1000).toFixed(2)}s`,
  formatDateShort: (date) => date ? date.toISOString().slice(0, 16).replace("T", " ") : "",
  useLocalTime: false,
  coverageLevel: { level: 8, title: "EXPERT", color: "#ee5a6f" },
  passRateRank: { rank: "S", color: "#ffd700", glow: "rgba(255, 215, 0, 0.6)" },
  ...overrides,
});

describe("hud layout", () => {
  const hud = require("../src/report-layouts/hud.cjs");

  it("exports a render function", () => {
    expect(typeof hud.render).toBe("function");
  });

  it("returns css and body strings", () => {
    const result = hud.render(makeContext());
    expect(typeof result.css).toBe("string");
    expect(typeof result.body).toBe("string");
  });

  it("includes HUD title in body", () => {
    const { body } = hud.render(makeContext());
    expect(body).toContain("Developer Metrics HUD v2.0");
  });

  it("includes report title", () => {
    const { body } = hud.render(makeContext({ reportTitle: "My Dashboard" }));
    expect(body).toContain("My Dashboard");
  });

  it("includes coverage level badge", () => {
    const { body } = hud.render(makeContext());
    expect(body).toContain("LVL");
    expect(body).toContain("EXPERT");
  });

  it("includes pass rate rank", () => {
    const { body } = hud.render(makeContext());
    expect(body).toContain(">S<");
  });

  it("includes delta indicators", () => {
    const { body } = hud.render(makeContext());
    expect(body).toContain("+5.00%");
    expect(body).toContain("delta-up");
  });

  it("renders charts in body", () => {
    const { body } = hud.render(makeContext());
    expect(body).toContain("cloc chart");
    expect(body).toContain("coverage chart");
    expect(body).toContain("pass rate chart");
    expect(body).toContain("category chart");
  });

  it("includes table when enabled", () => {
    const { body } = hud.render(makeContext());
    expect(body).toContain("<table>");
    expect(body).toContain("Latest Snapshot Data");
  });

  it("excludes table when disabled", () => {
    const { body } = hud.render(makeContext({
      reportConfig: { table: { enabled: false } },
    }));
    expect(body).not.toContain("<table>");
  });

  it("shows achievement when coverage >= 80", () => {
    const { body } = hud.render(makeContext());
    expect(body).toContain("Achievement Unlocked");
    expect(body).toContain("Code Guardian");
  });

  it("hides achievement when coverage < 80", () => {
    const { body } = hud.render(makeContext({
      latestCoverage: { overall: { lines: { pct: 50 } } },
    }));
    expect(body).not.toContain("Achievement Unlocked");
  });

  it("uses subtitle from config", () => {
    const { body } = hud.render(makeContext());
    expect(body).toContain("Generated 2026-02-05 13:31 (UTC)");
  });

  it("renders fallback subtitle when none configured", () => {
    const { body } = hud.render(makeContext({
      reportConfig: { table: { enabled: true } },
    }));
    expect(body).toContain("Session recorded: 2026-02-05 13:31");
  });

  it("renders theme CSS variables", () => {
    const { css } = hud.render(makeContext());
    expect(css).toContain("--bg: #0a0a0f");
    expect(css).toContain("--neon-cyan: #00f5ff");
  });

  it("handles null coverage gracefully", () => {
    const { body } = hud.render(makeContext({
      latestCoverage: null,
      latestTestSummary: null,
      latestCloc: null,
    }));
    expect(body).toContain("--");
  });

  it("hides cloc rows when showCloc is false", () => {
    const { body } = hud.render(makeContext({
      reportConfig: { table: { enabled: true, showCloc: false, showCoverage: true, showTests: true } },
    }));
    expect(body).not.toContain("Total Code Lines");
  });

  it("hides coverage rows when showCoverage is false", () => {
    const { body } = hud.render(makeContext({
      reportConfig: { table: { enabled: true, showCloc: true, showCoverage: false, showTests: true } },
    }));
    expect(body).not.toContain("Coverage (Lines%)");
  });

  it("hides test rows when showTests is false", () => {
    const { body } = hud.render(makeContext({
      reportConfig: { table: { enabled: true, showCloc: true, showCoverage: true, showTests: false } },
    }));
    expect(body).not.toContain("Tests Pass Rate");
  });
});

describe("risograph layout", () => {
  const risograph = require("../src/report-layouts/risograph.cjs");

  it("exports a render function", () => {
    expect(typeof risograph.render).toBe("function");
  });

  it("returns css and body strings", () => {
    const result = risograph.render(makeContext());
    expect(typeof result.css).toBe("string");
    expect(typeof result.body).toBe("string");
  });

  it("includes dashboard title", () => {
    const { body } = risograph.render(makeContext());
    expect(body).toContain("Metrics Dashboard");
  });

  it("includes report title", () => {
    const { body } = risograph.render(makeContext({ reportTitle: "Riso Report" }));
    expect(body).toContain("Riso Report");
  });

  it("renders stat blocks", () => {
    const { body } = risograph.render(makeContext());
    expect(body).toContain("Coverage");
    expect(body).toContain("Pass Rate");
    expect(body).toContain("Duration");
    expect(body).toContain("Code Lines");
  });

  it("renders charts", () => {
    const { body } = risograph.render(makeContext());
    expect(body).toContain("cloc chart");
    expect(body).toContain("coverage chart");
  });

  it("includes table when enabled", () => {
    const { body } = risograph.render(makeContext());
    expect(body).toContain("<table>");
  });

  it("excludes table when disabled", () => {
    const { body } = risograph.render(makeContext({
      reportConfig: { table: { enabled: false } },
    }));
    expect(body).not.toContain("<table>");
  });

  it("applies risograph CSS theme variables", () => {
    const ctx = makeContext({ theme: { colorScheme: "light", bg: "#faf6f0", ink: "#2a2825" } });
    const { css } = risograph.render(ctx);
    expect(css).toContain("--bg: #faf6f0");
  });

  it("handles null data gracefully", () => {
    const { body } = risograph.render(makeContext({
      latestCoverage: null,
      latestTestSummary: null,
      latestCloc: null,
    }));
    expect(body).toContain("--");
  });

  it("uses subtitle with date replacement", () => {
    const { body } = risograph.render(makeContext());
    expect(body).toContain("Generated 2026-02-05 13:31 (UTC)");
  });

  it("renders fallback subtitle when none configured", () => {
    const { body } = risograph.render(makeContext({
      reportConfig: { table: { enabled: true } },
    }));
    expect(body).toContain("Generated 2026-02-05 13:31");
  });

  it("hides cloc rows when showCloc is false", () => {
    const { body } = risograph.render(makeContext({
      reportConfig: { table: { enabled: true, showCloc: false, showCoverage: true, showTests: true } },
    }));
    expect(body).not.toContain("Total Code Lines");
  });
});

describe("minimal layout", () => {
  const minimal = require("../src/report-layouts/minimal.cjs");

  it("exports a render function", () => {
    expect(typeof minimal.render).toBe("function");
  });

  it("returns css and body strings", () => {
    const result = minimal.render(makeContext());
    expect(typeof result.css).toBe("string");
    expect(typeof result.body).toBe("string");
  });

  it("includes Metrics report text", () => {
    const { body } = minimal.render(makeContext());
    expect(body).toContain("Test Report");
  });
});
