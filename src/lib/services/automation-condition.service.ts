import type {
  AutomationConditionContext,
  AutomationConditionGroup,
  AutomationConditionLeaf,
} from "@/types/automation";

function readNestedValue(source: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

export function readAutomationContextField(
  field: string,
  context: AutomationConditionContext
): unknown {
  if (field === "changedFields") {
    return context.changedFields;
  }

  if (field === "triggerSource") {
    return context.triggerSource;
  }

  const [root, ...rest] = field.split(".");
  if (root === "record") {
    return readNestedValue(context.record, rest);
  }

  if (root === "previousRecord") {
    return readNestedValue(context.previousRecord, rest);
  }

  return undefined;
}

function evaluateLeafCondition(
  condition: AutomationConditionLeaf,
  context: AutomationConditionContext
): boolean {
  const actual = readAutomationContextField(condition.field, context);

  switch (condition.op) {
    case "eq":
      return String(actual ?? "") === String(condition.value ?? "");
    case "ne":
      return String(actual ?? "") !== String(condition.value ?? "");
    case "contains":
      return Array.isArray(actual)
        ? actual.map(String).includes(String(condition.value ?? ""))
        : String(actual ?? "").includes(String(condition.value ?? ""));
    case "gt":
      return Number(actual) > Number(condition.value);
    case "lt":
      return Number(actual) < Number(condition.value);
  }
}

export function evaluateAutomationCondition(
  condition: AutomationConditionLeaf | AutomationConditionGroup | null,
  context: AutomationConditionContext
): boolean {
  if (!condition) {
    return true;
  }

  if (condition.kind === "group") {
    return condition.operator === "AND"
      ? condition.conditions.every((item) => evaluateAutomationCondition(item, context))
      : condition.conditions.some((item) => evaluateAutomationCondition(item, context));
  }

  return evaluateLeafCondition(condition, context);
}
