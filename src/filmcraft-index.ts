#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createFilmcraftServer } from "./filmcraft-server.js";
import { createFilmcraftBridge } from "./bridge/filmcraft-bridge.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readVersion(): string {
  try {
    const raw = readFileSync(path.resolve(__dirname, "../package.json"), "utf8");
    const version: unknown = JSON.parse(raw).version;
    return typeof version === "string" ? version : "unknown";
  } catch {
    return "unknown";
  }
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
filmcraft – MCP server for filmCraft (GUI + headless)

USAGE
  filmcraft                          Start the MCP server (stdio transport)
  filmcraft --bridge-addr HOST:PORT  Connect to the running filmCraft GUI
  filmcraft --project <p.fcproj>     Open a project in headless mode
  filmcraft --demo                   Use the built-in demo project (headless)
  filmcraft --version                Print the version

OPTIONS
  --bridge-addr HOST:PORT   Address of the filmCraft GUI control socket.
                            Start the GUI with: filmcraft --control PORT
  --project <path>          Project file to open in headless mode.
  --demo                    Use the filmCraft demo project in headless mode.
  --save                    Save the project when done (headless only).
  --save-as <path>          Save to a new path when done (headless only).
  --data-dir <dir>          filmCraft data directory for export presets.
  --timeout-ms <ms>         Command timeout in milliseconds (default: 60000).

ENVIRONMENT
  FILMCRAFT_CLI_PATH        Path to filmcraft-cli executable.
  FILMCRAFT_BRIDGE_ADDR     Bridge address (overrides --bridge-addr).
  FILMCRAFT_PROJECT         Project file (overrides --project).
  FILMCRAFT_DEMO            Set to 1/true to use the demo project.
  FILMCRAFT_SAVE            Set to 1/true to save after operations.
  FILMCRAFT_SAVE_AS         Save-as path.
  FILMCRAFT_DATA_DIR        filmCraft data directory.
  FILMCRAFT_TIMEOUT_MS      Command timeout in milliseconds.

CONNECTING TO THE GUI
  1. Start filmCraft with control mode:  filmcraft --control 7778
  2. Start this server:                  filmcraft --bridge-addr 127.0.0.1:7778

HEADLESS MODE
  filmcraft --project ~/projects/myvideo.fcproj

More info: https://github.com/glorybnat/filmcraft-mcp
`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(readVersion());
  process.exit(0);
}

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const bridgeAddr = getArg("--bridge-addr") ?? process.env.FILMCRAFT_BRIDGE_ADDR;
const project = getArg("--project") ?? process.env.FILMCRAFT_PROJECT;
const demo = args.includes("--demo") || /^(1|true|yes)$/i.test(process.env.FILMCRAFT_DEMO ?? "");
const save = args.includes("--save") || /^(1|true|yes)$/i.test(process.env.FILMCRAFT_SAVE ?? "");
const saveAs = getArg("--save-as") ?? process.env.FILMCRAFT_SAVE_AS;
const dataDir = getArg("--data-dir") ?? process.env.FILMCRAFT_DATA_DIR;
const timeoutMsArg = getArg("--timeout-ms") ?? process.env.FILMCRAFT_TIMEOUT_MS;
const timeoutMs = timeoutMsArg ? parseInt(timeoutMsArg, 10) : undefined;

const bridgeOptions = {
  cliPath: process.env.FILMCRAFT_CLI_PATH,
  bridgeAddr,
  project,
  demo,
  save,
  saveAs,
  dataDir,
  timeoutMs,
};

async function main(): Promise<void> {
  // Smoke-test the filmcraft-cli is reachable
  const bridge = createFilmcraftBridge(bridgeOptions);
  try {
    const ver = await bridge.version();
    console.error(`[filmcraft-mcp] filmcraft-cli ${ver} found`);
  } catch {
    console.error("[filmcraft-mcp] Warning: filmcraft-cli not found on PATH. Set FILMCRAFT_CLI_PATH if it is installed elsewhere.");
  }

  const server = createFilmcraftServer(bridgeOptions);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const mode = bridgeAddr ? `bridge → ${bridgeAddr}` : project ? `headless (${project})` : demo ? "headless (demo)" : "headless";
  console.error(`[filmcraft-mcp] MCP server ready  mode=${mode}`);

  const shutdown = async () => {
    await server.close();
    await transport.close();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
  process.stdin.once("end", () => void shutdown().finally(() => process.exit(0)));
}

main().catch((err) => {
  console.error("[filmcraft-mcp] Fatal error:", err);
  process.exit(1);
});
