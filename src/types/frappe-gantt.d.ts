declare module "frappe-gantt" {
  export interface GanttTask {
    id: string;
    name: string;
    start: string;
    end: string;
    progress?: number;
    dependencies?: string;
    custom_class?: string;
  }

  export interface GanttApiTask {
    id: string;
    _start: Date;
    _end: Date;
  }

  export interface GanttOptions {
    view_mode?: "Week" | "Month";
    on_click?: (task: GanttApiTask) => void;
    on_date_change?: (task: GanttApiTask, start: Date, end: Date) => void;
  }

  export default class Gantt {
    constructor(container: HTMLElement, tasks: GanttTask[], options?: GanttOptions);
    change_view_mode?(mode: "Week" | "Month"): void;
  }
}
