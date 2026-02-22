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
      @import url("https://fonts.googleapis.com/css2?family=Archivo+Black&family=Work+Sans:wght@400;500;600;700&display=swap");

      :root {
        color-scheme: ${theme.colorScheme ?? "light"};
        --bg: ${theme.bg ?? "#faf6f0"};
        --bg-panel: ${theme.bgPanel ?? "#fff9f2"};
        --bg-card: ${theme.bgCard ?? "#ffffff"};
        --ink: ${theme.ink ?? "#2a2825"};
        --muted: ${theme.muted ?? "#7a756d"};
        --grid: ${theme.grid ?? "#e8e2d9"};
        --axis: ${theme.axis ?? "#c4bdb2"};
        --coral: ${theme.neonPink ?? "#e94e3d"};
        --teal: ${theme.neonCyan ?? "#1a9e96"};
        --gold: ${theme.neonYellow ?? "#f2b632"};
        --green: ${theme.neonGreen ?? "#3d9e5c"};
        --purple: ${theme.neonPurple ?? "#7b5aa6"};
        --orange: ${theme.neonOrange ?? "#e97b3d"};
        --border: ${theme.border ?? "rgba(42, 40, 37, 0.12)"};
        --shadow: ${theme.shadow ?? "4px 4px 0 rgba(26, 158, 150, 0.15)"};
        --radius: ${theme.radius ?? "12px"};
        --card-glow: ${theme.cardGlow ?? "4px 4px 0 rgba(26, 158, 150, 0.12)"};
        --stat-card-border: ${theme.statCardBorder ?? "rgba(26, 158, 150, 0.2)"};
        --stat-card-shadow: ${theme.statCardShadow ?? "6px 6px 0 rgba(26, 158, 150, 0.15)"};
        --progress-track: ${theme.progressTrack ?? "rgba(42, 40, 37, 0.08)"};
        --progress-border: ${theme.progressBorder ?? "rgba(42, 40, 37, 0.15)"};
        --progress-health: ${theme.progressHealth ?? "linear-gradient(90deg, #e94e3d, #f06b5d)"};
        --progress-energy: ${theme.progressEnergy ?? "linear-gradient(90deg, #3d9e5c, #5cb87a)"};
        --progress-mana: ${theme.progressMana ?? "linear-gradient(90deg, #1a9e96, #3dbab2)"};
        --progress-xp: ${theme.progressXp ?? "linear-gradient(90deg, #7b5aa6, #9575b8)"};
        --delta-up-bg: ${theme.deltaUpBg ?? "rgba(61, 158, 92, 0.12)"};
        --delta-up-border: ${theme.deltaUpBorder ?? "rgba(61, 158, 92, 0.35)"};
        --delta-down-bg: ${theme.deltaDownBg ?? "rgba(233, 78, 61, 0.12)"};
        --delta-down-border: ${theme.deltaDownBorder ?? "rgba(233, 78, 61, 0.35)"};
        --delta-flat-bg: ${theme.deltaFlatBg ?? "rgba(122, 117, 109, 0.1)"};
        --delta-flat-border: ${theme.deltaFlatBorder ?? "rgba(122, 117, 109, 0.25)"};
        --code-bg: ${theme.codeBg ?? "#2a2825"};
        --code-ink: ${theme.codeInk ?? "#f2b632"};
        --table-border: ${theme.tableBorder ?? "rgba(26, 158, 150, 0.2)"};
        --table-hover: ${theme.tableHover ?? "rgba(26, 158, 150, 0.06)"};
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Work Sans", -apple-system, BlinkMacSystemFont, sans-serif;
        background: var(--bg);
        color: var(--ink);
        min-height: 100vh;
        position: relative;
      }

      /* Halftone dot pattern overlay */
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background-image: radial-gradient(circle, var(--teal) 1px, transparent 1px);
        background-size: 24px 24px;
        opacity: 0.03;
        pointer-events: none;
        z-index: 0;
      }

      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 48px 24px 80px;
        position: relative;
        z-index: 1;
      }

      h1, h2, h3 {
        font-family: "Archivo Black", "Work Sans", sans-serif;
        font-weight: 400;
        margin: 0;
        text-transform: uppercase;
      }

      /* Header block with offset color shadow */
      .header {
        position: relative;
        margin-bottom: 48px;
        padding: 32px 40px;
        background: var(--bg-card);
        border: 3px solid var(--ink);
        border-radius: var(--radius);
        box-shadow:
          8px 8px 0 var(--coral),
          16px 16px 0 var(--teal);
      }

      .header-inner {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }

      .eyebrow {
        font-family: "Work Sans", sans-serif;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        font-size: 11px;
        color: var(--teal);
        margin-bottom: 8px;
        display: inline-block;
        background: rgba(26, 158, 150, 0.1);
        padding: 6px 12px;
        border-radius: 6px;
      }

      h1 {
        font-size: 36px;
        letter-spacing: -0.01em;
        line-height: 1.1;
        color: var(--ink);
      }

      .sub {
        color: var(--muted);
        margin-top: 12px;
        font-size: 15px;
        font-weight: 500;
      }

      .stamp {
        font-family: "Work Sans", sans-serif;
        font-weight: 700;
        font-size: 12px;
        background: var(--gold);
        color: var(--ink);
        padding: 10px 18px;
        border-radius: 999px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        box-shadow: 3px 3px 0 var(--ink);
        white-space: nowrap;
      }

      /* Masonry-style grid layout */
      .layout {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 24px;
      }

      /* Stats row spans full width */
      .stats-row {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
      }

      .stat-block {
        position: relative;
        background: var(--bg-card);
        border: 2px solid var(--ink);
        border-radius: var(--radius);
        padding: 20px;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .stat-block:hover {
        transform: translate(-2px, -2px);
      }

      .stat-block:nth-child(1) { box-shadow: 5px 5px 0 var(--coral); }
      .stat-block:nth-child(2) { box-shadow: 5px 5px 0 var(--teal); }
      .stat-block:nth-child(3) { box-shadow: 5px 5px 0 var(--gold); }
      .stat-block:nth-child(4) { box-shadow: 5px 5px 0 var(--purple); }

      .stat-block:nth-child(1):hover { box-shadow: 7px 7px 0 var(--coral); }
      .stat-block:nth-child(2):hover { box-shadow: 7px 7px 0 var(--teal); }
      .stat-block:nth-child(3):hover { box-shadow: 7px 7px 0 var(--gold); }
      .stat-block:nth-child(4):hover { box-shadow: 7px 7px 0 var(--purple); }

      .stat-label {
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .stat-value {
        font-family: "Archivo Black", sans-serif;
        font-size: 36px;
        line-height: 1;
        margin-bottom: 8px;
      }

      .stat-block:nth-child(1) .stat-value { color: var(--coral); }
      .stat-block:nth-child(2) .stat-value { color: var(--teal); }
      .stat-block:nth-child(3) .stat-value { color: #c9940a; }
      .stat-block:nth-child(4) .stat-value { color: var(--purple); }

      .stat-delta {
        display: inline-block;
        font-weight: 600;
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .stat-note {
        font-size: 12px;
        color: var(--muted);
        margin-top: 8px;
      }

      .delta-up {
        background: var(--delta-up-bg);
        color: var(--green);
        border: 1px solid var(--delta-up-border);
      }

      .delta-down {
        background: var(--delta-down-bg);
        color: var(--coral);
        border: 1px solid var(--delta-down-border);
      }

      .delta-flat {
        background: var(--delta-flat-bg);
        color: var(--muted);
        border: 1px solid var(--delta-flat-border);
      }

      /* Progress bars with risograph style */
      .progress-wrap {
        margin-top: 12px;
      }

      .progress-bar {
        height: 10px;
        background: var(--progress-track);
        border: 2px solid var(--ink);
        border-radius: 999px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        border-radius: 999px;
      }

      .progress-fill.health { background: var(--coral); }
      .progress-fill.energy { background: var(--teal); }
      .progress-fill.mana { background: var(--gold); }
      .progress-fill.xp { background: var(--purple); }

      /* Cards for charts */
      .card {
        position: relative;
        background: var(--bg-card);
        border: 2px solid var(--ink);
        border-radius: var(--radius);
        padding: 24px;
        box-shadow: 5px 5px 0 var(--teal);
      }

      .card--coral { box-shadow: 5px 5px 0 var(--coral); }
      .card--gold { box-shadow: 5px 5px 0 var(--gold); }
      .card--purple { box-shadow: 5px 5px 0 var(--purple); }

      /* Alternate card colors */
      .layout .card:nth-child(odd) { box-shadow: 5px 5px 0 var(--teal); }
      .layout .card:nth-child(even) { box-shadow: 5px 5px 0 var(--coral); }

      .chart-full {
        grid-column: 1 / -1;
      }

      .chart-title {
        font-family: "Archivo Black", sans-serif;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 3px solid var(--ink);
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chart-title::before {
        content: "";
        width: 12px;
        height: 12px;
        background: var(--coral);
        border-radius: 50%;
        border: 2px solid var(--ink);
      }

      .legend {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .legend-dot {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        border: 2px solid var(--ink);
      }

      .chart svg {
        width: 100%;
        height: auto;
      }

      .grid {
        stroke: var(--grid);
        stroke-width: 1;
      }

      .axis {
        stroke: var(--axis);
        stroke-width: 2;
      }

      .axis-label {
        fill: var(--muted);
        font-size: 10px;
        font-family: "Work Sans", sans-serif;
        font-weight: 600;
      }

      /* Section dividers */
      .section-label {
        grid-column: 1 / -1;
        font-family: "Archivo Black", sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        font-size: 13px;
        color: var(--ink);
        margin: 24px 0 0;
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .section-label::after {
        content: "";
        flex: 1;
        height: 3px;
        background: repeating-linear-gradient(
          90deg,
          var(--ink) 0,
          var(--ink) 8px,
          transparent 8px,
          transparent 16px
        );
      }

      /* Data table */
      .table-wrap {
        grid-column: 1 / -1;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      th, td {
        text-align: left;
        padding: 14px 16px;
      }

      th {
        font-family: "Archivo Black", sans-serif;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink);
        background: var(--gold);
        border: 2px solid var(--ink);
      }

      th:first-child {
        border-radius: var(--radius) 0 0 0;
      }

      th:last-child {
        border-radius: 0 var(--radius) 0 0;
      }

      td {
        border-bottom: 2px solid var(--border);
        font-weight: 500;
      }

      tr:hover td {
        background: var(--table-hover);
      }

      /* Code block */
      .code {
        background: var(--code-bg);
        border: 2px solid var(--ink);
        border-radius: var(--radius);
        padding: 16px 20px;
        font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
        font-size: 13px;
        color: var(--code-ink);
        margin-top: 16px;
        box-shadow: 4px 4px 0 var(--teal);
      }

      .empty {
        color: var(--muted);
        padding: 20px;
        text-align: center;
        font-weight: 500;
      }

      @media (max-width: 1000px) {
        .stats-row {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 600px) {
        .stats-row {
          grid-template-columns: 1fr;
        }

        .header-inner {
          flex-direction: column;
          align-items: flex-start;
        }

        h1 {
          font-size: 28px;
        }

        .stat-value {
          font-size: 28px;
        }
      }

      /* Animations */
      @keyframes pop-in {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .pop {
        animation: pop-in 0.4s ease forwards;
      }

      .pop:nth-child(1) { animation-delay: 0ms; }
      .pop:nth-child(2) { animation-delay: 60ms; }
      .pop:nth-child(3) { animation-delay: 120ms; }
      .pop:nth-child(4) { animation-delay: 180ms; }

      @media (prefers-reduced-motion: reduce) {
        .pop {
          animation: none;
        }
      }
    `;

    const body = `
    <main>
      <header class="header">
        <div class="header-inner">
          <div>
            <div class="eyebrow">Metrics Dashboard</div>
            <h1>${reportTitle}</h1>
            ${
              reportConfig.subtitle
                ? `<div class="sub">${reportConfig.subtitle.replace(
                    "{date}",
                    generatedStamp
                  )}</div>`
                : `<div class="sub">Generated ${generatedStamp}</div>`
            }
          </div>
          <div class="stamp">${generatedStamp}</div>
        </div>
      </header>

      <div class="stats-row">
        <div class="stat-block pop">
          <div class="stat-label">Coverage</div>
          <div class="stat-value">${latestCoverage?.overall?.lines?.pct != null ? formatNumber(latestCoverage.overall.lines.pct, 1) : "--"}%</div>
          <div class="stat-delta ${coverageDelta.className}">${coverageDelta.text}</div>
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill health" style="width: ${latestCoverage?.overall?.lines?.pct ?? 0}%"></div>
            </div>
          </div>
          <div class="stat-note">Line coverage</div>
        </div>

        <div class="stat-block pop">
          <div class="stat-label">Pass Rate</div>
          <div class="stat-value">${latestTestSummary?.summary?.passRate != null ? formatNumber(latestTestSummary.summary.passRate, 1) : "--"}%</div>
          <div class="stat-delta ${passRateDelta.className}">${passRateDelta.text}</div>
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill energy" style="width: ${latestTestSummary?.summary?.passRate ?? 0}%"></div>
            </div>
          </div>
          <div class="stat-note">Test success</div>
        </div>

        <div class="stat-block pop">
          <div class="stat-label">Duration</div>
          <div class="stat-value">${latestTestSummary?.summary?.durationMs != null ? formatDuration(latestTestSummary.summary.durationMs) : "--"}</div>
          <div class="stat-delta ${durationDelta.className}">${durationDelta.text}</div>
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill mana" style="width: ${Math.min(100, (latestTestSummary?.summary?.durationMs ?? 0) / 100)}%"></div>
            </div>
          </div>
          <div class="stat-note">Test runtime</div>
        </div>

        <div class="stat-block pop">
          <div class="stat-label">Code Lines</div>
          <div class="stat-value">${latestCloc?.total?.toLocaleString() ?? "--"}</div>
          <div class="stat-delta ${clocDelta.className}">${clocDelta.text}</div>
          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill xp" style="width: ${Math.min(100, Math.log10(latestCloc?.total ?? 1) * 20)}%"></div>
            </div>
          </div>
          <div class="stat-note">Total LOC</div>
        </div>
      </div>

      <div class="layout">
        <div class="section-label">Trend Charts</div>

        ${clocChart ? `
        <div class="card chart-full">
          <div class="chart-title">Lines of Code Over Time</div>
          ${clocChart}
        </div>
        ` : ""}

        ${coverageChart ? `
        <div class="card chart-full">
          <div class="chart-title">Coverage Trend</div>
          ${coverageChart}
        </div>
        ` : ""}

        ${clocMissingMessage}

        ${passRateDurationChart ? `
        <div class="card chart-full">
          <div class="chart-title">Pass Rate & Duration</div>
          ${passRateDurationChart}
        </div>
        ` : ""}

        <div class="card chart-full card--gold">
          <div class="chart-title">Quick Commands</div>
          <p style="color: var(--muted); font-size: 14px; margin: 0 0 8px;">Run these to regenerate metrics</p>
          <div class="code">
            $ npx @gfdlr/lighthouse-metrics run<br />
            $ npx @gfdlr/lighthouse-metrics serve --open
          </div>
        </div>

        ${testCategoryChart ? `
        <div class="card chart-full">
          <div class="chart-title">Test Categories</div>
          ${testCategoryChart}
        </div>
        ` : ""}

        ${
          reportConfig.table?.enabled !== false
            ? `
        <div class="section-label">Data Snapshot</div>

        <div class="table-wrap">
          <div class="card card--coral">
            <div class="chart-title">Latest Metrics</div>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                ${
                  reportConfig.table?.showCloc !== false
                    ? `<tr>
                  <td>Total Code Lines</td>
                  <td><strong>${latestCloc?.total?.toLocaleString() ?? "-"}</strong></td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>TypeScript Lines</td>
                  <td><strong>${latestCloc?.ts?.toLocaleString() ?? "-"}</strong></td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>TSX Lines</td>
                  <td><strong>${latestCloc?.tsx?.toLocaleString() ?? "-"}</strong></td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>`
                    : ""
                }
                ${
                  reportConfig.table?.showCoverage !== false
                    ? `<tr>
                  <td>Coverage (Lines)</td>
                  <td><strong>${latestCoverage?.overall?.lines?.pct?.toFixed(2) ?? "-"}%</strong></td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>Coverage (Functions)</td>
                  <td><strong>${latestCoverage?.overall?.functions?.pct?.toFixed(2) ?? "-"}%</strong></td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>Coverage (Branches)</td>
                  <td><strong>${latestCoverage?.overall?.branches?.pct?.toFixed(2) ?? "-"}%</strong></td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>Coverage (Statements)</td>
                  <td><strong>${latestCoverage?.overall?.statements?.pct?.toFixed(2) ?? "-"}%</strong></td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>`
                    : ""
                }
                ${
                  reportConfig.table?.showTests !== false
                    ? `<tr>
                  <td>Pass Rate</td>
                  <td><strong>${latestTestSummary?.summary?.passRate != null
                    ? `${latestTestSummary.summary.passRate.toFixed(2)}%`
                    : "-"}</strong></td>
                  <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>Test Duration</td>
                  <td><strong>${latestTestSummary?.summary?.durationMs != null
                    ? formatDuration(latestTestSummary.summary.durationMs)
                    : "-"}</strong></td>
                  <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>Tests (Pass/Fail/Skip)</td>
                  <td><strong>${latestTestSummary?.summary
                    ? `${latestTestSummary.summary.total} (${latestTestSummary.summary.passed}/${latestTestSummary.summary.failed}/${latestTestSummary.summary.skipped})`
                    : "-"}</strong></td>
                  <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
                </tr>`
                    : ""
                }
              </tbody>
            </table>
          </div>
        </div>`
            : ""
        }
      </div>
    </main>
    `;

    return { css, body };
  }
};
