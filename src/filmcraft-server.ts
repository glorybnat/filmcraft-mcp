import {
  fromJsonSchema,
  McpServer,
  type JsonSchemaType,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { type FilmcraftBridgeOptions } from "./bridge/filmcraft-bridge.js";
import { getFilmcraftCoreTools } from "./tools/filmcraft-core.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SERVER_VERSION = ((): string => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(path.resolve(here, "../package.json"), "utf8");
    const version: unknown = JSON.parse(raw).version;
    return typeof version === "string" && version ? version : "unknown";
  } catch {
    return "unknown";
  }
})();

const QUICK_START_TEXT = [
  "You are an AI video editing assistant connected to filmCraft via MCP.",
  "",
  "Available tools:",
  "  fc_inspect              – project tree, sequences, tracks, clips",
  "  fc_exec                 – run any filmCraft command by its command ID",
  "  fc_list_commands        – discover all available commands",
  "  fc_describe             – get the parameter schema for a command",
  "  fc_import               – import media into the project",
  "  fc_export               – export the active sequence",
  "  fc_render_frame         – render a single frame to PNG",
  "  fc_probe                – get media file metadata",
  "  fc_list_export_presets  – list available export presets",
  "",
  "Typical workflow:",
  "  1. fc_inspect           → understand what project / sequence is open",
  "  2. fc_list_commands     → discover available editing operations",
  "  3. fc_exec id=<cmd>     → execute the desired command",
  "  4. fc_inspect scope=sequence → verify the result",
].join("\n");

export function createFilmcraftServer(options: FilmcraftBridgeOptions = {}): McpServer {
  const server = new McpServer(
    { name: "filmcraft", version: SERVER_VERSION },
    {
      instructions: QUICK_START_TEXT,
      capabilities: {
        tools: { listChanged: false },
      },
    },
  );

  const tools = getFilmcraftCoreTools(options);

  for (const [name, def] of Object.entries(tools)) {
    server.registerTool(
      name,
      {
        description: def.description,
        inputSchema: fromJsonSchema(def.parameters as JsonSchemaType),
      },
      async (args) => {
        const result = await def.handler(args as any);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: !(result as { success?: boolean }).success,
        };
      },
    );
  }

  server.registerResource(
    "filmcraft-connection",
    "filmcraft://connection",
    {
      description: "Current filmCraft connection configuration.",
      mimeType: "application/json",
    },
    async (uri) => {
      const isHeadless = !options.bridgeAddr && !process.env.FILMCRAFT_BRIDGE_ADDR;
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                mode: isHeadless ? "headless" : "bridge",
                bridge_addr: options.bridgeAddr ?? process.env.FILMCRAFT_BRIDGE_ADDR ?? null,
                project: options.project ?? process.env.FILMCRAFT_PROJECT ?? null,
                demo: options.demo ?? false,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "filmcraft_quick_start",
    {
      title: "filmCraft quick start",
      description: "Instructions for using the filmCraft MCP server",
      argsSchema: z.object({}),
    },
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: QUICK_START_TEXT,
          },
        },
      ],
    }),
  );

  return server;
}
