import { cac } from "cac";
import path from "path";
import { loadConfig, listPresets } from "./config.mjs";
import { runMetrics } from "./metrics.mjs";
import { buildReport } from "./report.mjs";
import { serveReport } from "./serve.mjs";
import { watchMetrics } from "./watch.mjs";

const fail = (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
};

const log = (message) => {
  process.stdout.write(`${message}\n`);
};

const parseValue = (raw) => {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (raw === "undefined") return undefined;
  if (!Number.isNaN(Number(raw)) && raw.trim() !== "") return Number(raw);
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      return JSON.parse(raw);
    } catch (error) {
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

export function runCli() {
  const cli = cac("lighthouse-metrics");
  const rawArgs = process.argv.slice(2);

  cli
    .command("presets", "List available presets")
    .action(() => {
      const presets = listPresets();
      presets.forEach((preset) => log(preset));
    });

  cli
    .command("run", "Run tests with coverage + cloc and write metrics JSON")
    .option("--cwd <path>", "Project root", { default: process.cwd() })
    .option("--config <path>", "Path to lighthouse-metrics.config.json")
    .option("--preset <name>", "Preset to apply (e.g. next, node)")
    .option("--set <key=value>", "Override config values (repeatable)")
    .option("--test-command <cmd>", "Custom test command to run")
    .option("--test-summary <path>", "Path to test summary JSON (optional)")
    .option("--coverage-summary <path>", "Path to coverage summary JSON")
    .option("--no-cloc", "Skip cloc")
    .option("--cloc", "Force cloc on")
    .option("--categories", "Enable per-category coverage runs")
    .option("--no-categories", "Skip per-category coverage runs")
    .option("--metrics-dir <path>", "Metrics directory")
    .option("--history-dir <path>", "Metrics history directory")
    .option("--report-dir <path>", "Report output directory")
    .option("--report-file <path>", "Report HTML path")
    .option("--metrics-file <path>", "Metrics JSON path")
    .option("--coverage-dir <path>", "Coverage directory")
    .option("--tests-dir <path>", "Tests directory")
    .action(async (options) => {
      try {
        const overrides = buildOverrides(options, rawArgs);
        if (overrides.testCommand) {
          overrides.runCategoryCoverage = false;
        }
        const config = await loadConfig(options.cwd, overrides, options.config);
        const result = await runMetrics(config);
        log(`Metrics written: ${path.relative(config.cwd, result.metricsFile)}`);
        log(`Snapshot written: ${path.relative(config.cwd, result.runFile)}`);
      } catch (error) {
        fail(error);
      }
    });

  cli
    .command("report", "Generate the static HTML report")
    .option("--cwd <path>", "Project root", { default: process.cwd() })
    .option("--config <path>", "Path to lighthouse-metrics.config.json")
    .option("--preset <name>", "Preset to apply (e.g. next, node)")
    .option("--set <key=value>", "Override config values (repeatable)")
    .option("--report-dir <path>", "Report output directory")
    .option("--report-file <path>", "Report HTML path")
    .action(async (options) => {
      try {
        const overrides = buildOverrides(options, rawArgs);
        const config = await loadConfig(options.cwd, overrides, options.config);
        const reportPath = buildReport(config);
        log(`Report written: ${path.relative(config.cwd, reportPath)}`);
      } catch (error) {
        fail(error);
      }
    });

  cli
    .command("serve", "Generate report and serve it locally")
    .option("--cwd <path>", "Project root", { default: process.cwd() })
    .option("--config <path>", "Path to lighthouse-metrics.config.json")
    .option("--preset <name>", "Preset to apply (e.g. next, node)")
    .option("--set <key=value>", "Override config values (repeatable)")
    .option("--port <port>", "Port to serve", { default: 8000 })
    .option("--host <host>", "Host to bind", { default: "localhost" })
    .option("--open", "Open in browser", { default: false })
    .option("--no-open", "Do not open in browser")
    .option("--report-dir <path>", "Report output directory")
    .option("--report-file <path>", "Report HTML path")
    .action(async (options) => {
      try {
        const overrides = buildOverrides(options, rawArgs);
        const config = await loadConfig(options.cwd, overrides, options.config);
        const reportPath = buildReport(config);
        log(`Report written: ${path.relative(config.cwd, reportPath)}`);
        const host = config.server?.host ?? "localhost";
        const openBrowser =
          typeof config.server?.open === "boolean" ? config.server.open : options.open;
        const { url } = await serveReport({
          reportDir: path.resolve(config.cwd, config.reportDir),
          port: config.port,
          host,
          openBrowser,
          baseUrl: config.server?.baseUrl ?? null,
        });
        log(`Serving ${path.relative(config.cwd, config.reportDir)} at ${url}`);
      } catch (error) {
        if (error && error.code === "EADDRINUSE") {
          fail(`Port ${options.port} already in use.`);
        }
        fail(error);
      }
    });

  cli
    .command("watch", "Watch metrics JSON and rebuild report on change")
    .option("--cwd <path>", "Project root", { default: process.cwd() })
    .option("--config <path>", "Path to lighthouse-metrics.config.json")
    .option("--preset <name>", "Preset to apply (e.g. next, node)")
    .option("--set <key=value>", "Override config values (repeatable)")
    .option("--report-dir <path>", "Report output directory")
    .option("--report-file <path>", "Report HTML path")
    .action(async (options) => {
      try {
        const overrides = buildOverrides(options, rawArgs);
        const config = await loadConfig(options.cwd, overrides, options.config);
        buildReport(config);
        const watcher = watchMetrics({
          metricsFile: path.resolve(config.cwd, config.metricsFile),
          historyDir: path.resolve(config.cwd, config.historyDir),
          onChange: () => {
            buildReport(config);
            log("Report updated.");
          },
        });
        log("Watching metrics JSON for changes...");
        process.on("SIGINT", async () => {
          await watcher.close();
          process.exit(0);
        });
      } catch (error) {
        fail(error);
      }
    });

  cli
    .command("dev", "Run metrics, serve report, and watch for updates")
    .option("--cwd <path>", "Project root", { default: process.cwd() })
    .option("--config <path>", "Path to lighthouse-metrics.config.json")
    .option("--preset <name>", "Preset to apply (e.g. next, node)")
    .option("--set <key=value>", "Override config values (repeatable)")
    .option("--port <port>", "Port to serve", { default: 8000 })
    .option("--host <host>", "Host to bind", { default: "localhost" })
    .option("--open", "Open in browser", { default: true })
    .option("--no-open", "Do not open in browser")
    .option("--test-command <cmd>", "Custom test command to run")
    .option("--test-summary <path>", "Path to test summary JSON (optional)")
    .option("--coverage-summary <path>", "Path to coverage summary JSON")
    .option("--no-cloc", "Skip cloc")
    .option("--cloc", "Force cloc on")
    .option("--categories", "Enable per-category coverage runs")
    .option("--no-categories", "Skip per-category coverage runs")
    .option("--metrics-dir <path>", "Metrics directory")
    .option("--history-dir <path>", "Metrics history directory")
    .option("--report-dir <path>", "Report output directory")
    .option("--report-file <path>", "Report HTML path")
    .option("--metrics-file <path>", "Metrics JSON path")
    .option("--coverage-dir <path>", "Coverage directory")
    .option("--tests-dir <path>", "Tests directory")
    .action(async (options) => {
      try {
        const overrides = buildOverrides(options, rawArgs);
        if (overrides.testCommand) {
          overrides.runCategoryCoverage = false;
        }
        const config = await loadConfig(options.cwd, overrides, options.config);

        await runMetrics(config);
        const reportPath = buildReport(config);
        log(`Report written: ${path.relative(config.cwd, reportPath)}`);

        const host = config.server?.host ?? "localhost";
        const openBrowser =
          typeof config.server?.open === "boolean" ? config.server.open : options.open;
        const { url, server } = await serveReport({
          reportDir: path.resolve(config.cwd, config.reportDir),
          port: config.port,
          host,
          openBrowser,
          baseUrl: config.server?.baseUrl ?? null,
        });

        log(`Serving ${path.relative(config.cwd, config.reportDir)} at ${url}`);

        const watcher = watchMetrics({
          metricsFile: path.resolve(config.cwd, config.metricsFile),
          historyDir: path.resolve(config.cwd, config.historyDir),
          onChange: () => {
            buildReport(config);
            log("Report updated.");
          },
        });

        process.on("SIGINT", async () => {
          await watcher.close();
          server.close(() => process.exit(0));
        });
      } catch (error) {
        if (error && error.code === "EADDRINUSE") {
          fail(`Port ${options.port} already in use.`);
        }
        fail(error);
      }
    });

  cli.help();
  cli.parse();
}
