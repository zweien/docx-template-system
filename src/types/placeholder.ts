export interface PlaceholderItem {
  id: string;
  key: string;
  label: string;
  inputType: string; // PlaceholderType enum value: "TEXT" | "TEXTAREA"
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  // 数据源绑定
  sourceTableId: string | null;
  sourceField: string | null;
  enablePicker: boolean;
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
}
