import fs from "fs";
import path from "path";
import { execa, execaCommand } from "execa";

const isWin = process.platform === "win32";

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const resolveLocalBin = (cwd, name) => {
  const binDir = path.join(cwd, "node_modules", ".bin");
  const candidates = isWin
    ? [
        path.join(binDir, `${name}.cmd`),
        path.join(binDir, `${name}.ps1`),
        path.join(binDir, name),
      ]
    : [path.join(binDir, name), path.join(binDir, `${name}.cmd`)];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const resolveCommand = (cwd, name) => {
  const local = resolveLocalBin(cwd, name);
  if (local) {
    return { command: local, args: [] };
  }
  return { command: "npx", args: [name] };
};

const runCommand = async (command, args, cwd) => {
  await execa(command, args, { cwd, stdio: "inherit" });
};

const runCommandString = async (command, cwd) => {
  await execaCommand(command, { cwd, stdio: "inherit", shell: true });
};

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

const runCloc = async (cwd, args, commandOverride) => {
  const { command, args: prefix } = commandOverride
    ? { command: commandOverride, args: [] }
    : resolveCommand(cwd, "cloc");
  try {
    const result = await execa(command, [...prefix, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(result.stdout);
  } catch (error) {
    return null;
  }
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

export async function runMetrics(config) {
  const cwd = config.cwd;
  const coverageDir = path.resolve(cwd, config.coverageDir);
  const metricsDir = path.resolve(cwd, config.metricsDir);
  const historyDir = path.resolve(cwd, config.historyDir);
  const metricsFile = path.resolve(cwd, config.metricsFile);
  const testsDir = path.resolve(cwd, config.testsDir);

  ensureDir(coverageDir);

  const vitest = resolveCommand(cwd, "vitest");
  const overallSummaryPath = config.testSummaryFile
    ? path.resolve(cwd, config.testSummaryFile)
    : path.resolve(cwd, config.coverage?.testSummaryFile ?? path.join(coverageDir, "test-summary.json"));

  ensureDir(path.dirname(overallSummaryPath));

  if (config.testCommand) {
    await runCommandString(config.testCommand, cwd);
  } else {
    const vitestArgs = Array.isArray(config.vitestArgs)
      ? config.vitestArgs
      : config.vitestArgs
        ? [config.vitestArgs]
        : [];
    const overallArgs = [
      ...vitest.args,
      "run",
      ...vitestArgs.filter(Boolean),
      "--coverage",
      "--coverage.reporter=json-summary",
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${overallSummaryPath}`,
    ];

    await runCommand(vitest.command, overallArgs, cwd);
  }

  const testTypes = config.categories?.tests ?? ["unit", "api", "integration", "ui", "e2e", "other"];
  const testFileRegex = stripFlag(
    makeRegex(config.tests?.filePattern, "\\.(test|spec)\\.[cm]?[jt]sx?$"),
    "g"
  );
  const testFiles = fs.existsSync(testsDir)
    ? walkFiles(testsDir, (file) => testFileRegex.test(file))
    : [];

  const buckets = Object.fromEntries(testTypes.map((type) => [type, []]));
  const testCounts = Object.fromEntries(testTypes.map((type) => [type, { files: 0, tests: 0 }]));

  const dirEntries = Object.entries(config.tests?.dirMap ?? {}).map(([prefix, type]) => [
    prefix.replace(/\\/g, "/"),
    type,
  ]);
  const rules = {
    types: testTypes,
    tagRegex: stripFlag(
      makeRegex(
        config.tests?.typeTagPattern,
        "^\\s*//\\s*@test-type\\s+([a-z0-9-]+)",
        "im"
      ),
      "g"
    ),
    suffixRegex: stripFlag(
      makeRegex(
        config.tests?.typeSuffixPattern,
        "\\.(unit|api|integration|ui|e2e)\\.test\\.",
        "i"
      ),
      "g"
    ),
    dirEntries,
    defaultType: config.tests?.defaultType ?? "unit",
  };
  const countRegex = ensureFlags(
    makeRegex(config.tests?.countPattern, "\\b(it|test)(?:\\.each)?\\s*\\("),
    "g"
  );

  for (const file of testFiles) {
    const rel = path.relative(cwd, file);
    const content = fs.readFileSync(file, "utf8");
    const type = resolveTestType(rel, content, rules);
    const bucketKey = testTypes.includes(type) ? type : testTypes.includes("other") ? "other" : testTypes[0];
    (buckets[bucketKey] ?? buckets.other ?? []).push(file);

    const bucket = testCounts[bucketKey] ?? testCounts.other;
    bucket.files += 1;
    bucket.tests += countTestsInFile(content, countRegex);
  }

  const vitestArgs = Array.isArray(config.vitestArgs)
    ? config.vitestArgs
    : config.vitestArgs
      ? [config.vitestArgs]
      : [];

  if (config.categories?.coverage && config.runCategoryCoverage !== false) {
    for (const type of testTypes) {
      const files = buckets[type] ?? [];
      if (!files.length) continue;
      const typeCoverageDir = path.resolve(
        cwd,
        (config.coverage?.typeDirTemplate ?? path.join(coverageDir, `type-${type}`)).replace(
          "{type}",
          type
        )
      );
      ensureDir(typeCoverageDir);
      const args = [
        ...vitest.args,
        "run",
        ...vitestArgs.filter(Boolean),
        "--coverage",
        "--coverage.reporter=json-summary",
        `--coverage.reportsDirectory=${typeCoverageDir}`,
        "--reporter=json",
        `--outputFile.json=${path.join(
          typeCoverageDir,
          config.coverage?.typeTestSummaryFile ?? "test-summary.json"
        )}`,
        ...files,
      ];
      await runCommand(vitest.command, args, cwd);
    }
  }

  const summaryPath = config.coverageSummaryFile
    ? path.resolve(cwd, config.coverageSummaryFile)
    : path.resolve(cwd, config.coverage?.summaryFile ?? path.join(coverageDir, "coverage-summary.json"));
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Coverage summary not found at ${summaryPath}`);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const total = summary.total;

  const metricToJson = (metric) => ({
    total: metric.total || 0,
    covered: metric.covered || 0,
    pct: metric.total ? (metric.covered / metric.total) * 100 : 0,
  });

  const coverageJson = {
    overall: {
      lines: metricToJson(total.lines),
      functions: metricToJson(total.functions),
      branches: metricToJson(total.branches),
      statements: metricToJson(total.statements),
    },
    categories: buildCoverageCategories(summary, cwd, config.categories?.coverage ?? {}),
  };

  const testsJson = {};
  for (const [name, bucket] of Object.entries(testCounts)) {
    const typeCoverageDir = path.resolve(
      cwd,
      (config.coverage?.typeDirTemplate ?? path.join(coverageDir, `type-${name}`)).replace(
        "{type}",
        name
      )
    );
    const typeCoverageSummary = path.join(typeCoverageDir, "coverage-summary.json");
    testsJson[name] = {
      files: bucket.files,
      tests: bucket.tests,
      coveragePct: loadCoveragePct(typeCoverageSummary) ?? 0,
      results: loadVitestSummary(
        path.join(
          typeCoverageDir,
          config.coverage?.typeTestSummaryFile ?? "test-summary.json"
        )
      ),
    };
  }

  const overallSummary = loadVitestSummary(overallSummaryPath);

  let clocJson = null;
  if (config.cloc?.enabled !== false) {
    const clocArgs = [
      ".",
      "--json",
      "--quiet",
      "--git",
      `--timeout=${config.cloc?.timeout ?? 60}`,
      `--exclude-dir=${(config.cloc?.excludeDirs ?? []).join(",")}`,
      `--exclude-ext=${(config.cloc?.excludeExt ?? []).join(",")}`,
    ];

    const clocAll = await runCloc(cwd, clocArgs, config.cloc?.command);
    if (clocAll) {
      let clocTs = null;
      let clocTsx = null;
      if (config.cloc?.split?.enabled !== false) {
        clocTs = await runCloc(
          cwd,
          [...clocArgs, `--match-f=${config.cloc?.split?.tsPattern ?? "\\.ts$"}`],
          config.cloc?.command
        );
        clocTsx = await runCloc(
          cwd,
          [...clocArgs, `--match-f=${config.cloc?.split?.tsxPattern ?? "\\.tsx$"}`],
          config.cloc?.command
        );
      }
      clocJson = {
        total: readClocSum(clocAll),
        ts: readClocSum(clocTs),
        tsx: readClocSum(clocTsx),
      };
    }
  }

  ensureDir(metricsDir);
  ensureDir(historyDir);

  const now = new Date();
  const timestampFormat = config.history?.timestampFormat ?? "DD.MM.YY.HH.mm.ss";
  const runId = formatTimestamp(now, timestampFormat, config.history?.useLocalTime);
  const filenamePattern = config.history?.filePattern ?? "metrics-{timestamp}.json";
  const runFile = path.join(historyDir, filenamePattern.replace("{timestamp}", runId));

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    cloc: clocJson,
    coverage: coverageJson,
    tests: {
      summary: overallSummary,
      categories: testsJson,
    },
  };

  fs.writeFileSync(metricsFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  fs.writeFileSync(runFile, JSON.stringify(payload, null, 2) + "\n", "utf8");

  return { metricsFile, runFile };
}
