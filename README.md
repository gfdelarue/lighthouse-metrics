# litehouse-metrics

Cross-platform CLI to generate test + coverage + cloc metrics and a static HTML report.

## Install (local)
```
npm i -D @gfdlr/litehouse-metrics
```

## Quick start
```
# Run tests + generate metrics JSON
npx @gfdlr/litehouse-metrics run

# Build report + serve at http://localhost:8000
npx @gfdlr/litehouse-metrics serve --open

# Dev mode: run metrics, serve, watch JSON, open browser once
npx @gfdlr/litehouse-metrics dev
```

## Commands
- `run` – runs tests with coverage, optional cloc, writes `metrics/metrics.json` and `metrics/history/metrics-<timestamp>.json`.
- `report` – rebuilds `metrics/report/index.html` from JSON.
- `serve` – rebuilds report and serves `metrics/report/` on port 8000.
- `watch` – watches JSON and rebuilds report on change.
- `dev` – `run` + `serve` + `watch` + open browser once.
- `presets` – list available presets.

## Options
Common options:
- `--cwd <path>` – project root (default: current working directory)
- `--config <path>` – path to `litehouse-metrics.config.json`
- `--preset <name>` – apply a preset (`next`, `node`)
- `--set <key=value>` – override config values (repeatable)
- `--port <number>` – server port (default: 8000)
- `--host <host>` – server host (default: `localhost`)
- `--open` / `--no-open` – open browser
- `--no-cloc` – skip cloc
- `--no-categories` – skip per-category coverage runs
- `--test-command <cmd>` – custom test command to run instead of Vitest
- `--test-summary <path>` – optional path to test summary JSON
- `--coverage-summary <path>` – path to coverage summary JSON

## Config file (optional)
Create `litehouse-metrics.config.json` in your project root to override defaults.
See the template in this repo: `litehouse-metrics.config.json`.

Presets:
- `next` (default)
- `node`

Themes:
- `minimal` (default)
- `neon-hud`
Themes can also change the report layout.
Themes live in `src/report-themes/` and are loaded by filename.
Layouts live in `src/report-layouts/` and are selected by the theme `layout` field.

Add a new theme by copying an existing JSON file in `src/report-themes/` and setting `layout` to `minimal` or `hud`.

Example theme override:
```
{
  "report": {
    "theme": "neon-hud"
  }
}
```

Example override without editing JSON:
```
npx @gfdlr/litehouse-metrics report --set report.charts.coverage.metric=branches
```

## Notes
- `cloc` is optional. If it’s not installed, LOC metrics are omitted.
- `vitest` must be available in the target project (local `node_modules/.bin` preferred).
- If you use `--test-command`, ensure it produces `coverage/coverage-summary.json`. Optionally write a test summary JSON and point to it with `--test-summary`.
- When `--test-command` is used, per-category coverage runs are skipped by default.
