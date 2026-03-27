export interface TableGridColumn {
  key: string;
  label: string;
}

export interface PlaceholderItem {
  id: string;
  key: string;
  label: string;
  inputType: string; // PlaceholderType enum value: "TEXT" | "TEXTAREA" | "TABLE"
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  // 数据源绑定
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
  columns?: TableGridColumn[];
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
}

// 占位符快照项（用于版本存储）
export interface PlaceholderSnapshotItem {
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA" | "TABLE";
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  enablePicker: boolean;
  sourceTableId: string | null;
  sourceField: string | null;
  snapshotVersion: 1;
}
