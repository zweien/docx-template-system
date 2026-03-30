export interface TableGridColumn {
  key: string;
  label: string;
}

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ChoicePlaceholderConfig {
  mode: "single" | "multiple";
  options: ChoiceOption[];
  marker: {
    template: string;
    checked: string;
    unchecked: string;
  };
}

export interface PlaceholderItem {
  id: string;
  key: string;
  label: string;
  inputType: string; // PlaceholderType enum value: "TEXT" | "TEXTAREA" | "TABLE" | "CHOICE_SINGLE" | "CHOICE_MULTI"
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  // 数据源绑定
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
  columns?: TableGridColumn[];
  choiceConfig?: ChoicePlaceholderConfig | null;
  description: string | null;
}

export interface PlaceholderWithSource {
  id: string;
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
  columns?: unknown;
  choiceConfig?: unknown;
  description: string | null;
}

// 占位符快照项（用于版本存储）
export interface PlaceholderSnapshotItem {
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA" | "TABLE" | "CHOICE_SINGLE" | "CHOICE_MULTI";
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  enablePicker: boolean;
  sourceTableId: string | null;
  sourceField: string | null;
  choiceConfig?: ChoicePlaceholderConfig | null;
  description: string | null;
  snapshotVersion: 1;
}
