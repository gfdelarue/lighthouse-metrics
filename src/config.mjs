import fs from "fs";
import path from "path";

const DEFAULT_CONFIG_FILENAME = "lighthouse-metrics.config.json";

const PRESETS = {
  next: {
    categories: {
      coverage: {
        "app/api": ["app/api/"],
        "app/ui": ["app/"],
        "pages/api": ["pages/api/"],
        "pages/ui": ["pages/"],
        "src/app/api": ["src/app/api/"],
        "src/app/ui": ["src/app/"],
        "src/pages/api": ["src/pages/api/"],
        "src/pages/ui": ["src/pages/"],
        components: ["components/", "src/components/"],
        lib: ["lib/", "src/lib/"],
        "src/other": ["src/"]
      }
    }
  },
  node: {
    categories: {
      coverage: {
        "src/server": ["src/server/"],
        "src/client": ["src/client/"],
        "src/lib": ["src/lib/"],
        "src": ["src/"],
        "tests": ["tests/"]
      }
    }
  }
};

const DEFAULT_PRESET = "next";

const DEFAULTS = {
  preset: DEFAULT_PRESET,
  metricsDir: "metrics",
  historyDir: "metrics/history",
  reportDir: "metrics/report",
  reportFile: "metrics/report/index.html",
  metricsFile: "metrics/metrics.json",
  coverageDir: "coverage",
  testsDir: "tests",
  port: 8000,
  testCommand: null,
  testSummaryFile: null,
  coverageSummaryFile: null,
  history: {
    timestampFormat: "DD.MM.YY.HH.mm.ss",
    filePattern: "metrics-{timestamp}.json",
    fileRegex: null,
    useLocalTime: false
  },
  runCategoryCoverage: true,
  vitestArgs: [],
  tests: {
    filePattern: "\\.(test|spec)\\.[cm]?[jt]sx?$",
    typeTagPattern: "^\\s*//\\s*@test-type\\s+([a-z0-9-]+)",
    typeSuffixPattern: "\\.(unit|api|integration|ui|e2e)\\.test\\.",
    dirMap: {
      "tests/api/": "api",
      "tests/components/": "ui",
      "tests/app/": "ui",
      "tests/ui/": "ui"
    },
    defaultType: "unit",
    countPattern: "\\b(it|test)(?:\\.each)?\\s*\\("
  },
  coverage: {
    summaryFile: "coverage/coverage-summary.json",
    testSummaryFile: "coverage/test-summary.json",
    typeDirTemplate: "coverage/type-{type}",
    typeTestSummaryFile: "test-summary.json"
  },
  cloc: {
    enabled: true,
    command: "cloc",
    timeout: 60,
    excludeDirs: ["node_modules", ".next", "dist", "build", "out", "coverage", ".turbo"],
    excludeExt: ["json", "md", "txt"],
    split: {
      enabled: true,
      tsPattern: "\\.ts$",
      tsxPattern: "\\.tsx$"
    }
  },
  categories: {
    coverage: {},
    tests: ["unit", "api", "integration", "ui", "e2e", "other"],
  },
  report: {
    title: "Metrics Report",
    subtitle: "Generated {date} (UTC)",
    useLocalTime: false,
    theme: {
      background: "#0f1115",
      backgroundAccent: "#1a1f2b",
      panel: "#171a21",
      muted: "#a3acc2",
      text: "#e6e9ef",
      grid: "#2a2f3a",
      axis: "#4b5263"
    },
    chart: {
      width: 900,
      height: 260,
      yTicks: 5,
      maxLabels: 8,
      padding: {
        top: 28,
        right: 16,
        bottom: 42,
        left: 60
      },
      dualAxisPaddingRight: 60,
      bar: {
        rowHeight: 28,
        padding: {
          top: 28,
          right: 24,
          bottom: 20,
          left: 140
        }
      }
    },
    charts: {
      cloc: {
        enabled: true,
        title: "Code lines (from cloc snapshots)",
        yMin: 0,
        showTotal: true,
        showTs: true,
        showTsx: true,
        colors: {
          total: "#4c78a8",
          ts: "#f58518",
          tsx: "#54a24b"
        }
      },
      coverage: {
        enabled: true,
        title: "Overall coverage (Lines%)",
        metric: "lines",
        yMin: 0,
        yMax: 100,
        color: "#e45756"
      },
      passRateDuration: {
        enabled: true,
        title: "Tests pass rate vs duration",
        passRateColor: "#59a14f",
        durationColor: "#edc949",
        yLeftMin: 0,
        yLeftMax: 100,
        yRightMin: 0,
        yRightMax: 10
      },
      testCategoryCoverage: {
        enabled: true,
        title: "Test Category Coverage (latest)",
        metric: "coveragePct",
        yMax: 100,
        color: "#72b7b2"
      }
    },
    table: {
      enabled: true,
      showCloc: true,
      showCoverage: true,
      showTests: true
    }
  },
  server: {
    host: "localhost",
    baseUrl: null,
    open: null
  }
};

const mergeDeep = (base, override) => {
  if (!override) return base;
  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = mergeDeep(base[key] ?? {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
};

const loadJsonConfig = (configPath) => {
  if (!fs.existsSync(configPath)) return {};
  const raw = fs.readFileSync(configPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${configPath}: ${error.message}`);
  }
};

export async function loadConfig(cwd, overrides = {}, configFile = null) {
  const root = path.resolve(cwd || process.cwd());
  const configPath = configFile
    ? path.resolve(root, configFile)
    : path.join(root, DEFAULT_CONFIG_FILENAME);

  const fileConfig = loadJsonConfig(configPath);
  const presetName =
    overrides.preset ?? fileConfig.preset ?? DEFAULTS.preset ?? DEFAULT_PRESET;
  const presetConfig = PRESETS[presetName] ?? {};

  const merged = mergeDeep(DEFAULTS, presetConfig);
  const mergedFile = mergeDeep(merged, fileConfig);
  const finalConfig = mergeDeep(mergedFile, overrides);

  return {
    ...finalConfig,
    preset: presetName,
    cwd: root,
  };
}

export function listPresets() {
  return Object.keys(PRESETS);
}
