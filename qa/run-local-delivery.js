const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

const { createLocalInstantStub } = require("./lib/localInstantStub");
const { startStaticServer, findOpenPort } = require("./lib/staticServer");
const { runLocalBrowserSmoke, firstLine } = require("./lib/browserSmoke");

// Archived QA harness for the legacy split frontend/backend delivery surface.
const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const BACKEND_DIR = path.join(ROOT_DIR, "backend");
const DIST_DIR = path.join(FRONTEND_DIR, "dist");
const REPORT_DIR = path.join(ROOT_DIR, "output", "qa");
const EXPECTED_BROWSER_CONSOLE_PATTERNS = [
  /status of 401 \(Unauthorized\)/i,
  /status of 403 \(Forbidden\)/i
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function clearBackendRequireCache() {
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(`${path.sep}backend${path.sep}src${path.sep}`)) {
      delete require.cache[modulePath];
    }
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function extractBuildWarnings(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("can't be bundled without type=\"module\""));
}

function isExpectedBrowserConsoleEntry(entry) {
  return EXPECTED_BROWSER_CONSOLE_PATTERNS.some((pattern) => pattern.test(entry));
}

function verifyDistArtifacts() {
  const requiredFiles = [
    "index.html",
    "login.html",
    "signup.html",
    "student.html",
    "teacher.html",
    "admin.html",
    "js/api.js",
    "js/i18n.js",
    "js/toast.js",
    "js/runtime-config.js",
    "images/background.png",
    "images/unique_hope_logo_cutout_keep_text.png"
  ];

  const missing = requiredFiles.filter((relativePath) => {
    return !fs.existsSync(path.join(DIST_DIR, relativePath));
  });

  return {
    ok: missing.length === 0,
    requiredFiles,
    missing
  };
}

async function startQaBackend(frontendOrigin) {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.TRUST_PROXY = "false";
  process.env.CORS_ORIGIN = frontendOrigin;
  process.env.CSRF_TRUSTED_ORIGINS = frontendOrigin;
  process.env.INSTANT_APP_ID = "qa-local-app";
  process.env.INSTANT_ADMIN_TOKEN = "qa-local-token";

  clearBackendRequireCache();

  const instantStub = createLocalInstantStub();
  const instantModulePath = require.resolve(path.join(BACKEND_DIR, "src", "lib", "instant.js"));
  require.cache[instantModulePath] = {
    id: instantModulePath,
    filename: instantModulePath,
    loaded: true,
    exports: {
      db: instantStub.db,
      id: instantStub.id,
      tx: instantStub.tx
    }
  };

  const { app } = require(path.join(BACKEND_DIR, "src", "app.js"));
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  return {
    server,
    backendBaseUrl: `http://127.0.0.1:${address.port}`,
    credentials: instantStub.credentials,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

function renderMarkdownReport(report) {
  const lines = [
    "# Legacy Local Delivery Report",
    "",
    `- Generated: ${new Date(report.generatedAt).toISOString()}`,
    `- Overall: ${report.summary.status.toUpperCase()}`,
    `- Blocking failures: ${report.summary.blockingFailures}`,
    `- Warnings: ${report.summary.warnings}`,
    "",
    "- Scope: archived split frontend/backend QA surface only",
    "- Current shipping target: repository-root Next.js app (see `DEPLOYMENT.md`)",
    ""
  ];

  lines.push("## Automated Checks", "");
  lines.push(`- Backend tests: ${report.automated.backend.status}`);
  if (report.automated.backend.details) {
    lines.push(`- Backend details: ${report.automated.backend.details}`);
  }
  lines.push(`- Frontend build: ${report.automated.frontend.status}`);
  if (report.automated.frontend.details) {
    lines.push(`- Frontend details: ${report.automated.frontend.details}`);
  }
  lines.push(`- Dist artifact check: ${report.artifacts.status}`);
  if (report.artifacts.missing.length > 0) {
    lines.push(`- Missing dist files: ${report.artifacts.missing.join(", ")}`);
  }
  lines.push("");

  lines.push("## Browser Smoke", "");
  for (const result of report.browser.results) {
    lines.push(`- ${result.status.toUpperCase()}: ${result.name} (${result.durationMs} ms)`);
    if (result.error) {
      lines.push(`  - ${firstLine(result.error)}`);
    }
  }
  lines.push("");

  lines.push("## Warnings", "");
  if (report.warnings.length === 0) {
    lines.push("- None");
  } else {
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push("");

  lines.push("## Diagnostics", "");
  if (
    report.browser.diagnostics.console.length === 0 &&
    report.browser.diagnostics.pageErrors.length === 0 &&
    report.browser.diagnostics.requestFailures.length === 0
  ) {
    lines.push("- No browser diagnostics recorded");
  } else {
    for (const entry of report.browser.diagnostics.console) {
      lines.push(`- Console: ${entry}`);
    }
    for (const entry of report.browser.diagnostics.pageErrors) {
      lines.push(`- Page error: ${firstLine(entry)}`);
    }
    for (const entry of report.browser.diagnostics.requestFailures) {
      lines.push(`- Request failed: ${entry}`);
    }
  }
  lines.push("");

  lines.push("## Archive Notes", "");
  lines.push("- This report covers the retained legacy split stack and is not the production release checklist.");
  lines.push("- Ship the repository-root Next.js app with the root `npm run build` and `npm run start` flow documented in `DEPLOYMENT.md`.");
  lines.push("- Keep `frontend/`, `backend/`, and this local delivery harness as archive/reference material only.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  ensureDir(REPORT_DIR);

  const report = {
    generatedAt: Date.now(),
    automated: {
      backend: { status: "pending", details: "" },
      frontend: { status: "pending", details: "" }
    },
    artifacts: {
      status: "pending",
      missing: []
    },
    browser: {
      results: [],
      diagnostics: {
        console: [],
        pageErrors: [],
        requestFailures: []
      }
    },
    warnings: [],
    summary: {
      status: "passed",
      blockingFailures: 0,
      warnings: 0
    }
  };

  const backendResult = await runCommand("npm", ["test"], BACKEND_DIR);
  if (backendResult.code === 0) {
    report.automated.backend.status = "passed";
    report.automated.backend.details = "Existing backend test suite passed.";
  } else {
    report.automated.backend.status = "failed";
    report.automated.backend.details = firstLine(backendResult.stderr || backendResult.stdout);
    report.summary.blockingFailures += 1;
  }

  const frontendResult = await runCommand("npm", ["run", "build"], FRONTEND_DIR);
  const buildWarnings = extractBuildWarnings(`${frontendResult.stdout}\n${frontendResult.stderr}`);
  report.warnings.push(...buildWarnings);
  if (frontendResult.code === 0) {
    report.automated.frontend.status = "passed";
    report.automated.frontend.details = "Frontend production build completed.";
  } else {
    report.automated.frontend.status = "failed";
    report.automated.frontend.details = firstLine(frontendResult.stderr || frontendResult.stdout);
    report.summary.blockingFailures += 1;
  }

  const artifactCheck = verifyDistArtifacts();
  report.artifacts.status = artifactCheck.ok ? "passed" : "failed";
  report.artifacts.missing = artifactCheck.missing;
  if (!artifactCheck.ok) {
    report.summary.blockingFailures += 1;
  }

  let backendServer = null;
  let staticServer = null;

  try {
    if (report.summary.blockingFailures === 0) {
      const frontendPort = await findOpenPort([4173, 3000, 5173]);
      const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
      backendServer = await startQaBackend(frontendOrigin);
      staticServer = await startStaticServer({
        rootDir: DIST_DIR,
        backendBaseUrl: backendServer.backendBaseUrl,
        port: frontendPort
      });

      const browserReport = await runLocalBrowserSmoke({
        baseUrl: staticServer.origin,
        credentials: backendServer.credentials,
        reportDir: REPORT_DIR,
        headed: process.env.QA_HEADED === "1"
      });
      report.browser = browserReport;
      report.browser.diagnostics.console = report.browser.diagnostics.console.filter(
        (entry) => !isExpectedBrowserConsoleEntry(entry)
      );
    }
  } catch (error) {
    report.browser.results.push({
      name: "browser-smoke",
      status: "failed",
      durationMs: 0,
      error: formatError(error)
    });
    report.summary.blockingFailures += 1;
  } finally {
    if (staticServer) {
      await staticServer.close().catch(() => null);
    }
    if (backendServer) {
      await backendServer.close().catch(() => null);
    }
  }

  if (
    report.browser.diagnostics.console.length > 0 ||
    report.browser.diagnostics.pageErrors.length > 0 ||
    report.browser.diagnostics.requestFailures.length > 0
  ) {
    report.warnings.push(
      ...report.browser.diagnostics.console.map((entry) => `Browser console: ${entry}`),
      ...report.browser.diagnostics.pageErrors.map((entry) => `Browser page error: ${firstLine(entry)}`),
      ...report.browser.diagnostics.requestFailures.map((entry) => `Browser request failure: ${entry}`)
    );
  }

  report.summary.warnings = report.warnings.length;
  if (report.summary.blockingFailures > 0) {
    report.summary.status = "failed";
  }

  const jsonPath = path.join(REPORT_DIR, "local-delivery-report.json");
  const markdownPath = path.join(REPORT_DIR, "local-delivery-report.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, renderMarkdownReport(report));

  if (report.summary.status !== "passed") {
    process.exitCode = 1;
  }
}

function formatError(error) {
  if (!error) return "Unknown error";
  return error.stack || error.message || String(error);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
