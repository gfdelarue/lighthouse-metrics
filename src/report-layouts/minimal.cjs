module.exports = {
  render: (ctx) => {
    const {
      theme,
      reportTitle,
      reportConfig,
      generatedStamp,
      latestCoverage,
      latestTestSummary,
      latestCloc,
      coverageDelta,
      passRateDelta,
      durationDelta,
      clocDelta,
      clocChart,
      clocMissingMessage,
      coverageChart,
      passRateDurationChart,
      testCategoryChart,
      formatNumber,
      formatDuration,
      formatDateShort,
      useLocalTime,
    } = ctx;

    const css = `
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

    const body = `
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

    return { css, body };
  }
};
