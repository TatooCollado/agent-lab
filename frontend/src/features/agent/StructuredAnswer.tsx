import type { AnswerPresentation, EmployeeRecord } from "./api";

function EmptyResult() {
  return (
    <p className="structured-empty">
      No se encontraron registros para la consulta.
    </p>
  );
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
      <span>Fuente: {data.source}</span>
      <span>Total: {data.total}</span>
      <span>Resultado parcial: {data.truncated ? "sí" : "no"}</span>
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
            <th>Empleado</th>
            <th>ID</th>
            <th>Departamento</th>
            <th>Estado</th>
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
              <td>{record.active ? "Activo" : "Inactivo"}</td>
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
            <span>Activos</span>
            <strong>{presentation.data.active}</strong>
          </div>
          <div>
            <span>Inactivos</span>
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
                  <th>Empleado</th>
                  <th>Ocurrencias</th>
                  <th>Total</th>
                  <th>Promedio</th>
                  <th>Máximo</th>
                  <th>Período registrado</th>
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
                  <th>Fecha</th>
                  <th>Empleado</th>
                  <th>Horario previsto</th>
                  <th>Llegada real</th>
                  <th>Demora</th>
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
                  <th>Fecha</th>
                  <th>Empleado</th>
                  <th>Departamento</th>
                  <th>Motivo</th>
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
                    <td>{record.absenceReason ?? "No especificado"}</td>
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
