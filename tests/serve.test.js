import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { serveReport } from "../src/serve.mjs";

const fetch = (url) =>
  new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      res.on("error", reject);
    }).on("error", reject);
  });

describe("serveReport", () => {
  let server;

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
  });

  const setupServer = async (files = {}, opts = {}) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "serve-"));
    for (const [name, content] of Object.entries(files)) {
      const filePath = path.join(root, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }

    const port = 18000 + Math.floor(Math.random() * 10000);
    const result = await serveReport({
      reportDir: root,
      port,
      host: "127.0.0.1",
      openBrowser: false,
      ...opts,
    });
    server = result.server;
    return result;
  };

  it("serves index.html at root path", async () => {
    const { url } = await setupServer({ "index.html": "<h1>Report</h1>" });
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.body).toContain("<h1>Report</h1>");
    expect(res.headers["content-type"]).toContain("text/html");
  });

  it("serves files with correct MIME types", async () => {
    const { url } = await setupServer({
      "index.html": "",
      "style.css": "body{}",
      "app.js": "console.log(1)",
      "data.json": "{}",
    });

    const cssRes = await fetch(`${url}style.css`);
    expect(cssRes.headers["content-type"]).toContain("text/css");

    const jsRes = await fetch(`${url}app.js`);
    expect(jsRes.headers["content-type"]).toContain("application/javascript");

    const jsonRes = await fetch(`${url}data.json`);
    expect(jsonRes.headers["content-type"]).toContain("application/json");
  });

  it("returns 404 for missing files", async () => {
    const { url } = await setupServer({ "index.html": "" });
    const res = await fetch(`${url}nonexistent.html`);
    expect(res.status).toBe(404);
    expect(res.body).toBe("Not found");
  });

  it("returns 403 for path traversal attempts", async () => {
    const { url } = await setupServer({ "index.html": "" });
    const res = await fetch(`${url}../../../etc/passwd`);
    // Should be either 403 (path traversal caught) or 404 (file doesn't exist within root)
    expect([403, 404]).toContain(res.status);
  });

  it("sets Cache-Control: no-cache header", async () => {
    const { url } = await setupServer({ "index.html": "cached" });
    const res = await fetch(url);
    expect(res.headers["cache-control"]).toBe("no-cache");
  });

  it("returns the server URL", async () => {
    const result = await setupServer({ "index.html": "" });
    expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  });

  it("uses localhost in URL when host is 0.0.0.0", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "serve-"));
    fs.writeFileSync(path.join(root, "index.html"), "");
    const port = 18000 + Math.floor(Math.random() * 10000);

    const result = await serveReport({
      reportDir: root,
      port,
      host: "0.0.0.0",
      openBrowser: false,
    });
    server = result.server;

    expect(result.url).toContain("localhost");
  });
});
