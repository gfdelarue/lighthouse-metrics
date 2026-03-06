import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { loadConfig, listPresets } from "../src/config.mjs";

describe("loadConfig branch coverage", () => {
  it("uses default 'next' preset when no preset specified", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const config = await loadConfig(root);

    expect(config.preset).toBe("next");
    expect(config.categories.coverage).toHaveProperty("app/api");
  });

  it("uses process.cwd when no cwd provided", async () => {
    const config = await loadConfig(null);
    expect(config.cwd).toBe(path.resolve(process.cwd()));
  });

  it("handles unknown preset gracefully", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const config = await loadConfig(root, { preset: "unknown-preset" });

    expect(config.preset).toBe("unknown-preset");
    // Should still have defaults but no preset categories
    expect(config.metricsDir).toBe("metrics");
  });

  it("uses custom config file path", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const customPath = path.join(root, "custom-config.json");
    fs.writeFileSync(customPath, JSON.stringify({ preset: "node", port: 9999 }, null, 2));

    const config = await loadConfig(root, {}, "custom-config.json");

    expect(config.preset).toBe("node");
    expect(config.port).toBe(9999);
  });

  it("returns empty config when config file does not exist", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const config = await loadConfig(root);

    expect(config.preset).toBe("next");
    expect(config.cwd).toBe(root);
  });

  it("throws on malformed JSON config file", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const configPath = path.join(root, "litehouse-metrics.config.json");
    fs.writeFileSync(configPath, "{ invalid json }}}");

    await expect(loadConfig(root)).rejects.toThrow("Failed to parse");
  });

  it("override arrays replace base arrays", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const config = await loadConfig(root, {
      vitestArgs: ["--reporter=verbose"],
    });

    expect(config.vitestArgs).toEqual(["--reporter=verbose"]);
  });

  it("deeply merges nested objects from overrides", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const config = await loadConfig(root, {
      report: {
        chart: {
          width: 1200,
        },
      },
    });

    expect(config.report.chart.width).toBe(1200);
    expect(config.report.chart.height).toBe(260); // default preserved
  });

  it("overrides take precedence over file config", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const configPath = path.join(root, "litehouse-metrics.config.json");
    fs.writeFileSync(configPath, JSON.stringify({ port: 3000 }, null, 2));

    const config = await loadConfig(root, { port: 4000 });

    expect(config.port).toBe(4000);
  });

  it("file config takes precedence over preset defaults", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "litehouse-metrics-"));
    const configPath = path.join(root, "litehouse-metrics.config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({ preset: "node", port: 5000 }, null, 2)
    );

    const config = await loadConfig(root);
    expect(config.port).toBe(5000);
  });
});

describe("listPresets", () => {
  it("returns available preset names", () => {
    const presets = listPresets();
    expect(presets).toContain("next");
    expect(presets).toContain("node");
    expect(presets.length).toBe(2);
  });
});
