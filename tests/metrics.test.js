import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

// Test pure utility functions from metrics.mjs by extracting their logic.
// Same pattern as cli.test.js — functions are module-private, so we replicate them here.

const walkFiles = (dir, predicate) => {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, predicate));
    } else if (!predicate || predicate(full)) {
      results.push(full);
    }
  }
  return results;
};

const countTestsInFile = (content, countRegex) => {
  const matches = content.match(countRegex);
  return matches ? matches.length : 0;
};

const resolveTestType = (rel, content, rules) => {
  const tagMatch = content.match(rules.tagRegex);
  if (tagMatch && tagMatch[1]) {
    const tag = tagMatch[1].toLowerCase();
    if (rules.types.includes(tag)) return tag;
  }

  const normalized = rel.replace(/\\/g, "/");
  const suffixMatch = normalized.match(rules.suffixRegex);
  if (suffixMatch && suffixMatch[1]) return suffixMatch[1];

  for (const [prefix, type] of rules.dirEntries) {
    if (normalized.startsWith(prefix)) return type;
  }

  if (rules.types.includes(rules.defaultType)) return rules.defaultType;
  if (rules.types.includes("other")) return "other";
  return rules.types[0] ?? "unit";
};

const loadCoveragePct = (summaryPath) => {
  if (!fs.existsSync(summaryPath)) return 0;
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  return summary?.total?.lines?.pct ?? 0;
};

const loadVitestSummary = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }

  const getNum = (key) => (typeof data[key] === "number" ? data[key] : null);

  const passed = getNum("numPassedTests") ?? getNum("numPassed") ?? 0;
  const failed = getNum("numFailedTests") ?? getNum("numFailed") ?? 0;
  const skipped = getNum("numPendingTests") ?? getNum("numSkippedTests") ?? 0;
  const todo = getNum("numTodoTests") ?? 0;
  const total =
    getNum("numTotalTests") ?? getNum("numTotal") ?? passed + failed + skipped + todo;

  const suiteTotal = getNum("numTotalTestSuites") ?? getNum("numTotalSuites") ?? null;
  const suitePassed = getNum("numPassedTestSuites") ?? getNum("numPassedSuites") ?? null;
  const suiteFailed = getNum("numFailedTestSuites") ?? getNum("numFailedSuites") ?? null;
  const suiteSkipped =
    getNum("numPendingTestSuites") ?? getNum("numSkippedTestSuites") ?? null;

  const startTime = typeof data.startTime === "number" ? data.startTime : null;
  let endTime = typeof data.endTime === "number" ? data.endTime : null;

  if (!endTime && Array.isArray(data.testResults)) {
    const endTimes = data.testResults
      .map((result) => (typeof result.endTime === "number" ? result.endTime : null))
      .filter((value) => value !== null);
    if (endTimes.length) {
      endTime = Math.max(...endTimes);
    }
  }

  let durationMs = typeof data.duration === "number" ? data.duration : null;
  if (durationMs === null && startTime !== null && endTime !== null) {
    durationMs = endTime - startTime;
  }

  const passRate = total ? (passed / total) * 100 : 0;

  return {
    total,
    passed,
    failed,
    skipped,
    todo,
    passRate,
    durationMs,
    startTime,
    endTime,
    success: typeof data.success === "boolean" ? data.success : failed === 0,
    suites: {
      total: suiteTotal,
      passed: suitePassed,
      failed: suiteFailed,
      skipped: suiteSkipped,
    },
  };
};

const readClocSum = (data) => {
  if (!data) return null;
  const sum = data.SUM || data.total;
  if (!sum) return null;
  return {
    files: sum.nFiles ?? sum.files ?? 0,
    blank: sum.blank ?? 0,
    comment: sum.comment ?? 0,
    code: sum.code ?? 0,
  };
};

const buildCoverageCategories = (summary, cwd, categoryMap) => {
  const emptyMetric = () => ({ total: 0, covered: 0 });
  const categories = Object.fromEntries(
    Object.keys(categoryMap).map((name) => [
      name,
      { lines: emptyMetric(), branches: emptyMetric(), functions: emptyMetric(), statements: emptyMetric() },
    ])
  );

  const add = (bucket, data) => {
    for (const key of ["lines", "branches", "functions", "statements"]) {
      bucket[key].total += data[key].total || 0;
      bucket[key].covered += data[key].covered || 0;
    }
  };

  const matchCategory = (rel) => {
    for (const [name, prefixes] of Object.entries(categoryMap)) {
      if (prefixes.some((prefix) => rel.startsWith(prefix))) return name;
    }
    return null;
  };

  for (const [file, data] of Object.entries(summary)) {
    if (file === "total") continue;
    const rel = path.relative(cwd, file);
    const category = matchCategory(rel.replace(/\\/g, "/"));
    if (!category) continue;
    add(categories[category], data);
  }

  const pct = (metric) => (metric.total ? (metric.covered / metric.total) * 100 : 0);
  const metricToJson = (metric) => ({
    total: metric.total || 0,
    covered: metric.covered || 0,
    pct: pct(metric),
  });

  const categoriesJson = {};
  for (const [name, bucket] of Object.entries(categories)) {
    categoriesJson[name] = {
      lines: metricToJson(bucket.lines),
      functions: metricToJson(bucket.functions),
      branches: metricToJson(bucket.branches),
      statements: metricToJson(bucket.statements),
    };
  }

  return categoriesJson;
};

const makeRegex = (value, fallback, flags = "") => {
  if (!value) return new RegExp(fallback, flags);
  if (value instanceof RegExp) return value;
  if (typeof value === "string") {
    if (value.startsWith("/") && value.lastIndexOf("/") > 0) {
      const last = value.lastIndexOf("/");
      const pattern = value.slice(1, last);
      const flagString = value.slice(last + 1) || flags;
      return new RegExp(pattern, flagString);
    }
    return new RegExp(value, flags);
  }
  return new RegExp(fallback, flags);
};

const ensureFlags = (regex, flags) => {
  const cleaned = Array.from(new Set((regex.flags + flags).split(""))).join("");
  return new RegExp(regex.source, cleaned);
};

const stripFlag = (regex, flag) => {
  if (!regex.flags.includes(flag)) return regex;
  const cleaned = regex.flags.replace(new RegExp(flag, "g"), "");
  return new RegExp(regex.source, cleaned);
};

const formatTimestamp = (date, format, useLocalTime) => {
  const pad = (value) => String(value).padStart(2, "0");
  const get = (method) => (useLocalTime ? date[method.replace("UTC", "")]() : date[method]());
  const replacements = {
    YYYY: String(get("getUTCFullYear")),
    YY: String(get("getUTCFullYear")).slice(-2),
    MM: pad(get("getUTCMonth") + 1),
    DD: pad(get("getUTCDate")),
    HH: pad(get("getUTCHours")),
    mm: pad(get("getUTCMinutes")),
    ss: pad(get("getUTCSeconds")),
  };
  return format.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (token) => replacements[token] ?? token);
};

// --- Tests ---

describe("walkFiles", () => {
  it("collects all files recursively", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "walk-"));
    const sub = path.join(root, "sub");
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(root, "a.txt"), "");
    fs.writeFileSync(path.join(sub, "b.txt"), "");

    const files = walkFiles(root);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("a.txt"))).toBe(true);
    expect(files.some((f) => f.endsWith("b.txt"))).toBe(true);
  });

  it("filters files by predicate", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "walk-"));
    fs.writeFileSync(path.join(root, "a.test.js"), "");
    fs.writeFileSync(path.join(root, "b.js"), "");
    fs.writeFileSync(path.join(root, "c.test.js"), "");

    const files = walkFiles(root, (f) => f.endsWith(".test.js"));
    expect(files).toHaveLength(2);
  });

  it("returns empty array for empty directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "walk-"));
    expect(walkFiles(root)).toEqual([]);
  });
});

describe("countTestsInFile", () => {
  const regex = /\b(it|test)(?:\.each)?\s*\(/g;

  it("counts it() and test() calls", () => {
    const content = `
      it("does something", () => {});
      test("another", () => {});
      it("third", () => {});
    `;
    expect(countTestsInFile(content, regex)).toBe(3);
  });

  it("counts test.each calls", () => {
    const content = `test.each([1,2])("works for %i", (n) => {});`;
    expect(countTestsInFile(content, regex)).toBe(1);
  });

  it("returns 0 for no matches", () => {
    const content = "const x = 1;";
    expect(countTestsInFile(content, regex)).toBe(0);
  });

  it("does not count describe blocks", () => {
    const content = `describe("suite", () => { it("test", () => {}); });`;
    expect(countTestsInFile(content, regex)).toBe(1);
  });
});

describe("resolveTestType", () => {
  const baseRules = {
    types: ["unit", "api", "integration", "ui", "e2e", "other"],
    tagRegex: /^\s*\/\/\s*@test-type\s+([a-z0-9-]+)/im,
    suffixRegex: /\.(unit|api|integration|ui|e2e)\.test\./i,
    dirEntries: [
      ["tests/api/", "api"],
      ["tests/ui/", "ui"],
    ],
    defaultType: "unit",
  };

  it("resolves type from @test-type tag comment", () => {
    const content = "// @test-type api\nimport { describe } from 'vitest';";
    expect(resolveTestType("tests/foo.test.js", content, baseRules)).toBe("api");
  });

  it("resolves type from filename suffix", () => {
    const content = "import { describe } from 'vitest';";
    expect(resolveTestType("tests/foo.e2e.test.ts", content, baseRules)).toBe("e2e");
  });

  it("resolves type from directory mapping", () => {
    const content = "import { describe } from 'vitest';";
    expect(resolveTestType("tests/api/users.test.ts", content, baseRules)).toBe("api");
  });

  it("falls back to default type when no match", () => {
    const content = "import { describe } from 'vitest';";
    expect(resolveTestType("tests/misc.test.ts", content, baseRules)).toBe("unit");
  });

  it("tag takes precedence over suffix and directory", () => {
    const content = "// @test-type integration\nimport x from 'y';";
    expect(resolveTestType("tests/api/foo.e2e.test.ts", content, baseRules)).toBe("integration");
  });

  it("suffix takes precedence over directory", () => {
    const content = "import x from 'y';";
    expect(resolveTestType("tests/api/foo.ui.test.ts", content, baseRules)).toBe("ui");
  });

  it("ignores unrecognized tag types", () => {
    const content = "// @test-type unknown-type\nimport x from 'y';";
    expect(resolveTestType("tests/api/foo.test.ts", content, baseRules)).toBe("api");
  });

  it("falls back to 'other' when defaultType is not in types", () => {
    const rules = { ...baseRules, defaultType: "nonexistent" };
    const content = "import x from 'y';";
    expect(resolveTestType("tests/misc.test.ts", content, rules)).toBe("other");
  });

  it("falls back to first type when neither defaultType nor 'other' is in types", () => {
    const rules = {
      ...baseRules,
      types: ["api", "e2e"],
      defaultType: "nonexistent",
    };
    const content = "import x from 'y';";
    expect(resolveTestType("tests/misc.test.ts", content, rules)).toBe("api");
  });

  it("normalizes backslashes in relative path", () => {
    const content = "import x from 'y';";
    expect(resolveTestType("tests\\api\\foo.test.ts", content, baseRules)).toBe("api");
  });
});

describe("loadCoveragePct", () => {
  it("returns 0 when file does not exist", () => {
    expect(loadCoveragePct("/nonexistent/path.json")).toBe(0);
  });

  it("reads lines pct from coverage summary", () => {
    const tmp = path.join(os.tmpdir(), `cov-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ total: { lines: { pct: 85.5 } } }));
    expect(loadCoveragePct(tmp)).toBe(85.5);
    fs.unlinkSync(tmp);
  });

  it("returns 0 when total.lines.pct is missing", () => {
    const tmp = path.join(os.tmpdir(), `cov-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ total: {} }));
    expect(loadCoveragePct(tmp)).toBe(0);
    fs.unlinkSync(tmp);
  });
});

describe("loadVitestSummary", () => {
  const writeTmp = (data) => {
    const tmp = path.join(os.tmpdir(), `vitest-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(tmp, JSON.stringify(data));
    return tmp;
  };

  it("returns null for null path", () => {
    expect(loadVitestSummary(null)).toBeNull();
  });

  it("returns null for nonexistent file", () => {
    expect(loadVitestSummary("/nonexistent.json")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const tmp = path.join(os.tmpdir(), `bad-${Date.now()}.json`);
    fs.writeFileSync(tmp, "not json");
    expect(loadVitestSummary(tmp)).toBeNull();
    fs.unlinkSync(tmp);
  });

  it("parses standard vitest output", () => {
    const tmp = writeTmp({
      numPassedTests: 8,
      numFailedTests: 2,
      numPendingTests: 1,
      numTodoTests: 0,
      numTotalTests: 11,
      duration: 3500,
      success: false,
    });

    const result = loadVitestSummary(tmp);
    expect(result.passed).toBe(8);
    expect(result.failed).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(11);
    expect(result.passRate).toBeCloseTo(72.73, 1);
    expect(result.durationMs).toBe(3500);
    expect(result.success).toBe(false);
    fs.unlinkSync(tmp);
  });

  it("uses alternate field names (numPassed, numFailed)", () => {
    const tmp = writeTmp({
      numPassed: 5,
      numFailed: 0,
      numTotal: 5,
      duration: 1000,
    });

    const result = loadVitestSummary(tmp);
    expect(result.passed).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(5);
    expect(result.success).toBe(true);
    fs.unlinkSync(tmp);
  });

  it("computes duration from startTime and endTime when duration is absent", () => {
    const tmp = writeTmp({
      numPassedTests: 3,
      numFailedTests: 0,
      numTotalTests: 3,
      startTime: 1000,
      endTime: 4500,
    });

    const result = loadVitestSummary(tmp);
    expect(result.durationMs).toBe(3500);
    expect(result.startTime).toBe(1000);
    expect(result.endTime).toBe(4500);
    fs.unlinkSync(tmp);
  });

  it("derives endTime from testResults when endTime is absent", () => {
    const tmp = writeTmp({
      numPassedTests: 2,
      numFailedTests: 0,
      numTotalTests: 2,
      startTime: 1000,
      testResults: [{ endTime: 2000 }, { endTime: 3000 }, { endTime: 2500 }],
    });

    const result = loadVitestSummary(tmp);
    expect(result.endTime).toBe(3000);
    expect(result.durationMs).toBe(2000);
    fs.unlinkSync(tmp);
  });

  it("computes total from passed + failed + skipped + todo when numTotalTests is absent", () => {
    const tmp = writeTmp({
      numPassedTests: 3,
      numFailedTests: 1,
      numPendingTests: 2,
      numTodoTests: 1,
    });

    const result = loadVitestSummary(tmp);
    expect(result.total).toBe(7);
    fs.unlinkSync(tmp);
  });

  it("returns passRate of 0 when total is 0", () => {
    const tmp = writeTmp({});

    const result = loadVitestSummary(tmp);
    expect(result.passRate).toBe(0);
    expect(result.total).toBe(0);
    fs.unlinkSync(tmp);
  });

  it("parses suite information", () => {
    const tmp = writeTmp({
      numPassedTests: 5,
      numTotalTests: 5,
      numTotalTestSuites: 3,
      numPassedTestSuites: 2,
      numFailedTestSuites: 1,
      numPendingTestSuites: 0,
    });

    const result = loadVitestSummary(tmp);
    expect(result.suites.total).toBe(3);
    expect(result.suites.passed).toBe(2);
    expect(result.suites.failed).toBe(1);
    expect(result.suites.skipped).toBe(0);
    fs.unlinkSync(tmp);
  });
});

describe("readClocSum", () => {
  it("returns null for null input", () => {
    expect(readClocSum(null)).toBeNull();
  });

  it("returns null when neither SUM nor total exists", () => {
    expect(readClocSum({ JavaScript: { code: 100 } })).toBeNull();
  });

  it("reads from SUM key (cloc standard output)", () => {
    const result = readClocSum({
      SUM: { nFiles: 10, blank: 20, comment: 5, code: 500 },
    });
    expect(result).toEqual({ files: 10, blank: 20, comment: 5, code: 500 });
  });

  it("reads from total key (alternate format)", () => {
    const result = readClocSum({
      total: { files: 8, blank: 15, comment: 3, code: 300 },
    });
    expect(result).toEqual({ files: 8, blank: 15, comment: 3, code: 300 });
  });

  it("defaults missing fields to 0", () => {
    const result = readClocSum({ SUM: { code: 100 } });
    expect(result).toEqual({ files: 0, blank: 0, comment: 0, code: 100 });
  });

  it("prefers SUM over total when both exist", () => {
    const result = readClocSum({
      SUM: { code: 500 },
      total: { code: 300 },
    });
    expect(result.code).toBe(500);
  });
});

describe("buildCoverageCategories", () => {
  it("groups files by category prefix", () => {
    const summary = {
      total: {},
      "/project/src/api/route.ts": {
        lines: { total: 100, covered: 80 },
        branches: { total: 20, covered: 15 },
        functions: { total: 10, covered: 8 },
        statements: { total: 100, covered: 80 },
      },
      "/project/src/lib/util.ts": {
        lines: { total: 50, covered: 40 },
        branches: { total: 10, covered: 8 },
        functions: { total: 5, covered: 4 },
        statements: { total: 50, covered: 40 },
      },
    };
    const categoryMap = {
      api: ["src/api/"],
      lib: ["src/lib/"],
    };

    const result = buildCoverageCategories(summary, "/project", categoryMap);

    expect(result.api.lines.total).toBe(100);
    expect(result.api.lines.covered).toBe(80);
    expect(result.api.lines.pct).toBe(80);
    expect(result.lib.lines.total).toBe(50);
    expect(result.lib.lines.covered).toBe(40);
    expect(result.lib.lines.pct).toBe(80);
  });

  it("skips files that match no category", () => {
    const summary = {
      total: {},
      "/project/other/file.ts": {
        lines: { total: 100, covered: 50 },
        branches: { total: 10, covered: 5 },
        functions: { total: 5, covered: 3 },
        statements: { total: 100, covered: 50 },
      },
    };
    const categoryMap = { api: ["src/api/"] };

    const result = buildCoverageCategories(summary, "/project", categoryMap);
    expect(result.api.lines.total).toBe(0);
    expect(result.api.lines.pct).toBe(0);
  });

  it("aggregates multiple files in same category", () => {
    const summary = {
      total: {},
      "/project/src/api/a.ts": {
        lines: { total: 100, covered: 80 },
        branches: { total: 10, covered: 8 },
        functions: { total: 5, covered: 4 },
        statements: { total: 100, covered: 80 },
      },
      "/project/src/api/b.ts": {
        lines: { total: 50, covered: 30 },
        branches: { total: 10, covered: 5 },
        functions: { total: 5, covered: 3 },
        statements: { total: 50, covered: 30 },
      },
    };
    const categoryMap = { api: ["src/api/"] };

    const result = buildCoverageCategories(summary, "/project", categoryMap);
    expect(result.api.lines.total).toBe(150);
    expect(result.api.lines.covered).toBe(110);
    expect(result.api.lines.pct).toBeCloseTo(73.33, 1);
  });

  it("returns 0 pct when total is 0", () => {
    const summary = { total: {} };
    const categoryMap = { empty: ["src/empty/"] };

    const result = buildCoverageCategories(summary, "/project", categoryMap);
    expect(result.empty.lines.pct).toBe(0);
  });
});

describe("makeRegex", () => {
  it("returns fallback regex when value is falsy", () => {
    const result = makeRegex(null, "test", "i");
    expect(result.source).toBe("test");
    expect(result.flags).toBe("i");
  });

  it("returns the regex as-is when value is a RegExp", () => {
    const input = /hello/g;
    expect(makeRegex(input, "fallback")).toBe(input);
  });

  it("parses /pattern/flags string notation", () => {
    const result = makeRegex("/hello/gi", "fallback");
    expect(result.source).toBe("hello");
    expect(result.flags).toBe("gi");
  });

  it("uses default flags for /pattern/ without flags", () => {
    const result = makeRegex("/hello/", "fallback", "i");
    expect(result.source).toBe("hello");
    expect(result.flags).toBe("i");
  });

  it("treats plain string as regex pattern", () => {
    const result = makeRegex("\\d+", "fallback", "g");
    expect(result.source).toBe("\\d+");
    expect(result.flags).toBe("g");
  });

  it("returns fallback for non-string, non-RegExp values", () => {
    const result = makeRegex(42, "fallback", "i");
    expect(result.source).toBe("fallback");
  });
});

describe("ensureFlags", () => {
  it("adds missing flags", () => {
    const result = ensureFlags(/test/i, "g");
    expect(result.flags).toContain("g");
    expect(result.flags).toContain("i");
  });

  it("does not duplicate existing flags", () => {
    const result = ensureFlags(/test/gi, "g");
    const gCount = result.flags.split("").filter((c) => c === "g").length;
    expect(gCount).toBe(1);
  });
});

describe("stripFlag", () => {
  it("removes specified flag", () => {
    const result = stripFlag(/test/gi, "g");
    expect(result.flags).toBe("i");
  });

  it("returns same regex when flag is not present", () => {
    const input = /test/i;
    const result = stripFlag(input, "g");
    expect(result).toBe(input);
  });
});

describe("formatTimestamp", () => {
  // Use a fixed UTC date: 2026-03-15 09:05:07
  const date = new Date("2026-03-15T09:05:07.000Z");

  it("formats full timestamp with DD.MM.YY.HH.mm.ss", () => {
    expect(formatTimestamp(date, "DD.MM.YY.HH.mm.ss", false)).toBe("15.03.26.09.05.07");
  });

  it("formats with YYYY-MM-DD pattern", () => {
    expect(formatTimestamp(date, "YYYY-MM-DD", false)).toBe("2026-03-15");
  });

  it("formats with HH:mm:ss pattern", () => {
    expect(formatTimestamp(date, "HH:mm:ss", false)).toBe("09:05:07");
  });

  it("preserves non-token characters", () => {
    expect(formatTimestamp(date, "date_YYYY_MM_DD", false)).toBe("date_2026_03_15");
  });

  it("pads single-digit values with leading zero", () => {
    const earlyDate = new Date("2026-01-05T03:02:01.000Z");
    expect(formatTimestamp(earlyDate, "DD.MM.YY.HH.mm.ss", false)).toBe("05.01.26.03.02.01");
  });
});
