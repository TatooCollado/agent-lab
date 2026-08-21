import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const expectedTools = [
  "count_employees",
  "find_employee",
  "list_absences",
  "list_employees",
  "list_employees_without_late_arrivals",
  "list_late_arrivals",
  "summarize_employee_delays",
];
const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const transport = new StdioClientTransport({
  command: executable,
  args: ["tsx", "src/mcp/stdio-entry.ts"],
  cwd: process.cwd(),
  env: process.env as Record<string, string>,
  stderr: "inherit",
});
const client = new Client({ name: "agent-lab-smoke", version: "0.2.0" });

function structured(result: {
  structuredContent?: unknown;
}): Record<string, unknown> {
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

  const employeeCount = structured(
    await client.callTool({ name: "count_employees", arguments: {} }),
  );
  if (
    employeeCount.source !== "postgresql" ||
    typeof employeeCount.total !== "number"
  ) {
    throw new Error("Employee count contract failed");
  }

  const employeeDelays = structured(
    await client.callTool({
      name: "summarize_employee_delays",
      arguments: { query: "Bruno Silva" },
    }),
  );
  const delayRecord = Array.isArray(employeeDelays.records)
    ? (employeeDelays.records[0] as Record<string, unknown> | undefined)
    : undefined;
  if (
    employeeDelays.source !== "postgresql" ||
    delayRecord?.employeeNumber !== "EMP-002" ||
    delayRecord.totalLateMinutes !== 42
  ) {
    throw new Error("Employee delay summary contract failed");
  }

  const employeeDirectory = structured(
    await client.callTool({ name: "list_employees", arguments: {} }),
  );
  if (
    employeeDirectory.source !== "postgresql" ||
    employeeDirectory.count !== 3 ||
    !Array.isArray(employeeDirectory.records)
  ) {
    throw new Error("Employee directory contract failed");
  }

  const lateArrivals = structured(
    await client.callTool({
      name: "list_late_arrivals",
      arguments: { period: "previous_calendar_month" },
    }),
  );
  if (lateArrivals.source !== "postgresql" || lateArrivals.count !== 2) {
    throw new Error("Expected two seeded late arrivals from PostgreSQL");
  }

  const employeesWithoutLateArrivals = structured(
    await client.callTool({
      name: "list_employees_without_late_arrivals",
      arguments: { period: "previous_calendar_month" },
    }),
  );
  const withoutLateRecord = Array.isArray(employeesWithoutLateArrivals.records)
    ? (employeesWithoutLateArrivals.records[0] as
        | Record<string, unknown>
        | undefined)
    : undefined;
  if (
    employeesWithoutLateArrivals.source !== "postgresql" ||
    employeesWithoutLateArrivals.count !== 1 ||
    withoutLateRecord?.employeeNumber !== "EMP-003"
  ) {
    throw new Error("Expected Carla as the seeded set-complement result");
  }

  const noEmployee = structured(
    await client.callTool({
      name: "find_employee",
      arguments: { query: "EMP-NOT-FOUND" },
    }),
  );
  if (noEmployee.count !== 0 || !Array.isArray(noEmployee.records)) {
    throw new Error("Zero-result employee search contract failed");
  }

  const absences = structured(
    await client.callTool({
      name: "list_absences",
      arguments: { period: "current_month" },
    }),
  );
  if (absences.source !== "postgresql") {
    throw new Error("Absence tool did not report PostgreSQL as its source");
  }

  console.info(
    JSON.stringify({
      status: "ok",
      tools: names,
      employeeCount: employeeCount.total,
      listedEmployees: employeeDirectory.count,
      brunoTotalLateMinutes: delayRecord.totalLateMinutes,
      previousMonthLateArrivals: lateArrivals.count,
      previousMonthWithoutLateArrivals: employeesWithoutLateArrivals.count,
      currentMonthAbsences: absences.count,
      zeroResultSearch: noEmployee.count,
    }),
  );
} finally {
  await client.close();
}
