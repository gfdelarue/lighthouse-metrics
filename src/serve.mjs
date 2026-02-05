import http from "http";
import fs from "fs";
import path from "path";
import open from "open";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const getMime = (filePath) => MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";

export async function serveReport({ reportDir, port, host, openBrowser, baseUrl }) {
  const root = path.resolve(reportDir);
  const listenHost = host ?? "localhost";

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/") pathname = "/index.html";

    const safePath = path.normalize(pathname).replace(/^([/\\])+/, "");
    const filePath = path.join(root, safePath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": getMime(filePath),
        "Cache-Control": "no-cache",
      });
      res.end(data);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, listenHost, resolve);
  });

  const openHost =
    listenHost === "0.0.0.0" || listenHost === "::" ? "localhost" : listenHost;
  const url = baseUrl ?? `http://${openHost}:${port}/`;
  if (openBrowser) {
    await open(url, { wait: false });
  }

  return { server, url };
}
