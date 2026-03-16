import { existsSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const viewerClientDir = path.join(repoRoot, "viewer-client");

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

ensureDependencies(viewerClientDir);

const child = spawn(
  getNpmCommand(),
  ["run", "start-viewer", "--", "--host", "0.0.0.0", "--strictPort"],
  {
    cwd: viewerClientDir,
    stdio: "inherit",
    shell: false
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
