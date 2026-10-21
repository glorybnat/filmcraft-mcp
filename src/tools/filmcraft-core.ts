import { FilmcraftBridge, type FilmcraftBridgeOptions } from "../bridge/filmcraft-bridge.js";

type Ok = { success: true; data: unknown };
type Fail = { success: false; error: string };
type Result = Ok | Fail;

function ok(data: unknown): Ok {
  return { success: true, data };
}

function fail(err: unknown): Fail {
  return { success: false, error: err instanceof Error ? err.message : String(err) };
}

export function getFilmcraftCoreTools(opts: FilmcraftBridgeOptions) {
  const bridge = new FilmcraftBridge(opts);

  return {
    fc_inspect: {
      description:
        "Inspect the open filmCraft project and/or active sequence. Returns bin tree, sequences, tracks, and clips as JSON.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          scope: {
            type: "string",
            enum: ["project", "sequence", "both"],
            description: "What to inspect (default: both).",
          },
        },
      },
      handler: async (args: { scope?: "project" | "sequence" | "both" }): Promise<Result> => {
        try {
          return ok(await bridge.inspect(args.scope ?? "both"));
        } catch (err) {
          return fail(err);
        }
      },
    },

    fc_exec: {
      description:
        "Execute any filmCraft command by its command ID. Use fc_list_commands to discover IDs. Params are passed as key-value pairs.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        required: ["id"],
        properties: {
          id: {
            type: "string",
            description: "filmCraft command ID, e.g. timeline.razor, file.newBin.",
          },
          params: {
            type: "object",
            description: "Command parameters as a JSON object. Keys and types depend on the command.",
            additionalProperties: true,
          },
        },
      },
      handler: async (args: { id: string; params?: Record<string, unknown> }): Promise<Result> => {
        try {
          return ok(await bridge.exec(args.id, args.params ?? {}));
        } catch (err) {
          return fail(err);
        }
      },
    },

    fc_list_commands: {
      description:
        "List all available filmCraft commands with their IDs, labels, menu paths, shortcuts, and parameter schemas.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          filter: {
            type: "string",
            description: "Optional substring filter on command IDs or labels.",
          },
        },
      },
      handler: async (args: { filter?: string }): Promise<Result> => {
        try {
          return ok(await bridge.commands(args.filter));
        } catch (err) {
          return fail(err);
        }
      },
    },

    fc_describe: {
      description: "Get full details for a single filmCraft command: its menu, shortcut, parameter schema, and whether it is currently enabled.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        required: ["id"],
        properties: {
          id: {
            type: "string",
            description: "filmCraft command ID to describe.",
          },
        },
      },
      handler: async (args: { id: string }): Promise<Result> => {
        try {
          return ok(await bridge.describe(args.id));
        } catch (err) {
          return fail(err);
        }
      },
    },

    fc_import: {
      description: "Import one or more media files into the filmCraft project.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        required: ["files"],
        properties: {
          files: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "Absolute paths to the media files to import.",
          },
        },
      },
      handler: async (args: { files: string[] }): Promise<Result> => {
        try {
          return ok(await bridge.importMedia(args.files));
        } catch (err) {
          return fail(err);
        }
      },
    },

    fc_export: {
      description:
        "Export the active filmCraft sequence. Specify an output path with a format matched to its extension, or pass a preset name. Returns a result object that includes any offline-media warnings.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        required: ["out"],
        properties: {
          out: {
            type: "string",
            description: "Output file path (extension determines format when --format is omitted).",
          },
          preset: {
            type: "string",
            description: "Export preset name. Use fc_list_export_presets to discover available presets.",
          },
          format: {
            type: "string",
            description: "Explicit format: h264, hevc, prores, dnxhr, apv, mjpeg, mxf-op1a, mxf-opatom, png, tiff, bmp, gif, wav, aiff, aac.",
          },
          range: {
            type: "string",
            enum: ["entire", "inOut", "workArea"],
            description: "Export range (default: entire sequence).",
          },
          start: {
            type: "string",
            description: "Custom range start in seconds (requires end).",
          },
          end: {
            type: "string",
            description: "Custom range end in seconds (requires start).",
          },
          scale: {
            type: "number",
            minimum: 0.01,
            maximum: 1,
            description: "Render at a fraction of full frame size (e.g. 0.5 = half resolution).",
          },
          quality: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            description: "Quality 0-100 for formats that support it.",
          },
          no_audio: {
            type: "boolean",
            description: "Omit audio from the export.",
          },
          queue: {
            type: "boolean",
            description: "Add to the export queue and run it, instead of a direct render.",
          },
          allow_offline: {
            type: "boolean",
            description: "Allow offline media to render as placeholder frames.",
          },
          gpu_rendering: {
            type: "string",
            enum: ["auto", "off"],
            description: "GPU rendering mode (default: auto).",
          },
        },
      },
      handler: async (args: {
        out: string;
        preset?: string;
        format?: string;
        range?: "entire" | "inOut" | "workArea";
        start?: string;
        end?: string;
        scale?: number;
        quality?: number;
        no_audio?: boolean;
        queue?: boolean;
        allow_offline?: boolean;
        gpu_rendering?: "auto" | "off";
      }): Promise<Result> => {
        try {
          return ok(
            await bridge.export(args.out, {
              preset: args.preset,
              format: args.format,
              range: args.range,
              start: args.start,
              end: args.end,
              scale: args.scale,
              quality: args.quality,
              noAudio: args.no_audio,
              queue: args.queue,
              allowOffline: args.allow_offline,
              gpuRendering: args.gpu_rendering,
            }),
          );
        } catch (err) {
          return fail(err);
        }
      },
    },

    fc_render_frame: {
      description: "Render a single Program Monitor frame to a PNG file at the given sequence time.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        required: ["seconds", "out"],
        properties: {
          seconds: {
            type: "number",
            description: "Sequence time in seconds to render.",
          },
          out: {
            type: "string",
            description: "Output PNG file path.",
          },
          scale: {
            type: "number",
            minimum: 0.01,
            maximum: 1,
            description: "Render at a fraction of full frame size.",
          },
          allow_offline: {
            type: "boolean",
            description: "Allow offline media to render as placeholder frames.",
          },
        },
      },
      handler: async (args: { seconds: number; out: string; scale?: number; allow_offline?: boolean }): Promise<Result> => {
        try {
          return ok(await bridge.render(args.seconds, args.out, {
            scale: args.scale,
            allowOffline: args.allow_offline,
          }));
        } catch (err) {
          return fail(err);
        }
      },
    },

    fc_probe: {
      description: "Get detailed media information for a file: codec, resolution, frame rate, audio tracks, and format-specific metadata.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        required: ["file"],
        properties: {
          file: {
            type: "string",
            description: "Absolute path to the media file to probe.",
          },
          image_sequence: {
            type: "boolean",
            description: "Treat the file as the first frame of a numbered image sequence.",
          },
        },
      },
      handler: async (args: { file: string; image_sequence?: boolean }): Promise<Result> => {
        try {
          return ok(await bridge.probe(args.file, args.image_sequence ?? false));
        } catch (err) {
          return fail(err);
        }
      },
    },

    fc_list_export_presets: {
      description: "List all available filmCraft export presets (built-in and user-defined) with name, category, and format.",
      parameters: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          query: {
            type: "string",
            description: "Optional text filter on preset name or category.",
          },
        },
      },
      handler: async (args: { query?: string }): Promise<Result> => {
        try {
          return ok(await bridge.listExportPresets(args.query));
        } catch (err) {
          return fail(err);
        }
      },
    },
  };
}
