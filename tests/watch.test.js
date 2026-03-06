import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchMetrics } from "../src/watch.mjs";

describe("watchMetrics", () => {
  let watcher;

  afterEach(async () => {
    if (watcher) {
      await watcher.close();
      watcher = null;
    }
  });

  it("returns a watcher instance", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "watch-"));
    const metricsFile = path.join(root, "metrics.json");
    const historyDir = path.join(root, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(metricsFile, "{}");

    watcher = watchMetrics({
      metricsFile,
      historyDir,
      onChange: () => {},
    });

    expect(watcher).toBeDefined();
    expect(typeof watcher.close).toBe("function");
  });

  it("calls onChange when metrics file changes", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "watch-"));
    const metricsFile = path.join(root, "metrics.json");
    const historyDir = path.join(root, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(metricsFile, "{}");

    const onChange = vi.fn();
    watcher = watchMetrics({ metricsFile, historyDir, onChange });

    // Wait for watcher to be ready
    await new Promise((resolve) => watcher.on("ready", resolve));

    // Trigger a change
    fs.writeFileSync(metricsFile, JSON.stringify({ updated: true }));

    // Wait for debounce (200ms) + some buffer
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(onChange).toHaveBeenCalled();
  });

  it("calls onChange when a history file is added", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "watch-"));
    const metricsFile = path.join(root, "metrics.json");
    const historyDir = path.join(root, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(metricsFile, "{}");

    const onChange = vi.fn();
    watcher = watchMetrics({ metricsFile, historyDir, onChange });

    await new Promise((resolve) => watcher.on("ready", resolve));

    // Add a new history file
    fs.writeFileSync(path.join(historyDir, "metrics-new.json"), "{}");

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(onChange).toHaveBeenCalled();
  });

  it("debounces rapid changes into a single callback", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "watch-"));
    const metricsFile = path.join(root, "metrics.json");
    const historyDir = path.join(root, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(metricsFile, "{}");

    const onChange = vi.fn();
    watcher = watchMetrics({ metricsFile, historyDir, onChange });

    await new Promise((resolve) => watcher.on("ready", resolve));

    // Trigger multiple rapid changes
    fs.writeFileSync(metricsFile, JSON.stringify({ v: 1 }));
    fs.writeFileSync(metricsFile, JSON.stringify({ v: 2 }));
    fs.writeFileSync(metricsFile, JSON.stringify({ v: 3 }));

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should be debounced — fewer calls than writes
    expect(onChange.mock.calls.length).toBeLessThanOrEqual(2);
    expect(onChange).toHaveBeenCalled();
  });
});
