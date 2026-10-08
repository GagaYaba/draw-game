import { spawn } from "node:child_process";

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error("npm_execpath is required. Start development with npm run dev.");
}

const workspaces = ["@drawing-game/shared", "@drawing-game/server", "@drawing-game/client"];
const children = workspaces.map((workspace) =>
  spawn(process.execPath, [npmCli, "run", "dev", `--workspace=${workspace}`], {
    env: process.env,
    stdio: "inherit",
  }),
);

let stopping = false;

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!stopping && (code !== 0 || signal)) {
      stopAll(code ?? 1);
    }
  });
  child.on("error", () => stopAll(1));
}

process.once("SIGINT", () => stopAll(130));
process.once("SIGTERM", () => stopAll(143));
