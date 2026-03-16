import { existsSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const sourceServerDir = path.join(repoRoot, "source-server");
const sourceUiDir = path.join(sourceServerDir, "ui");

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false
  });

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
runCommand(getNpmCommand(), ["run", "build"], sourceUiDir);

const child = spawn(getNpmCommand(), ["run", "start-source"], {
  cwd: sourceServerDir,
  stdio: "inherit",
  shell: false
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
