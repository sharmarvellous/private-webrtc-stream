import { existsSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const sourceServerDir = path.join(repoRoot, "source-server");
const sourceUiDir = path.join(sourceServerDir, "ui");
const sourceUiDistDir = path.join(sourceUiDir, "dist");

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function getNodeCommand() {
  return process.execPath;
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureDependencies(projectDir) {
  if (existsSync(path.join(projectDir, "node_modules"))) {
    return;
  }

  runCommand(getNpmCommand(), ["install"], projectDir);
}

ensureDependencies(sourceServerDir);
ensureDependencies(sourceUiDir);

if (!existsSync(sourceUiDistDir)) {
  runCommand(getNpmCommand(), ["run", "build"], sourceUiDir);
}

const child = spawn(getNodeCommand(), ["src/server.js"], {
  cwd: sourceServerDir,
  stdio: "inherit",
  shell: false
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
