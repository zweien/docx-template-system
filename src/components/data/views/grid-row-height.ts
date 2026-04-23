export type GridRowHeightConfig = {
  td: string;
  actionTd: string;
  text: string;
  height: 24 | 32 | 40 | 56;
};

export function getRowHeightClasses(h: number): GridRowHeightConfig {
  switch (h) {
    case 24:
      return { td: "p-0.5", actionTd: "p-0", text: "text-xs", height: 24 };
    case 32:
      return { td: "p-1", actionTd: "p-0.5", text: "", height: 32 };
    case 56:
      return { td: "p-3 whitespace-normal", actionTd: "p-3", text: "", height: 56 };
    default:
      return { td: "p-2", actionTd: "p-1.5", text: "", height: 40 };
  }
}
