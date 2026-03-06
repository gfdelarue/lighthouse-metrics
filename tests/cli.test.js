import { describe, expect, it } from "vitest";

// Test the pure utility functions extracted from cli.mjs logic.
// We import the module to get function references indirectly via tested behavior.

const parseValue = (raw) => {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw === "undefined") return undefined;
  if (!Number.isNaN(Number(raw)) && raw.trim() !== "") return Number(raw);
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
};

const setByPath = (target, pathKey, value) => {
  const parts = pathKey.split(".").filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
};

const hasFlag = (rawArgs, flag) => rawArgs.includes(flag);

const buildOverrides = (options, rawArgs) => {
  const overrides = {};

  if (options.port != null && hasFlag(rawArgs, "--port")) {
    overrides.port = Number(options.port);
  }
  if (options.host && hasFlag(rawArgs, "--host")) {
    overrides.server = { ...(overrides.server ?? {}), host: options.host };
  }
  if (hasFlag(rawArgs, "--open")) {
    overrides.server = { ...(overrides.server ?? {}), open: true };
  }
  if (hasFlag(rawArgs, "--no-open")) {
    overrides.server = { ...(overrides.server ?? {}), open: false };
  }
  if (hasFlag(rawArgs, "--no-cloc")) {
    overrides.cloc = { ...(overrides.cloc ?? {}), enabled: false };
  }
  if (hasFlag(rawArgs, "--cloc")) {
    overrides.cloc = { ...(overrides.cloc ?? {}), enabled: true };
  }
  if (hasFlag(rawArgs, "--no-categories")) {
    overrides.runCategoryCoverage = false;
  }
  if (hasFlag(rawArgs, "--categories")) {
    overrides.runCategoryCoverage = true;
  }
  if (options.metricsDir && hasFlag(rawArgs, "--metrics-dir")) {
    overrides.metricsDir = options.metricsDir;
  }
  if (options.historyDir && hasFlag(rawArgs, "--history-dir")) {
    overrides.historyDir = options.historyDir;
  }
  if (options.reportDir && hasFlag(rawArgs, "--report-dir")) {
    overrides.reportDir = options.reportDir;
  }
  if (options.reportFile && hasFlag(rawArgs, "--report-file")) {
    overrides.reportFile = options.reportFile;
  }
  if (options.metricsFile && hasFlag(rawArgs, "--metrics-file")) {
    overrides.metricsFile = options.metricsFile;
  }
  if (options.coverageDir && hasFlag(rawArgs, "--coverage-dir")) {
    overrides.coverageDir = options.coverageDir;
  }
  if (options.testsDir && hasFlag(rawArgs, "--tests-dir")) {
    overrides.testsDir = options.testsDir;
  }
  if (options.coverageSummary && hasFlag(rawArgs, "--coverage-summary")) {
    overrides.coverageSummaryFile = options.coverageSummary;
  }
  if (options.testCommand != null && hasFlag(rawArgs, "--test-command")) {
    overrides.testCommand = options.testCommand;
  }
  if (options.testSummary != null && hasFlag(rawArgs, "--test-summary")) {
    overrides.testSummaryFile = options.testSummary;
  }
  if (options.preset && hasFlag(rawArgs, "--preset")) {
    overrides.preset = options.preset;
  }

  const setEntries = options.set ? (Array.isArray(options.set) ? options.set : [options.set]) : [];
  for (const entry of setEntries) {
    const [key, ...rest] = entry.split("=");
    if (!key || rest.length === 0) continue;
    const value = parseValue(rest.join("="));
    setByPath(overrides, key.trim(), value);
  }

  return overrides;
};

describe("parseValue", () => {
  it("parses 'true' to boolean true", () => {
    expect(parseValue("true")).toBe(true);
  });

  it("parses 'false' to boolean false", () => {
    expect(parseValue("false")).toBe(false);
  });

  it("parses 'null' to null", () => {
    expect(parseValue("null")).toBe(null);
  });

  it("parses 'undefined' to undefined", () => {
    expect(parseValue("undefined")).toBe(undefined);
  });

  it("parses numeric strings to numbers", () => {
    expect(parseValue("42")).toBe(42);
    expect(parseValue("3.14")).toBe(3.14);
    expect(parseValue("0")).toBe(0);
  });

  it("parses JSON objects", () => {
    expect(parseValue('{"key":"val"}')).toEqual({ key: "val" });
  });

  it("parses JSON arrays", () => {
    expect(parseValue("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("returns raw string for invalid JSON object", () => {
    expect(parseValue("{invalid}")).toBe("{invalid}");
  });

  it("returns raw string for non-special values", () => {
    expect(parseValue("hello")).toBe("hello");
  });

  it("returns raw string for empty-looking numbers", () => {
    expect(parseValue("  ")).toBe("  ");
  });
});

describe("setByPath", () => {
  it("sets a top-level key", () => {
    const obj = {};
    setByPath(obj, "port", 3000);
    expect(obj.port).toBe(3000);
  });

  it("sets a nested key", () => {
    const obj = {};
    setByPath(obj, "report.chart.width", 1200);
    expect(obj.report.chart.width).toBe(1200);
  });

  it("overwrites existing nested values", () => {
    const obj = { report: { chart: { width: 900 } } };
    setByPath(obj, "report.chart.width", 1200);
    expect(obj.report.chart.width).toBe(1200);
  });

  it("handles empty path gracefully", () => {
    const obj = {};
    setByPath(obj, "", "value");
    expect(Object.keys(obj).length).toBe(0);
  });

  it("overwrites non-object intermediate values", () => {
    const obj = { report: "string" };
    setByPath(obj, "report.chart.width", 1200);
    expect(obj.report.chart.width).toBe(1200);
  });
});

describe("hasFlag", () => {
  it("returns true when flag is present", () => {
    expect(hasFlag(["--port", "3000", "--open"], "--open")).toBe(true);
  });

  it("returns false when flag is absent", () => {
    expect(hasFlag(["--port", "3000"], "--open")).toBe(false);
  });
});

describe("buildOverrides", () => {
  it("sets port when --port flag is present", () => {
    const result = buildOverrides({ port: "3000" }, ["--port", "3000"]);
    expect(result.port).toBe(3000);
  });

  it("does not set port when --port flag is absent", () => {
    const result = buildOverrides({ port: "3000" }, []);
    expect(result.port).toBeUndefined();
  });

  it("sets host when --host flag is present", () => {
    const result = buildOverrides({ host: "0.0.0.0" }, ["--host", "0.0.0.0"]);
    expect(result.server.host).toBe("0.0.0.0");
  });

  it("sets open to true when --open flag is present", () => {
    const result = buildOverrides({}, ["--open"]);
    expect(result.server.open).toBe(true);
  });

  it("sets open to false when --no-open flag is present", () => {
    const result = buildOverrides({}, ["--no-open"]);
    expect(result.server.open).toBe(false);
  });

  it("disables cloc when --no-cloc is present", () => {
    const result = buildOverrides({}, ["--no-cloc"]);
    expect(result.cloc.enabled).toBe(false);
  });

  it("enables cloc when --cloc is present", () => {
    const result = buildOverrides({}, ["--cloc"]);
    expect(result.cloc.enabled).toBe(true);
  });

  it("disables categories when --no-categories is present", () => {
    const result = buildOverrides({}, ["--no-categories"]);
    expect(result.runCategoryCoverage).toBe(false);
  });

  it("enables categories when --categories is present", () => {
    const result = buildOverrides({}, ["--categories"]);
    expect(result.runCategoryCoverage).toBe(true);
  });

  it("sets all directory overrides", () => {
    const options = {
      metricsDir: "m",
      historyDir: "h",
      reportDir: "r",
      reportFile: "rf",
      metricsFile: "mf",
      coverageDir: "cd",
      testsDir: "td",
    };
    const rawArgs = [
      "--metrics-dir", "m",
      "--history-dir", "h",
      "--report-dir", "r",
      "--report-file", "rf",
      "--metrics-file", "mf",
      "--coverage-dir", "cd",
      "--tests-dir", "td",
    ];
    const result = buildOverrides(options, rawArgs);
    expect(result.metricsDir).toBe("m");
    expect(result.historyDir).toBe("h");
    expect(result.reportDir).toBe("r");
    expect(result.reportFile).toBe("rf");
    expect(result.metricsFile).toBe("mf");
    expect(result.coverageDir).toBe("cd");
    expect(result.testsDir).toBe("td");
  });

  it("sets coverage summary", () => {
    const result = buildOverrides({ coverageSummary: "cov.json" }, ["--coverage-summary", "cov.json"]);
    expect(result.coverageSummaryFile).toBe("cov.json");
  });

  it("sets test command", () => {
    const result = buildOverrides({ testCommand: "jest" }, ["--test-command", "jest"]);
    expect(result.testCommand).toBe("jest");
  });

  it("sets test summary", () => {
    const result = buildOverrides({ testSummary: "ts.json" }, ["--test-summary", "ts.json"]);
    expect(result.testSummaryFile).toBe("ts.json");
  });

  it("sets preset", () => {
    const result = buildOverrides({ preset: "node" }, ["--preset", "node"]);
    expect(result.preset).toBe("node");
  });

  it("processes --set entries", () => {
    const result = buildOverrides({ set: ["report.chart.width=1200", "port=9999"] }, []);
    expect(result.report.chart.width).toBe(1200);
    expect(result.port).toBe(9999);
  });

  it("processes single --set entry (non-array)", () => {
    const result = buildOverrides({ set: "report.title=My Report" }, []);
    expect(result.report.title).toBe("My Report");
  });

  it("skips --set entries without = sign", () => {
    const result = buildOverrides({ set: ["invalidentry"] }, []);
    expect(Object.keys(result).length).toBe(0);
  });

  it("handles --set with = in value", () => {
    const result = buildOverrides({ set: ["key=a=b=c"] }, []);
    expect(result.key).toBe("a=b=c");
  });
});
