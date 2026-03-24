export interface PlaceholderItem {
  id: string;
  key: string;
  label: string;
  inputType: string; // PlaceholderType enum value: "TEXT" | "TEXTAREA"
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
}
