#!/usr/bin/env node

const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const preferredPorts = parsePortList(process.env.SYSTEM_LAUNCHER_PORTS) ?? [3000, 3001, 3002, 3005];
const entryPaths = ["/login", "/dashboard", "/command-center"];
const readyTimeoutMs = Number(process.env.SYSTEM_LAUNCHER_READY_TIMEOUT_MS ?? 45000);
const readyStabilityDelayMs = Number(process.env.SYSTEM_LAUNCHER_READY_STABILITY_MS ?? 1200);
const noOpen = process.argv.includes("--no-open") || process.argv.includes("--no-browser") || process.env.SYSTEM_LAUNCHER_NO_OPEN === "1";
const requestedPort = readArgValue("--port");
const ports = requestedPort ? [Number(requestedPort), ...preferredPorts.filter((port) => port !== Number(requestedPort))] : preferredPorts;

let activeChild = null;

function printBanner() {
  console.log("");
  console.log("============================================================");
  console.log(" Brazil AI Commerce OS Lite - System Launcher V1");
  console.log("============================================================");
  console.log(` project root: ${projectRoot}`);
  console.log(` port candidates: ${ports.join(", ")}`);
  console.log(` entry priority: ${entryPaths.join(" -> ")}`);
  console.log("");
}

function readArgValue(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return null;
}

function parsePortList(value) {
  if (!value) return null;
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
  return parsed.length ? parsed : null;
}

function packageCommand(label, commandName, args, hintOnMissing) {
  if (process.platform === "win32") {
    return {
      label,
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", [commandName, ...args].join(" ")],
      shell: false,
      hintOnMissing,
    };
  }

  return {
    label,
    command: commandName,
    args,
    shell: false,
    hintOnMissing,
  };
}

function makeCommandCandidates(port) {
  const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
  const candidates = [
    packageCommand(
      "npm run dev",
      "npm",
      ["run", "dev", "--", "--port", String(port), "--hostname", "127.0.0.1"],
      "npm was not found. Install Node.js/npm or use the bundled Node runtime if available.",
    ),
    packageCommand(
      "npx next dev",
      "npx",
      ["next", "dev", "--port", String(port), "--hostname", "127.0.0.1"],
      "npx was not found. Install Node.js/npm, then run this launcher again.",
    ),
  ];

  if (fs.existsSync(nextBin)) {
    candidates.push({
      label: "local next dev",
      command: process.execPath,
      args: [nextBin, "dev", "--port", String(port), "--hostname", "127.0.0.1"],
      shell: false,
      hintOnMissing: "Local Next.js binary could not be started from node_modules.",
    });
  }

  return candidates;
}

function extractLocalUrl(output) {
  const localLine = output
    .split(/\r?\n/)
    .find((line) => /Local:/i.test(line) && /https?:\/\//i.test(line));
  const source = localLine || output;
  const match = source.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[[^\]]+\]|[^\s:/]+):(\d+)/i);
  if (!match) return null;

  const port = Number(match[1]);
  return {
    port,
    origin: `http://127.0.0.1:${port}`,
  };
}

function extractLastLocalUrl(output) {
  const matches = [...output.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[[^\]]+\]|[^\s:/]+):(\d+)/gi)];
  const match = matches[matches.length - 1];
  if (!match) return null;

  const port = Number(match[1]);
  return {
    port,
    origin: `http://127.0.0.1:${port}`,
  };
}

function inferFailureReason(output, fallback) {
  if (/EADDRINUSE|address already in use|port .*in use|listen EACCES/i.test(output)) {
    return "Port is occupied or unavailable.";
  }
  if (/not recognized|not found|ENOENT|Cannot find module|could not determine executable/i.test(output)) {
    return "Startup command or dependency was not found.";
  }
  if (/next: command not found|next is not recognized/i.test(output)) {
    return "Next.js CLI was not found. Run npm install first.";
  }
  return fallback || "The dev server exited before becoming ready.";
}

function attemptStart(candidate, port) {
  return new Promise((resolve) => {
    console.log(`Trying ${candidate.label} on port ${port}...`);

    let output = "";
    let settled = false;
    let readyInfo = null;
    let readyTimer = null;
    let readyStabilityTimer = null;

    let child;
    try {
      child = spawn(candidate.command, candidate.args, {
        cwd: projectRoot,
        env: { ...process.env, BROWSER: "none" },
        shell: candidate.shell,
        windowsHide: false,
      });
    } catch (error) {
      resolve({
        ok: false,
        output,
        label: candidate.label,
        port,
        reason: error.code === "ENOENT" ? candidate.hintOnMissing : error.message,
      });
      return;
    }

    activeChild = child;

    function handleData(data) {
      const text = data.toString();
      output += text;
      process.stdout.write(text);

      const localUrl = extractLocalUrl(output);
      if (localUrl) readyInfo = localUrl;

      if (readyInfo && /Ready in|ready - started server|started server|compiled successfully/i.test(output)) {
        scheduleReady();
      }
    }

    function clearReadyTimer() {
      if (readyTimer) clearTimeout(readyTimer);
      if (readyStabilityTimer) clearTimeout(readyStabilityTimer);
    }

    function cleanupFailedAttempt() {
      clearReadyTimer();
      child.stdout?.off("data", handleData);
      child.stderr?.off("data", handleData);
    }

    function markReady() {
      if (settled) return;
      if (/Another next dev server is already running/i.test(output)) return;
      settled = true;
      clearReadyTimer();
      resolve({ ok: true, child, output, port: readyInfo.port, origin: readyInfo.origin, label: candidate.label });
    }

    function scheduleReady() {
      if (settled || readyStabilityTimer) return;
      readyStabilityTimer = setTimeout(markReady, readyStabilityDelayMs);
    }

    child.stdout?.on("data", handleData);
    child.stderr?.on("data", handleData);

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanupFailedAttempt();
      resolve({
        ok: false,
        output,
        label: candidate.label,
        port,
        reason: error.code === "ENOENT" ? candidate.hintOnMissing : error.message,
      });
    });

    child.on("exit", (code, signal) => {
      if (settled) return;
      const existingServer = /Another next dev server is already running/i.test(output)
        ? extractLastLocalUrl(output)
        : null;
      if (existingServer) {
        settled = true;
        cleanupFailedAttempt();
        resolve({
          ok: true,
          child: null,
          output,
          port: existingServer.port,
          origin: existingServer.origin,
          label: "existing next dev server",
          existingServer: true,
        });
        return;
      }

      settled = true;
      cleanupFailedAttempt();
      resolve({
        ok: false,
        output,
        label: candidate.label,
        port,
        reason: inferFailureReason(output, `Process exited with code ${code ?? "n/a"}${signal ? ` and signal ${signal}` : ""}.`),
      });
    });

    readyTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanupFailedAttempt();
      stopChild(child);
      resolve({
        ok: false,
        output,
        label: candidate.label,
        port,
        reason: readyInfo
          ? "Local URL was detected, but the server did not report a ready state in time."
          : "No Local URL was detected before timeout.",
      });
    }, readyTimeoutMs);
  });
}

function stopChild(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      child.kill("SIGTERM");
    }
  } catch {
    // Nothing else to do.
  }
}

function requestUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: "timeout" });
    });
    req.on("error", () => resolve({ ok: false, status: "error" }));
  });
}

async function chooseAccessUrl(origin) {
  for (const entry of entryPaths) {
    const url = `${origin}${entry}`;
    const result = await requestUrl(url);
    if (result.ok) return url;
  }
  return `${origin}${entryPaths[0]}`;
}

function openBrowser(url) {
  if (noOpen) {
    console.log(`browser open: skipped (--no-open)`);
    return;
  }

  const platform = os.platform();
  const command =
    platform === "win32"
      ? "cmd"
      : platform === "darwin"
        ? "open"
        : "xdg-open";
  const args =
    platform === "win32"
      ? ["/c", "start", "", url]
      : [url];

  try {
    const opener = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    opener.unref();
    console.log("browser open: requested");
  } catch (error) {
    console.log(`browser open: failed (${error.message})`);
  }
}

function printSuccess(result, accessUrl) {
  console.log("");
  console.log("============================================================");
  console.log(" server status: success");
  console.log(` actual port: ${result.port}`);
  console.log(` access URL: ${accessUrl}`);
  console.log(" ready state: ready");
  if (result.existingServer) console.log(" server mode: existing dev server reused");
  console.log("============================================================");
  console.log("");
  if (result.child) {
    console.log("Keep this window open while using the system. Press Ctrl+C to stop.");
  } else {
    console.log("Existing dev server is already running. This launcher can close after opening the browser.");
  }
}

function printFailure(attempts) {
  const last = attempts[attempts.length - 1];
  console.log("");
  console.log("============================================================");
  console.log(" server status: fail");
  console.log(" actual port: n/a");
  console.log(" access URL: n/a");
  console.log(" ready state: failed");
  console.log(` error reason: ${last?.reason ?? "Unknown startup error."}`);
  console.log("============================================================");
  console.log("");
  console.log("Troubleshooting:");
  console.log("- Check whether Node.js and npm are installed and available in PATH.");
  console.log("- If npm is unavailable, install Node.js LTS and run npm install in this project.");
  console.log("- If a port is occupied, close the old dev server or keep the fallback ports 3001 / 3002 / 3005 available.");
  console.log("- If node_modules is missing, run npm install before starting again.");
  console.log("");
  console.log("Attempt summary:");
  for (const attempt of attempts) {
    console.log(`- ${attempt.label} port ${attempt.port}: ${attempt.reason}`);
  }
}

function attachShutdown(child) {
  const shutdown = () => {
    console.log("");
    console.log("Stopping Brazil AI Commerce OS Lite dev server...");
    stopChild(child);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", (code, signal) => {
    console.log("");
    console.log(`Dev server stopped (${signal || code || 0}).`);
    process.exit(code ?? 0);
  });
}

async function main() {
  printBanner();

  const attempts = [];

  for (const port of ports) {
    const candidates = makeCommandCandidates(port);
    for (const candidate of candidates) {
      const result = await attemptStart(candidate, port);
      if (result.ok) {
        const accessUrl = await chooseAccessUrl(result.origin);
        printSuccess(result, accessUrl);
        openBrowser(accessUrl);
        if (result.child) {
          attachShutdown(result.child);
        }
        return;
      }

      attempts.push(result);
      console.log(`Failed: ${result.reason}`);
      console.log("");
    }
  }

  printFailure(attempts);
  process.exit(1);
}

main().catch((error) => {
  console.error("");
  console.error("Unexpected launcher error:");
  console.error(error);
  if (activeChild) stopChild(activeChild);
  process.exit(1);
});
