import type { AnswerPresentation, EmployeeRecord } from "./api";

function EmptyResult() {
  return <p className="structured-empty">No records matched the query.</p>;
}

function ResultFooter({
  data,
}: {
  data: {
    source: string;
    queriedAt: string;
    total: number;
    truncated: boolean;
  };
}) {
  return (
    <div className="structured-source">
      <span>Source: {data.source}</span>
      <span>Total: {data.total}</span>
      <span>Truncated: {String(data.truncated)}</span>
      <time dateTime={data.queriedAt}>{data.queriedAt}</time>
    </div>
  );
}

function EmployeeTable({ records }: { records: EmployeeRecord[] }) {
  if (records.length === 0) return <EmptyResult />;
  return (
    <div className="structured-table-wrap">
      <table className="structured-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>ID</th>
            <th>Department</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.employeeId}>
              <td>{record.fullName}</td>
              <td>
                <code>{record.employeeNumber}</code>
              </td>
              <td>
                {record.departmentName} <small>{record.departmentCode}</small>
              </td>
              <td>{record.active ? "Active" : "Inactive"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StructuredAnswer({
  presentation,
}: {
  presentation: AnswerPresentation;
}) {
  const data = presentation.data;
  let content: React.ReactNode;

  switch (presentation.kind) {
    case "employee_count":
      content = (
        <div className="metric-grid">
          <div>
            <span>Total</span>
            <strong>{presentation.data.total}</strong>
          </div>
          <div>
            <span>Active</span>
            <strong>{presentation.data.active}</strong>
          </div>
          <div>
            <span>Inactive</span>
            <strong>{presentation.data.inactive}</strong>
          </div>
        </div>
      );
      break;
    case "employee_directory":
    case "employee_search":
    case "employees_without_late_arrivals":
      content = <EmployeeTable records={presentation.data.records} />;
      break;
    case "employee_delay_summary":
      content =
        presentation.data.records.length === 0 ? (
          <EmptyResult />
        ) : (
          <div className="structured-table-wrap">
            <table className="structured-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Occurrences</th>
                  <th>Total</th>
                  <th>Average</th>
                  <th>Maximum</th>
                  <th>Range</th>
                </tr>
              </thead>
              <tbody>
                {presentation.data.records.map((record) => (
                  <tr key={record.employeeId}>
                    <td>
                      {record.fullName}
                      <small>{record.employeeNumber}</small>
                    </td>
                    <td>{record.occurrences}</td>
                    <td>{record.totalLateMinutes} min</td>
                    <td>{record.averageLateMinutes} min</td>
                    <td>{record.maximumLateMinutes} min</td>
                    <td>
                      {record.firstOccurrenceDate} → {record.lastOccurrenceDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      break;
    case "late_arrivals":
      content =
        presentation.data.records.length === 0 ? (
          <EmptyResult />
        ) : (
          <div className="structured-table-wrap">
            <table className="structured-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Scheduled</th>
                  <th>Arrival</th>
                  <th>Delay</th>
                </tr>
              </thead>
              <tbody>
                {presentation.data.records.map((record) => (
                  <tr key={`${record.employeeId}-${record.workDate}`}>
                    <td>{record.workDate}</td>
                    <td>
                      {record.fullName}
                      <small>{record.employeeNumber}</small>
                    </td>
                    <td>{record.scheduledStart}</td>
                    <td>{record.actualArrival}</td>
                    <td>{record.lateMinutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      break;
    case "absences":
      content =
        presentation.data.records.length === 0 ? (
          <EmptyResult />
        ) : (
          <div className="structured-table-wrap">
            <table className="structured-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {presentation.data.records.map((record) => (
                  <tr key={`${record.employeeId}-${record.workDate}`}>
                    <td>{record.workDate}</td>
                    <td>
                      {record.fullName}
                      <small>{record.employeeNumber}</small>
                    </td>
                    <td>{record.departmentCode}</td>
                    <td>{record.absenceReason ?? "Not specified"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      break;
  }

  return (
    <div className="structured-answer" data-kind={presentation.kind}>
      <div className="presentation-contract">
        <span>answerPayload</span>
        <code>{presentation.kind}</code>
      </div>
      {content}
      <ResultFooter data={data} />
    </div>
  );
}
