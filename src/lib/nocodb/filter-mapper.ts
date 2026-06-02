// src/lib/nocodb/filter-mapper.ts

// Convert system FilterCondition to NocoDB where syntax
// Reference: https://nocodb.com/docs/product-docs/developer-resources/rest-apis

type FilterOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in"
  | "between";

interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

type LogicalOperator = "AND" | "OR";

interface FilterGroup {
  logicalOperator: LogicalOperator;
  conditions: (FilterCondition | FilterGroup)[];
}

const OPERATOR_MAP: Record<FilterOperator, string> = {
  eq: "eq",
  ne: "neq",
  gt: "gt",
  gte: "ge",
  lt: "lt",
  lte: "le",
  contains: "like",
  not_contains: "nlike",
  starts_with: "like",
  ends_with: "like",
  is_empty: "is",
  is_not_empty: "isnot",
  in: "in",
  not_in: "nallof",
  between: "btw",
};

function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  const str = String(value);
  if (/[,\(\)~]/.test(str)) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

function conditionToWhere(condition: FilterCondition): string {
  const nocodbOp = OPERATOR_MAP[condition.operator];
  if (!nocodbOp) return "";

  const field = condition.field;
  const value = condition.value;

  switch (condition.operator) {
    case "is_empty":
      return `(${field},${nocodbOp},null)`;
    case "is_not_empty":
      return `(${field},${nocodbOp},null)`;
    case "contains":
      return `(${field},${nocodbOp},%${escapeValue(value)}%)`;
    case "not_contains":
      return `(${field},${nocodbOp},%${escapeValue(value)}%)`;
    case "starts_with":
      return `(${field},${nocodbOp},${escapeValue(value)}%)`;
    case "ends_with":
      return `(${field},${nocodbOp},%${escapeValue(value)})`;
    case "between": {
      const [min, max] = Array.isArray(value)
        ? value
        : String(value).split(",");
      return `(${field},${nocodbOp},${escapeValue(min)},${escapeValue(max)})`;
    }
    case "in": {
      const vals = Array.isArray(value) ? value : [value];
      return `(${field},${nocodbOp},${vals.map(escapeValue).join(",")})`;
    }
    default:
      return `(${field},${nocodbOp},${escapeValue(value)})`;
  }
}

export function filterToWhere(filter: FilterCondition | FilterGroup | null | undefined): string {
  if (!filter) return "";

  if ("logicalOperator" in filter) {
    const parts = filter.conditions
      .map((c) => filterToWhere(c))
      .filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0];

    const joinOp =
      filter.logicalOperator === "AND" ? "~and" : "~or";
    return parts.length === 2
      ? `${parts[0]}${joinOp}${parts[1]}`
      : parts
          .reduce(
            (acc, part, i) =>
              i === 0 ? part : `${acc}${joinOp}(${part})`,
            ""
          );
  }

  return conditionToWhere(filter as FilterCondition);
}

export function sortToNocoDB(sorts: { field: string; order: "asc" | "desc" }[]): string {
  if (!sorts || sorts.length === 0) return "";
  return sorts
    .map((s) => (s.order === "desc" ? `-${s.field}` : s.field))
    .join(",");
}
