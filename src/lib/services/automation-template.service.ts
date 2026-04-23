import type { AutomationActionContext } from "@/types/automation";

const TEMPLATE_TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

type TemplateScope = Record<string, unknown>;

function getValueByPath(scope: TemplateScope, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, scope);
}

function stringifyTemplateValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createTemplateScope(context: AutomationActionContext): TemplateScope {
  return {
    automationId: context.automationId,
    tableId: context.tableId,
    recordId: context.recordId ?? null,
    triggeredAt: context.triggeredAt,
    triggerSource: context.triggerSource,
    changedFields: context.changedFields,
    record: context.record ?? {},
    previousRecord: context.previousRecord ?? {},
    actor: context.actor ?? {},
  };
}

export function renderAutomationTemplate(
  template: string,
  context: AutomationActionContext
): string {
  const scope = createTemplateScope(context);

  return template.replace(TEMPLATE_TOKEN_PATTERN, (_match, token: string) =>
    stringifyTemplateValue(getValueByPath(scope, token))
  );
}
