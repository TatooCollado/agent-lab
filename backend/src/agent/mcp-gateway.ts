import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface McpGateway {
  connect(): Promise<void>;
  listToolNames(): Promise<string[]>;
  callTool(name: string, arguments_: Record<string, unknown>): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

function inheritedEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] =>
      typeof entry[1] === "string"
    )
  );
}

function serverProcess() {
  const currentFile = fileURLToPath(import.meta.url);
  const backendRoot = resolve(dirname(currentFile), "../..");
  const sourceRuntime = extname(currentFile) === ".ts";

  if (sourceRuntime) {
    return {
      command: process.platform === "win32" ? "npx.cmd" : "npx",
      args: ["tsx", resolve(backendRoot, "src/mcp/stdio-entry.ts")],
      cwd: backendRoot
    };
  }

  return {
    command: process.execPath,
    args: [resolve(backendRoot, "dist/mcp/stdio-entry.js")],
    cwd: backendRoot
  };
}

export class StdioMcpGateway implements McpGateway {
  private readonly client = new Client({
    name: "agent-lab-orchestrator",
    version: "0.3.0"
  });
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;
    const processConfig = serverProcess();
    const transport = new StdioClientTransport({
      ...processConfig,
      env: inheritedEnvironment(),
      stderr: "inherit"
    });
    await this.client.connect(transport);
    this.connected = true;
  }

  async listToolNames(): Promise<string[]> {
    if (!this.connected) throw new Error("MCP gateway is not connected");
    const result = await this.client.listTools();
    return result.tools.map((tool) => tool.name);
  }

  async callTool(
    name: string,
    arguments_: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (!this.connected) throw new Error("MCP gateway is not connected");
    const sanitizedArguments = Object.fromEntries(
      Object.entries(arguments_).filter(([, value]) => value !== null)
    );
    const result = await this.client.callTool({ name, arguments: sanitizedArguments });

    if (result.isError) throw new Error(`MCP tool failed: ${name}`);
    if (
      typeof result.structuredContent !== "object" ||
      result.structuredContent === null ||
      Array.isArray(result.structuredContent)
    ) {
      throw new Error(`MCP tool returned no structured content: ${name}`);
    }
    return result.structuredContent as Record<string, unknown>;
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    await this.client.close();
  }
}
