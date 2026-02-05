import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.mjs";

describe("loadConfig", () => {
  it("merges presets, config file, and overrides", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lighthouse-metrics-"));
    const configPath = path.join(root, "lighthouse-metrics.config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          preset: "node",
          report: {
            charts: {
              cloc: {
                yMin: 10,
              },
            },
          },
        },
        null,
        2
      )
    );

    const config = await loadConfig(root, {
      report: {
        charts: {
          cloc: {
            yMin: 5,
          },
        },
      },
    });

    expect(config.preset).toBe("node");
    expect(config.categories.coverage).toHaveProperty("src/server");
    expect(config.report.charts.cloc.yMin).toBe(5);
  });
});
