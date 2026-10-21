import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);

const DEFAULT_CLI_CANDIDATES = [
  "C:\\Program Files\\FilmCraft\\filmcraft-cli.exe",
  "/Applications/FilmCraft.app/Contents/MacOS/filmcraft-cli",
  "filmcraft-cli",
];

export interface FilmcraftBridgeOptions {
  cliPath?: string;
  bridgeAddr?: string;
  project?: string;
  demo?: boolean;
  save?: boolean;
  saveAs?: string;
  dataDir?: string;
  timeoutMs?: number;
  compactOutput?: boolean;
}

function findCliPath(hint?: string): string {
  if (hint) return hint;
  for (const candidate of DEFAULT_CLI_CANDIDATES) {
    try {
      if (existsSync(candidate)) return candidate;
      execFileSync(candidate, ["--version"], { stdio: "ignore", windowsHide: true });
      return candidate;
    } catch {
      continue;
    }
  }
  return "filmcraft-cli";
}

export class FilmcraftBridge {
  readonly cliPath: string;
  readonly bridgeAddr: string | undefined;
  readonly project: string | undefined;
  readonly demo: boolean;
  readonly save: boolean;
  readonly saveAs: string | undefined;
  readonly dataDir: string | undefined;
  readonly timeoutMs: number;
  readonly compactOutput: boolean;

  constructor(options: FilmcraftBridgeOptions = {}) {
    this.cliPath = findCliPath(options.cliPath);
    this.bridgeAddr = options.bridgeAddr;
    this.project = options.project;
    this.demo = options.demo ?? false;
    this.save = options.save ?? false;
    this.saveAs = options.saveAs;
    this.dataDir = options.dataDir;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.compactOutput = options.compactOutput ?? true;
  }

  private baseArgs(): string[] {
    const args: string[] = [];
    if (this.bridgeAddr) {
      args.push("--bridge", this.bridgeAddr);
    } else {
      if (this.project) args.push("--project", this.project);
      if (this.demo) args.push("--demo");
      if (this.save) args.push("--save");
      if (this.saveAs) args.push("--save-as", this.saveAs);
    }
    if (this.dataDir) args.push("--data-dir", this.dataDir);
    if (this.compactOutput) args.push("--compact");
    return args;
  }

  private async run(args: string[]): Promise<unknown> {
    const fullArgs = [...this.baseArgs(), ...args];
    try {
      const { stdout } = await execFileAsync(this.cliPath, fullArgs, {
        timeout: this.timeoutMs,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      });
      const text = stdout.trim();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
      if (e.killed) throw new Error(`filmcraft-cli timed out after ${this.timeoutMs}ms`);
      const detail = e.stderr?.trim() || e.stdout?.trim() || e.message || String(err);
      throw new Error(`filmcraft-cli: ${detail}`);
    }
  }

  async exec(id: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const hasParams = Object.keys(params).length > 0;
    const args = ["exec", id];
    if (hasParams) args.push(JSON.stringify(params));
    return this.run(args);
  }

  async inspect(scope: "project" | "sequence" | "both" = "both"): Promise<unknown> {
    const args = ["inspect"];
    if (scope === "project") args.push("project");
    else if (scope === "sequence") args.push("sequence");
    return this.run(args);
  }

  async importMedia(files: string[]): Promise<unknown> {
    return this.run(["import", ...files]);
  }

  async probe(media: string, imageSequence = false): Promise<unknown> {
    const args = ["probe", media];
    if (imageSequence) args.push("--image-sequence");
    return this.run(args);
  }

  async commands(filter?: string, asJson = true): Promise<unknown> {
    const args = ["commands"];
    if (filter) args.push(filter);
    if (asJson) args.push("--json");
    return this.run(args);
  }

  async describe(id: string): Promise<unknown> {
    return this.run(["describe", id]);
  }

  async listExportPresets(query?: string): Promise<unknown> {
    const args = ["export", "--list-presets"];
    if (query) args.push(query);
    return this.run(args);
  }

  async export(
    out: string,
    opts: {
      preset?: string;
      format?: string;
      range?: "entire" | "inOut" | "workArea" | string;
      start?: string;
      end?: string;
      settings?: Record<string, unknown>;
      gpuRendering?: "auto" | "off";
      scale?: number;
      quality?: number;
      noAudio?: boolean;
      queue?: boolean;
      allowOffline?: boolean;
    } = {},
  ): Promise<unknown> {
    const args = ["export", out];
    if (opts.preset) args.push("--preset", opts.preset);
    if (opts.format) args.push("--format", opts.format);
    if (opts.range) args.push("--range", opts.range);
    if (opts.start) args.push("--start", opts.start);
    if (opts.end) args.push("--end", opts.end);
    if (opts.settings) args.push("--settings", JSON.stringify(opts.settings));
    if (opts.gpuRendering) args.push("--gpu-rendering", opts.gpuRendering);
    if (opts.scale !== undefined) args.push("--scale", String(opts.scale));
    if (opts.quality !== undefined) args.push("--quality", String(opts.quality));
    if (opts.noAudio) args.push("--no-audio");
    if (opts.queue) args.push("--queue");
    if (opts.allowOffline) args.push("--allow-offline");
    return this.run(args);
  }

  async render(
    seconds: number,
    out: string,
    opts: { scale?: number; allowOffline?: boolean } = {},
  ): Promise<unknown> {
    const args = ["render", "--seconds", String(seconds), "--out", out];
    if (opts.scale !== undefined) args.push("--scale", String(opts.scale));
    if (opts.allowOffline) args.push("--allow-offline");
    return this.run(args);
  }

  async version(): Promise<string> {
    const { stdout } = await execFileAsync(this.cliPath, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 5000,
    });
    return stdout.trim();
  }
}

export function createFilmcraftBridge(overrides: FilmcraftBridgeOptions = {}): FilmcraftBridge {
  return new FilmcraftBridge({
    cliPath: process.env.FILMCRAFT_CLI_PATH,
    bridgeAddr: process.env.FILMCRAFT_BRIDGE_ADDR,
    project: process.env.FILMCRAFT_PROJECT,
    demo: /^(1|true|yes)$/i.test(process.env.FILMCRAFT_DEMO ?? ""),
    save: /^(1|true|yes)$/i.test(process.env.FILMCRAFT_SAVE ?? ""),
    saveAs: process.env.FILMCRAFT_SAVE_AS,
    dataDir: process.env.FILMCRAFT_DATA_DIR,
    timeoutMs: process.env.FILMCRAFT_TIMEOUT_MS
      ? parseInt(process.env.FILMCRAFT_TIMEOUT_MS, 10)
      : undefined,
    ...overrides,
  });
}
