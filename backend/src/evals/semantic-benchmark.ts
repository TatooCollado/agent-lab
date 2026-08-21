export type SemanticOutcome =
  | { kind: "execute"; tool: string; arguments: Record<string, unknown> }
  | { kind: "clarification"; reason: string }
  | { kind: "unsupported"; reason: string };

export type SemanticBenchmarkCase = {
  id: string;
  capability: string | null;
  variant: string;
  question: string;
  expected: SemanticOutcome;
};

const execute = (
  tool: string,
  arguments_: Record<string, unknown> = {},
): SemanticOutcome => ({ kind: "execute", tool, arguments: arguments_ });
const clarify = (reason: string): SemanticOutcome => ({
  kind: "clarification",
  reason,
});
const unsupported = (reason: string): SemanticOutcome => ({
  kind: "unsupported",
  reason,
});

export const SEMANTIC_BENCHMARK: readonly SemanticBenchmarkCase[] = [
  ...[
    ["neutral", "¿Cuántos empleados hay?"],
    ["formal", "Informe la cantidad total de empleados."],
    ["informal", "¿Cuánta gente trabaja acá?"],
    ["rioplatense", "¿Cuántos somos laburando acá?"],
    ["short", "Total de personal."],
    ["indirect", "Quiero saber el tamaño de la plantilla."],
    ["synonym", "Pasame el headcount."],
    ["active-inactive", "¿Cuál es la dotación activa e inactiva?"],
    ["question", "¿Qué cantidad de gente tiene la empresa?"],
    ["abbreviated", "Cant. empleados"],
  ].map(([variant, question], index) => ({
    id: `employee-count-${index + 1}`,
    capability: "employee_count",
    variant: variant!,
    question: question!,
    expected: execute("count_employees"),
  })),
  ...[
    ["neutral", "¿Quiénes son los empleados?"],
    ["formal", "Liste el personal registrado."],
    ["informal", "Mostrame la lista de empleados."],
    ["rioplatense", "Pasame la gente que labura acá."],
    ["short", "Nómina."],
    ["indirect", "Quiero saber quién trabaja en la empresa."],
    ["synonym", "Mostrame el plantel completo."],
    ["directory", "Directorio de empleados."],
    ["status", "Listá el personal activo e inactivo."],
    ["abbreviated", "Lista personal"],
  ].map(([variant, question], index) => ({
    id: `employee-directory-${index + 1}`,
    capability: "employee_directory",
    variant: variant!,
    question: question!,
    expected: execute("list_employees"),
  })),
  ...[
    ["neutral", "Buscá a Ana Torres.", "Ana Torres"],
    ["formal", "Localice al empleado EMP-001.", "EMP-001"],
    ["informal", "Encontrame a Bruno Silva.", "Bruno Silva"],
    ["rioplatense", "Fijate si está Carla Méndez.", "Carla Méndez"],
    ["short", "Buscá EMP-002.", "EMP-002"],
    ["indirect", "Quiero los datos de Ana Torres.", "Ana Torres"],
    ["identity", "¿Quién es EMP-001?", "EMP-001"],
    ["existence", "¿Está registrada Carla Méndez?", "Carla Méndez"],
    ["synonym", "Consultá el legajo EMP-003.", "EMP-003"],
    ["abbreviated", "Empleado Bruno Silva", "Bruno Silva"],
  ].map(([variant, question, query], index) => ({
    id: `employee-search-${index + 1}`,
    capability: "employee_search",
    variant: variant!,
    question: question!,
    expected: execute("find_employee", { query: query! }),
  })),
  ...[
    ["neutral", "¿Quién llegó tarde el mes pasado?", "previous_calendar_month"],
    [
      "formal",
      "Liste los ingresos posteriores al horario previsto este mes.",
      "current_month",
    ],
    ["informal", "¿Quién entró tarde este mes?", "current_month"],
    [
      "rioplatense",
      "¿Quién cayó tarde el mes pasado?",
      "previous_calendar_month",
    ],
    ["short", "Tardanzas del mes pasado.", "previous_calendar_month"],
    ["indirect", "¿Hubo gente entrando tarde este mes?", "current_month"],
    [
      "synonym",
      "¿Quién llegó después de hora en los últimos 30 días?",
      "last_30_days",
    ],
    ["clock", "¿Quién fichó tarde este mes?", "current_month"],
  ].map(([variant, question, period], index) => ({
    id: `late-arrivals-${index + 1}`,
    capability: "late_arrivals",
    variant: variant!,
    question: question!,
    expected: execute("list_late_arrivals", {
      period: period!,
      employeeNumber: null,
    }),
  })),
  {
    id: "late-arrivals-9",
    capability: "late_arrivals",
    variant: "missing-period",
    question: "¿Quién marcó tarde?",
    expected: clarify("missing_period"),
  },
  {
    id: "late-arrivals-10",
    capability: "late_arrivals",
    variant: "unsupported-frequency",
    question: "¿Quién llega siempre tarde este mes?",
    expected: unsupported("unsupported_frequency_claim"),
  },
  ...[
    [
      "neutral",
      "¿Quién no llegó tarde el mes pasado?",
      "previous_calendar_month",
    ],
    [
      "formal",
      "Liste al personal sin ingresos tardíos este mes.",
      "current_month",
    ],
    ["informal", "¿Quién entró siempre a horario este mes?", "current_month"],
    [
      "rioplatense",
      "¿Quién no cayó tarde el mes pasado?",
      "previous_calendar_month",
    ],
    ["short", "Sin tardanzas este mes.", "current_month"],
    [
      "clock",
      "¿Quién nunca fichó tarde en los últimos 30 días?",
      "last_30_days",
    ],
    [
      "synonym",
      "Los que llegaron en horario el mes pasado.",
      "previous_calendar_month",
    ],
    ["negative", "¿Quién no tuvo demoras este mes?", "current_month"],
  ].map(([variant, question, period], index) => ({
    id: `without-late-arrivals-${index + 1}`,
    capability: "employees_without_late_arrivals",
    variant: variant!,
    question: question!,
    expected: execute("list_employees_without_late_arrivals", {
      period: period!,
    }),
  })),
  {
    id: "without-late-arrivals-9",
    capability: "employees_without_late_arrivals",
    variant: "missing-period",
    question: "¿Quién estuvo siempre puntual?",
    expected: clarify("missing_period"),
  },
  {
    id: "without-late-arrivals-10",
    capability: "employees_without_late_arrivals",
    variant: "universal-history",
    question: "¿Quién nunca llegó tarde?",
    expected: clarify("missing_period"),
  },
  ...[
    ["neutral", "Pasame las demoras totales de Bruno Silva.", "Bruno Silva"],
    [
      "formal",
      "Informe la tardanza histórica acumulada de EMP-002.",
      "EMP-002",
    ],
    ["informal", "¿Cuánto llegó tarde Bruno Silva en total?", "Bruno Silva"],
    ["rioplatense", "¿Cuántos minutos tarde juntó Ana Torres?", "Ana Torres"],
    ["short", "Total de retrasos de Carla Méndez.", "Carla Méndez"],
    ["maximum", "¿Cuál fue la demora máxima de EMP-001?", "EMP-001"],
    [
      "average",
      "Dame el promedio histórico de tardanza de Bruno Silva.",
      "Bruno Silva",
    ],
    [
      "occurrences",
      "¿Cuántas veces llegó tarde Ana Torres en total?",
      "Ana Torres",
    ],
    ["synonym", "Resumen acumulado de impuntualidad de EMP-003.", "EMP-003"],
  ].map(([variant, question, query], index) => ({
    id: `delay-summary-${index + 1}`,
    capability: "employee_delay_summary",
    variant: variant!,
    question: question!,
    expected: execute("summarize_employee_delays", { query: query! }),
  })),
  {
    id: "delay-summary-10",
    capability: "employee_delay_summary",
    variant: "unsupported-period",
    question: "Demoras totales de Bruno Silva este mes.",
    expected: unsupported("unsupported_filter"),
  },
  ...[
    ["neutral", "¿Qué ausencias hubo este mes?", "current_month"],
    [
      "formal",
      "Liste las inasistencias del mes pasado.",
      "previous_calendar_month",
    ],
    ["informal", "¿Quién faltó este mes?", "current_month"],
    [
      "rioplatense",
      "¿Quién pegó el faltazo el mes pasado?",
      "previous_calendar_month",
    ],
    ["short", "Faltas del mes pasado.", "previous_calendar_month"],
    ["indirect", "¿Quién no vino a trabajar este mes?", "current_month"],
    ["synonym", "¿Hubo gente ausente en los últimos 30 días?", "last_30_days"],
    ["progressive", "¿Quién se estuvo ausentando este mes?", "current_month"],
  ].map(([variant, question, period], index) => ({
    id: `absences-${index + 1}`,
    capability: "absences",
    variant: variant!,
    question: question!,
    expected: execute("list_absences", {
      period: period!,
      employeeNumber: null,
    }),
  })),
  {
    id: "absences-9",
    capability: "absences",
    variant: "missing-period",
    question: "¿Quién faltó?",
    expected: clarify("missing_period"),
  },
  {
    id: "absences-10",
    capability: "absences",
    variant: "unsupported-ranking",
    question: "¿Quién tiene más faltazos este mes?",
    expected: unsupported("unsupported_aggregation"),
  },
  {
    id: "boundary-1",
    capability: null,
    variant: "ambiguous-delay",
    question: "¿Quiénes tuvieron demoras?",
    expected: clarify("ambiguous_intent"),
  },
  {
    id: "boundary-2",
    capability: null,
    variant: "ambiguous-clock",
    question: "¿Quién fichó?",
    expected: clarify("ambiguous_intent"),
  },
  {
    id: "boundary-3",
    capability: null,
    variant: "ambiguous-schedule",
    question: "¿Quién tiene problemas de horario?",
    expected: clarify("ambiguous_intent"),
  },
  {
    id: "boundary-4",
    capability: null,
    variant: "unsupported-weather",
    question: "¿Qué temperatura hace en Córdoba?",
    expected: unsupported("unsupported_capability"),
  },
  {
    id: "boundary-5",
    capability: null,
    variant: "unsupported-payroll",
    question: "¿Cuánto cobra Ana Torres?",
    expected: unsupported("unsupported_capability"),
  },
  {
    id: "boundary-6",
    capability: null,
    variant: "conflicting-period",
    question: "¿Quién llegó tarde este mes y el mes pasado?",
    expected: clarify("conflicting_period"),
  },
  {
    id: "boundary-7",
    capability: null,
    variant: "ambiguous-delay-kind",
    question: "Pasame los retrasos.",
    expected: clarify("ambiguous_intent"),
  },
  {
    id: "boundary-8",
    capability: null,
    variant: "unsupported-ranking",
    question: "¿Quién es el más impuntual?",
    expected: unsupported("unsupported_aggregation"),
  },
  {
    id: "boundary-9",
    capability: null,
    variant: "ambiguous-after-hours",
    question: "¿Quién estuvo después de hora?",
    expected: clarify("ambiguous_intent"),
  },
  {
    id: "boundary-10",
    capability: null,
    variant: "unsupported-delete",
    question: "Borrá las ausencias de este mes.",
    expected: unsupported("unsupported_capability"),
  },
] as const;
