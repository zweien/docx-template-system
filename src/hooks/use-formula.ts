"use client";

import { useCallback, useMemo } from "react";
import { evaluateFormula, detectCircularRefs, parseFormula } from "@/lib/formula";
import type { DataFieldItem } from "@/types/data-table";
import { parseFieldOptions } from "@/types/data-table";

interface UseFormulaOptions {
  fields: DataFieldItem[];
  records: { id: string; data: Record<string, unknown> }[];
}

export function useFormula({ fields, records }: UseFormulaOptions) {
  const formulaFields = useMemo(
    () => fields.filter((f) => f.type === "FORMULA"),
    [fields]
  );

  const circularRefError = useMemo(() => {
    const formulaMap: Record<string, string> = {};
    for (const field of formulaFields) {
      const opts = parseFieldOptions(field.options);
      if (opts.formula) formulaMap[field.key] = opts.formula;
    }
    return Object.keys(formulaMap).length > 0 ? detectCircularRefs(formulaMap) : null;
  }, [formulaFields]);

  const computedValues = useMemo(() => {
    if (circularRefError) return {};
    const result: Record<string, Record<string, unknown>> = {};
    for (const field of formulaFields) {
      const opts = parseFieldOptions(field.options);
      if (!opts.formula) continue;
      for (const record of records) {
        const value = evaluateFormula(opts.formula, record.data);
        if (!result[record.id]) result[record.id] = {};
        result[record.id][field.key] = value;
      }
    }
    return result;
  }, [formulaFields, records, circularRefError]);

  const validateFormula = useCallback(
    (formula: string, fieldKey: string): string | null => {
      if (!formula.trim()) return null;
      try {
        parseFormula(formula);
      } catch (e) {
        return e instanceof Error ? e.message : "公式语法错误";
      }
      const formulaMap: Record<string, string> = {};
      for (const f of formulaFields) {
        const opts = parseFieldOptions(f.options);
        if (opts.formula) formulaMap[f.key] = opts.formula;
      }
      formulaMap[fieldKey] = formula;
      return detectCircularRefs(formulaMap);
    },
    [formulaFields]
  );

  return { computedValues, circularRefError, validateFormula };
}
