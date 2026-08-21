import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const expectedTools = ["find_employee", "list_absences", "list_late_arrivals"];
const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const transport = new StdioClientTransport({
  command: executable,
  args: ["tsx", "src/mcp/stdio-entry.ts"],
  cwd: process.cwd(),
  env: process.env as Record<string, string>,
  stderr: "inherit"
});
const client = new Client({ name: "agent-lab-smoke", version: "0.2.0" });

function structured(result: { structuredContent?: unknown }): Record<string, unknown> {
  if (
    typeof result.structuredContent !== "object" ||
    result.structuredContent === null ||
    Array.isArray(result.structuredContent)
  ) {
    throw new Error("MCP response did not include structuredContent");
  }
  return result.structuredContent as Record<string, unknown>;
}

try {
  await client.connect(transport);

  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedTools)) {
    throw new Error(`Unexpected MCP tools: ${names.join(", ")}`);
  }

  const lateArrivals = structured(
    await client.callTool({
      name: "list_late_arrivals",
      arguments: { period: "previous_calendar_month" }
    })
  );
  if (lateArrivals.source !== "postgresql" || lateArrivals.count !== 2) {
    throw new Error("Expected two seeded late arrivals from PostgreSQL");
  }

  const noEmployee = structured(
    await client.callTool({
      name: "find_employee",
      arguments: { query: "EMP-NOT-FOUND" }
    })
  );
  if (noEmployee.count !== 0 || !Array.isArray(noEmployee.records)) {
    throw new Error("Zero-result employee search contract failed");
  }

  const absences = structured(
    await client.callTool({
      name: "list_absences",
      arguments: { period: "current_month" }
    })
  );
  if (absences.source !== "postgresql") {
    throw new Error("Absence tool did not report PostgreSQL as its source");
  }

  console.info(
    JSON.stringify({
      status: "ok",
      tools: names,
      previousMonthLateArrivals: lateArrivals.count,
      currentMonthAbsences: absences.count,
      zeroResultSearch: noEmployee.count
    })
  );
} finally {
  await client.close();
}
