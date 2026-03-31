export const PLACEHOLDER_INPUT_TYPE_LABELS: Record<string, string> = {
  TEXT: "单行文本",
  TEXTAREA: "多行文本",
  TABLE: "明细表",
  CHOICE_SINGLE: "单选",
  CHOICE_MULTI: "多选",
};

export function getPlaceholderInputTypeLabel(inputType: string): string {
  return PLACEHOLDER_INPUT_TYPE_LABELS[inputType] ?? inputType;
}
