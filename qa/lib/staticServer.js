const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function findOpenPort(preferredPorts) {
  return new Promise((resolve, reject) => {
    const ports = [...preferredPorts];

    function tryNext() {
      const port = ports.shift();
      if (port === undefined) {
        reject(new Error("No free frontend preview port found"));
        return;
      }

      const tester = http.createServer();
      tester.once("error", () => {
        tester.close(() => tryNext());
      });
      tester.once("listening", () => {
        const address = tester.address();
        tester.close(() => resolve(address.port));
      });
      tester.listen(port, "127.0.0.1");
    }

    tryNext();
  });
}

function proxyApiRequest(req, res, targetBaseUrl) {
  const targetUrl = new URL(req.url, targetBaseUrl);
  const client = targetUrl.protocol === "https:" ? https : http;

  const proxyRequest = client.request(
    targetUrl,
    {
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host
      }
    },
    (proxyResponse) => {
      res.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    }
  );

  proxyRequest.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: error.message } }));
  });

  req.pipe(proxyRequest);
}

function resolveAssetPath(rootDir, requestPathname) {
  const pathname = requestPathname === "/" ? "/index.html" : requestPathname;
  const relativePath = pathname.replace(/^\/+/, "");
  const absolutePath = path.resolve(rootDir, relativePath);

  if (!absolutePath.startsWith(path.resolve(rootDir))) {
    return null;
  }

  return absolutePath;
}

async function startStaticServer({ rootDir, backendBaseUrl, preferredPorts = [4173, 3000, 5173], port: explicitPort }) {
  const port = explicitPort || (await findOpenPort(preferredPorts));

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, "http://127.0.0.1");
    if (requestUrl.pathname.startsWith("/api/")) {
      proxyApiRequest(req, res, backendBaseUrl);
      return;
    }

    const assetPath = resolveAssetPath(rootDir, requestUrl.pathname);
    if (!assetPath || !fs.existsSync(assetPath) || fs.statSync(assetPath).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const extension = path.extname(assetPath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    fs.createReadStream(assetPath).pipe(res);
  });

  await new Promise((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    port,
    server,
    origin: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

module.exports = { startStaticServer, findOpenPort };
