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
      coverageLevel,
      passRateRank,
    } = ctx;

    const css = `
      @import url("https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap");

      :root {
        color-scheme: ${theme.colorScheme ?? "dark"};
        --bg: ${theme.bg ?? "#0a0a0f"};
        --bg-panel: ${theme.bgPanel ?? "#12121a"};
        --bg-card: ${theme.bgCard ?? "#1a1a25"};
        --ink: ${theme.ink ?? "#e8e8f0"};
        --muted: ${theme.muted ?? "#6b6b80"};
        --grid: ${theme.grid ?? "#252535"};
        --axis: ${theme.axis ?? "#3a3a50"};
        --neon-cyan: ${theme.neonCyan ?? "#00f5ff"};
        --neon-pink: ${theme.neonPink ?? "#ff006e"};
        --neon-yellow: ${theme.neonYellow ?? "#ffea00"};
        --neon-green: ${theme.neonGreen ?? "#39ff14"};
        --neon-purple: ${theme.neonPurple ?? "#bf00ff"};
        --neon-orange: ${theme.neonOrange ?? "#ff6b35"};
        --border: ${theme.border ?? "rgba(0, 245, 255, 0.2)"};
        --shadow: ${theme.shadow ?? "0 0 40px rgba(0, 245, 255, 0.1)"};
        --radius: ${theme.radius ?? "4px"};
        --scanline: ${theme.scanline ?? "rgba(0, 0, 0, 0.1)"};
        --grid-line: ${theme.gridLine ?? "rgba(0, 245, 255, 0.03)"};
        --title-glow: ${theme.titleGlow ?? "rgba(0, 245, 255, 0.5)"};
        --top-glow: ${theme.topGlow ?? "rgba(0, 245, 255, 0.05)"};
        --eyebrow-glow: ${theme.eyebrowGlow ?? "rgba(0, 245, 255, 0.5)"};
        --stamp-glow: ${theme.stampGlow ?? "rgba(255, 234, 0, 0.1)"};
        --section-glow: ${theme.sectionGlow ?? "rgba(191, 0, 255, 0.4)"};
        --card-glow: ${theme.cardGlow ?? "0 0 0 1px rgba(0, 245, 255, 0.1), inset 0 0 40px rgba(0, 245, 255, 0.02)"};
        --panel-divider: ${theme.panelDivider ?? "rgba(0, 245, 255, 0.2)"};
        --stat-card-glow: ${theme.statCardGlow ?? "rgba(0, 245, 255, 0.05)"};
        --stat-card-border: ${theme.statCardBorder ?? "rgba(0, 245, 255, 0.15)"};
        --stat-card-border-hover: ${theme.statCardBorderHover ?? "rgba(0, 245, 255, 0.4)"};
        --stat-card-shadow: ${theme.statCardShadow ?? "0 0 30px rgba(0, 245, 255, 0.1)"};
        --progress-track: ${theme.progressTrack ?? "rgba(0, 0, 0, 0.4)"};
        --progress-border: ${theme.progressBorder ?? "rgba(255, 255, 255, 0.1)"};
        --progress-shimmer: ${theme.progressShimmer ?? "rgba(255, 255, 255, 0.3)"};
        --progress-health: ${theme.progressHealth ?? "linear-gradient(90deg, #ff4757, #ff6b81, #ff4757)"};
        --progress-health-glow: ${theme.progressHealthGlow ?? "0 0 10px rgba(255, 71, 87, 0.5)"};
        --progress-xp: ${theme.progressXp ?? "linear-gradient(90deg, #3742fa, #5352ed, #3742fa)"};
        --progress-xp-glow: ${theme.progressXpGlow ?? "0 0 10px rgba(55, 66, 250, 0.5)"};
        --progress-energy: ${theme.progressEnergy ?? "linear-gradient(90deg, #2ed573, #7bed9f, #2ed573)"};
        --progress-energy-glow: ${theme.progressEnergyGlow ?? "0 0 10px rgba(46, 213, 115, 0.5)"};
        --progress-mana: ${theme.progressMana ?? "linear-gradient(90deg, #00d2d3, #54a0ff, #00d2d3)"};
        --progress-mana-glow: ${theme.progressManaGlow ?? "0 0 10px rgba(0, 210, 211, 0.5)"};
        --level-badge-bg: ${theme.levelBadgeBg ?? "rgba(255, 215, 0, 0.1)"};
        --level-badge-border: ${theme.levelBadgeBorder ?? "rgba(255, 215, 0, 0.3)"};
        --level-badge-color: ${theme.levelBadgeColor ?? "#ffd700"};
        --level-badge-glow: ${theme.levelBadgeGlow ?? "rgba(255, 215, 0, 0.5)"};
        --delta-up-bg: ${theme.deltaUpBg ?? "rgba(57, 255, 20, 0.1)"};
        --delta-up-border: ${theme.deltaUpBorder ?? "rgba(57, 255, 20, 0.3)"};
        --delta-up-glow: ${theme.deltaUpGlow ?? "rgba(57, 255, 20, 0.5)"};
        --delta-down-bg: ${theme.deltaDownBg ?? "rgba(255, 0, 110, 0.1)"};
        --delta-down-border: ${theme.deltaDownBorder ?? "rgba(255, 0, 110, 0.3)"};
        --delta-down-glow: ${theme.deltaDownGlow ?? "rgba(255, 0, 110, 0.5)"};
        --delta-flat-bg: ${theme.deltaFlatBg ?? "rgba(107, 107, 128, 0.1)"};
        --delta-flat-border: ${theme.deltaFlatBorder ?? "rgba(107, 107, 128, 0.3)"};
        --code-bg: ${theme.codeBg ?? "#0d0d12"};
        --code-ink: ${theme.codeInk ?? "#39ff14"};
        --code-glow: ${theme.codeGlow ?? "rgba(57, 255, 20, 0.3)"};
        --table-border: ${theme.tableBorder ?? "rgba(0, 245, 255, 0.1)"};
        --table-hover: ${theme.tableHover ?? "rgba(0, 245, 255, 0.03)"};
        --xp-bg: ${theme.xpBg ?? "linear-gradient(135deg, rgba(191, 0, 255, 0.08), transparent)"};
        --xp-border: ${theme.xpBorder ?? "rgba(191, 0, 255, 0.2)"};
        --achievement-bg: ${theme.achievementBg ?? "rgba(255, 234, 0, 0.05)"};
        --achievement-border: ${theme.achievementBorder ?? "rgba(255, 234, 0, 0.15)"};
        --achievement-icon-glow: ${theme.achievementIconGlow ?? "rgba(255, 234, 0, 0.3)"};
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Rajdhani", "Segoe UI", system-ui, sans-serif;
        background: var(--bg);
        color: var(--ink);
        min-height: 100vh;
        overflow-x: hidden;
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        background: repeating-linear-gradient(
          0deg,
          var(--scanline),
          var(--scanline) 1px,
          transparent 1px,
          transparent 2px
        );
        pointer-events: none;
        z-index: 1000;
        opacity: 0.5;
      }

      body::after {
        content: "";
        position: fixed;
        inset: 0;
        background-image:
          linear-gradient(var(--grid-line) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
        background-size: 50px 50px;
        pointer-events: none;
        z-index: 0;
      }

      main {
        max-width: 1280px;
        margin: 0 auto;
        padding: 32px 24px 72px;
        position: relative;
        z-index: 1;
      }

      h1, h2, h3 {
        font-family: "Orbitron", "Rajdhani", sans-serif;
        font-weight: 700;
        margin: 0;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      h1 {
        font-size: 28px;
        background: linear-gradient(90deg, var(--neon-cyan), var(--neon-pink));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 0 20px var(--title-glow));
      }

      .top {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 24px;
        align-items: start;
        margin-bottom: 32px;
        padding: 24px;
        background: linear-gradient(135deg, var(--bg-panel), var(--top-glow));
        border: 1px solid var(--border);
        border-radius: var(--radius);
        position: relative;
        overflow: hidden;
      }

      .top::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, var(--neon-cyan), var(--neon-pink), var(--neon-yellow));
        animation: scanline 3s linear infinite;
      }

      @keyframes scanline {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .eyebrow {
        font-family: "Share Tech Mono", monospace;
        text-transform: uppercase;
        letter-spacing: 0.3em;
        font-size: 11px;
        color: var(--neon-cyan);
        margin-bottom: 8px;
        text-shadow: 0 0 10px var(--eyebrow-glow);
      }

      .sub {
        color: var(--muted);
        margin-top: 8px;
        font-size: 14px;
        letter-spacing: 0.05em;
      }

      .stamp {
        font-family: "Share Tech Mono", monospace;
        font-size: 11px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 8px 16px;
        color: var(--neon-yellow);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        box-shadow: 0 0 20px var(--stamp-glow);
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
        gap: 24px;
      }

      .rail {
        display: grid;
        gap: 20px;
        align-content: start;
      }

      .deck {
        display: grid;
        gap: 20px;
      }

      .section-label {
        font-family: "Orbitron", sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        font-size: 12px;
        color: var(--neon-purple);
        margin: 0 0 12px;
        text-shadow: 0 0 15px var(--section-glow);
      }

      .card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 20px;
        position: relative;
        overflow: hidden;
        box-shadow: var(--card-glow);
      }

      .card::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        border-top: 2px solid var(--neon-cyan);
        border-left: 2px solid var(--neon-cyan);
        border-radius: var(--radius) 0 0 0;
      }

      .card::after {
        content: "";
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        border-bottom: 2px solid var(--neon-pink);
        border-right: 2px solid var(--neon-pink);
        border-radius: 0 0 var(--radius) 0;
      }

      .card > * {
        position: relative;
        z-index: 1;
      }

      .card--chart {
        padding: 24px;
      }

      .panel-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: "Orbitron", sans-serif;
        font-size: 12px;
        color: var(--neon-cyan);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--panel-divider);
      }

      .stat-card {
        display: grid;
        gap: 12px;
        padding: 16px;
        background: linear-gradient(135deg, var(--stat-card-glow), transparent);
        border: 1px solid var(--stat-card-border);
        border-radius: var(--radius);
        position: relative;
        transition: all 0.3s ease;
      }

      .stat-card:hover {
        border-color: var(--stat-card-border-hover);
        box-shadow: var(--stat-card-shadow);
      }

      .stat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .stat-label {
        font-family: "Share Tech Mono", monospace;
        color: var(--muted);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.15em;
      }

      .stat-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      }

      .stat-value-row {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }

      .stat-value {
        font-family: "Orbitron", sans-serif;
        font-size: 32px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .stat-rank {
        font-family: "Orbitron", sans-serif;
        font-size: 24px;
        font-weight: 900;
        padding: 4px 12px;
        border-radius: var(--radius);
        text-shadow: 0 0 20px currentColor;
      }

      .progress-container {
        display: grid;
        gap: 8px;
      }

      .progress-header {
        display: flex;
        justify-content: space-between;
        font-family: "Share Tech Mono", monospace;
        font-size: 10px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .progress-bar {
        height: 8px;
        background: var(--progress-track);
        border-radius: 4px;
        overflow: hidden;
        position: relative;
        border: 1px solid var(--progress-border);
      }

      .progress-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 1s ease-out;
        position: relative;
        overflow: hidden;
      }

      .progress-fill::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, var(--progress-shimmer), transparent);
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }

      .progress-fill.health {
        background: var(--progress-health);
        box-shadow: var(--progress-health-glow);
      }

      .progress-fill.xp {
        background: var(--progress-xp);
        box-shadow: var(--progress-xp-glow);
      }

      .progress-fill.energy {
        background: var(--progress-energy);
        box-shadow: var(--progress-energy-glow);
      }

      .progress-fill.mana {
        background: var(--progress-mana);
        box-shadow: var(--progress-mana-glow);
      }

      .level-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: var(--level-badge-bg);
        border: 1px solid var(--level-badge-border);
        border-radius: var(--radius);
        font-family: "Orbitron", sans-serif;
        font-size: 11px;
        color: var(--level-badge-color);
        text-shadow: 0 0 10px var(--level-badge-glow);
      }

      .level-num {
        font-size: 14px;
        font-weight: 700;
      }

      .delta {
        font-family: "Share Tech Mono", monospace;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 4px 8px;
        border-radius: 3px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .delta-up {
        color: var(--neon-green);
        background: var(--delta-up-bg);
        border: 1px solid var(--delta-up-border);
        text-shadow: 0 0 10px var(--delta-up-glow);
      }

      .delta-down {
        color: var(--neon-pink);
        background: var(--delta-down-bg);
        border: 1px solid var(--delta-down-border);
        text-shadow: 0 0 10px var(--delta-down-glow);
      }

      .delta-flat {
        color: var(--muted);
        background: var(--delta-flat-bg);
        border: 1px solid var(--delta-flat-border);
      }

      .info {
        font-size: 13px;
        color: var(--muted);
        line-height: 1.6;
        letter-spacing: 0.02em;
      }

      .code {
        background: var(--code-bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 16px;
        font-family: "Share Tech Mono", ui-monospace, monospace;
        font-size: 12px;
        color: var(--code-ink);
        margin-top: 12px;
        text-shadow: 0 0 5px var(--code-glow);
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
        font-family: "Share Tech Mono", monospace;
      }

      .chart-title {
        font-family: "Orbitron", sans-serif;
        font-size: 14px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--neon-cyan);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .chart-title::after {
        content: "";
        height: 2px;
        flex: 1;
        margin-left: 16px;
        background: linear-gradient(90deg, var(--neon-cyan), transparent);
        border-radius: 999px;
      }

      .legend {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;
        color: var(--muted);
        font-size: 11px;
        font-family: "Share Tech Mono", monospace;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        box-shadow: 0 0 10px currentColor;
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
        padding: 12px;
        border-bottom: 1px solid var(--table-border);
      }

      th {
        font-family: "Orbitron", sans-serif;
        color: var(--neon-cyan);
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      td {
        color: var(--ink);
        font-family: "Rajdhani", sans-serif;
      }

      tr:hover td {
        background: var(--table-hover);
      }

      .empty {
        color: var(--muted);
        padding: 16px;
        font-family: "Share Tech Mono", monospace;
        text-align: center;
      }

      .stat-stack {
        display: grid;
        gap: 16px;
      }

      .xp-section {
        display: grid;
        gap: 12px;
        padding: 16px;
        background: var(--xp-bg);
        border: 1px solid var(--xp-border);
        border-radius: var(--radius);
      }

      .xp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .xp-title {
        font-family: "Orbitron", sans-serif;
        font-size: 11px;
        color: var(--neon-purple);
        text-transform: uppercase;
        letter-spacing: 0.15em;
      }

      .xp-value {
        font-family: "Share Tech Mono", monospace;
        font-size: 12px;
        color: var(--neon-yellow);
      }

      .achievement {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--achievement-bg);
        border: 1px solid var(--achievement-border);
        border-radius: var(--radius);
      }

      .achievement-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--neon-yellow), var(--neon-orange));
        border-radius: 50%;
        font-size: 20px;
        box-shadow: 0 0 20px var(--achievement-icon-glow);
      }

      .achievement-info {
        flex: 1;
      }

      .achievement-name {
        font-family: "Orbitron", sans-serif;
        font-size: 12px;
        color: var(--neon-yellow);
        letter-spacing: 0.05em;
      }

      .achievement-desc {
        font-size: 11px;
        color: var(--muted);
        margin-top: 2px;
      }

      .divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--border), transparent);
        margin: 16px 0;
      }

      .muted-line {
        font-size: 11px;
        color: var(--muted);
        font-family: "Share Tech Mono", monospace;
        text-align: center;
        letter-spacing: 0.05em;
      }

      @media (max-width: 980px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .top {
          grid-template-columns: 1fr;
          align-items: start;
        }
        .stamp {
          justify-self: start;
        }
      }

      @keyframes glitch {
        0%, 100% { transform: translate(0); }
        20% { transform: translate(-2px, 2px); }
        40% { transform: translate(-2px, -2px); }
        60% { transform: translate(2px, 2px); }
        80% { transform: translate(2px, -2px); }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .reveal {
        animation: fadeUp 600ms ease forwards;
      }

      .reveal:nth-child(2) { animation-delay: 80ms; }
      .reveal:nth-child(3) { animation-delay: 160ms; }
      .reveal:nth-child(4) { animation-delay: 240ms; }
      .reveal:nth-child(5) { animation-delay: 320ms; }

      .glitch:hover {
        animation: glitch 0.3s ease infinite;
      }

      .pulse {
        animation: pulse 2s ease infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .reveal, .pulse, .glitch {
          animation: none;
        }
      }
    `;

    const body = `
    <main>
      <div class="top reveal">
        <div>
          <div class="eyebrow">⚡ Developer Metrics HUD v2.0</div>
          <h1 class="glitch">${reportTitle}</h1>
          ${
            reportConfig.subtitle
              ? `<div class="sub">${reportConfig.subtitle.replace(
                  "{date}",
                  generatedStamp
                )}</div>`
              : `<div class="sub">Session recorded: ${generatedStamp}</div>`
          }
        </div>
        <div class="stamp pulse">● LIVE // ${generatedStamp}</div>
      </div>

      <div class="layout">
        <aside class="rail">
          <div class="card reveal">
            <div class="panel-title">
              <span>⚔️ Player Stats</span>
              <span class="level-badge">
                <span>LVL</span>
                <span class="level-num">${coverageLevel.level}</span>
              </span>
            </div>
            
            <div class="stat-stack">
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">❤️ Coverage Health</span>
                  <span class="stat-rank" style="color: ${coverageLevel.color}; text-shadow: 0 0 15px ${coverageLevel.color};">${coverageLevel.title}</span>
                </div>
                <div class="stat-value-row">
                  <span class="stat-value" style="color: ${coverageLevel.color};">${latestCoverage?.overall?.lines?.pct != null ? formatNumber(latestCoverage.overall.lines.pct, 1) : "--"}%</span>
                  <span class="delta ${coverageDelta.className}">${coverageDelta.text}</span>
                </div>
                <div class="progress-container" style="margin-top: 8px;">
                  <div class="progress-bar">
                    <div class="progress-fill health" style="width: ${latestCoverage?.overall?.lines?.pct ?? 0}%"></div>
                  </div>
                  <div class="progress-header">
                    <span>HP</span>
                    <span>${Math.round(latestCoverage?.overall?.lines?.pct ?? 0)}/100</span>
                  </div>
                </div>
              </div>
              
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">⭐ Pass Rate Rank</span>
                  <span class="stat-rank" style="color: ${passRateRank.color}; text-shadow: 0 0 15px ${passRateRank.glow};">${passRateRank.rank}</span>
                </div>
                <div class="stat-value-row">
                  <span class="stat-value" style="color: ${passRateRank.color};">${latestTestSummary?.summary?.passRate != null ? formatNumber(latestTestSummary.summary.passRate, 1) : "--"}%</span>
                  <span class="delta ${passRateDelta.className}">${passRateDelta.text}</span>
                </div>
                <div class="progress-container" style="margin-top: 8px;">
                  <div class="progress-bar">
                    <div class="progress-fill energy" style="width: ${latestTestSummary?.summary?.passRate ?? 0}%"></div>
                  </div>
                  <div class="progress-header">
                    <span>XP</span>
                    <span>${Math.round(latestTestSummary?.summary?.passRate ?? 0)}/100</span>
                  </div>
                </div>
              </div>
              
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">⚡ Test Duration</span>
                  <span class="stat-icon">⏱️</span>
                </div>
                <div class="stat-value-row">
                  <span class="stat-value" style="color: var(--neon-yellow);">${latestTestSummary?.summary?.durationMs != null ? formatDuration(latestTestSummary.summary.durationMs) : "--"}</span>
                  <span class="delta ${durationDelta.className}">${durationDelta.text}</span>
                </div>
                <div class="progress-container" style="margin-top: 8px;">
                  <div class="progress-bar">
                    <div class="progress-fill mana" style="width: ${Math.min(100, (latestTestSummary?.summary?.durationMs ?? 0) / 100)}%"></div>
                  </div>
                  <div class="progress-header">
                    <span>MP</span>
                    <span>${latestTestSummary?.summary?.durationMs ?? 0}ms</span>
                  </div>
                </div>
              </div>
              
              <div class="stat-card">
                <div class="stat-header">
                  <span class="stat-label">💎 Code Score</span>
                  <span class="stat-icon">💰</span>
                </div>
                <div class="stat-value-row">
                  <span class="stat-value" style="color: var(--neon-purple);">${latestCloc?.total?.toLocaleString() ?? "--"}</span>
                  <span class="delta ${clocDelta.className}">${clocDelta.text}</span>
                </div>
                <div class="progress-container" style="margin-top: 8px;">
                  <div class="progress-bar">
                    <div class="progress-fill xp" style="width: ${Math.min(100, Math.log10(latestCloc?.total ?? 1) * 10)}%"></div>
                  </div>
                  <div class="progress-header">
                    <span>LINES</span>
                    <span>${latestCloc?.total?.toLocaleString() ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="divider"></div>
            <div class="muted-line">◄ STATS COMPARED VS PREVIOUS RUN ►</div>
          </div>
          
          ${latestCoverage?.overall?.lines?.pct >= 80 ? `
          <div class="card reveal">
            <div class="panel-title">🏆 Achievement Unlocked</div>
            <div class="achievement">
              <div class="achievement-icon">🛡️</div>
              <div class="achievement-info">
                <div class="achievement-name">Code Guardian</div>
                <div class="achievement-desc">Reach 80%+ coverage</div>
              </div>
            </div>
          </div>
          ` : ""}

          <div class="card reveal">
            <div class="panel-title">⌨️ Command Terminal</div>
            <div class="info">Execute commands to rebuild metrics</div>
            <div class="code">
              > npx @gfdlr/litehouse-metrics run<br />
              > npx @gfdlr/litehouse-metrics serve --open<br />
              <span style="color: var(--muted);">_</span>
            </div>
          </div>
        </aside>

        <section class="deck">
          <div class="section-label reveal">📊 Mission Trends</div>
          ${clocChart ? `<div class="card card--chart reveal">${clocChart}</div>` : ""}
          ${clocMissingMessage}

          ${coverageChart ? `<div class="card card--chart reveal">${coverageChart}</div>` : ""}

          ${passRateDurationChart ? `<div class="card card--chart reveal">${passRateDurationChart}</div>` : ""}

          ${testCategoryChart ? `<div class="card card--chart reveal">${testCategoryChart}</div>` : ""}

          ${
            reportConfig.table?.enabled !== false
              ? `<div class="card reveal">
            <div class="chart-title">📋 Latest Snapshot Data</div>
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
                  <td>💎 Total Code Lines</td>
                  <td>${latestCloc?.total?.toLocaleString() ?? "-"}</td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>📘 TS Code Lines</td>
                  <td>${latestCloc?.ts?.toLocaleString() ?? "-"}</td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>📗 TSX Code Lines</td>
                  <td>${latestCloc?.tsx?.toLocaleString() ?? "-"}</td>
                  <td>${latestCloc?.date ? formatDateShort(latestCloc.date, useLocalTime) : "-"}</td>
                </tr>`
                    : ""
                }
                ${
                  reportConfig.table?.showCoverage !== false
                    ? `<tr>
                  <td>🎯 Coverage (Lines%)</td>
                  <td>${latestCoverage?.overall?.lines?.pct?.toFixed(2) ?? "-"}%</td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>🔧 Coverage (Funcs%)</td>
                  <td>${latestCoverage?.overall?.functions?.pct?.toFixed(2) ?? "-"}%</td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>🌿 Coverage (Branch%)</td>
                  <td>${latestCoverage?.overall?.branches?.pct?.toFixed(2) ?? "-"}%</td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>📝 Coverage (Stmts%)</td>
                  <td>${latestCoverage?.overall?.statements?.pct?.toFixed(2) ?? "-"}%</td>
                  <td>${latestCoverage?.date ? formatDateShort(latestCoverage.date, useLocalTime) : "-"}</td>
                </tr>`
                    : ""
                }
                ${
                  reportConfig.table?.showTests !== false
                    ? `<tr>
                  <td>✅ Tests Pass Rate</td>
                  <td>${latestTestSummary?.summary?.passRate != null
                    ? `${latestTestSummary.summary.passRate.toFixed(2)}%`
                    : "-"}</td>
                  <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>⏱️ Tests Duration</td>
                  <td>${latestTestSummary?.summary?.durationMs != null
                    ? formatDuration(latestTestSummary.summary.durationMs)
                    : "-"}</td>
                  <td>${latestTestSummary?.date ? formatDateShort(latestTestSummary.date, useLocalTime) : "-"}</td>
                </tr>
                <tr>
                  <td>🎮 Tests Score (P/F/S)</td>
                  <td>${latestTestSummary?.summary
                    ? `${latestTestSummary.summary.total} <span style="color:var(--neon-green)">${latestTestSummary.summary.passed}</span>/<span style="color:var(--neon-pink)">${latestTestSummary.summary.failed}</span>/<span style="color:var(--neon-yellow)">${latestTestSummary.summary.skipped}</span>`
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
        </section>
      </div>
    </main>
    `;

    return { css, body };
  }
};
