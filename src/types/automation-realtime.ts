import type { AutomationRunItem, AutomationRunStepStatus } from "@/types/automation";

export type AutomationRealtimeConnectedEvent = {
  type: "connected";
  automationId: string;
};

export type AutomationRealtimeHeartbeatEvent = {
  type: "heartbeat";
  ts: number;
};

export type AutomationRunCreatedEvent = {
  type: "automation_run_created";
  automationId: string;
  run: AutomationRunItem;
};

export type AutomationRunUpdatedEvent = {
  type: "automation_run_updated";
  automationId: string;
  run: AutomationRunItem;
};

export type AutomationRunStepUpdatedEvent = {
  type: "automation_run_step_updated";
  automationId: string;
  runId: string;
  stepId: string;
  status: AutomationRunStepStatus;
};

export type AutomationRealtimeEvent =
  | AutomationRunCreatedEvent
  | AutomationRunUpdatedEvent
  | AutomationRunStepUpdatedEvent;

export type AutomationRealtimeStreamEvent =
  | AutomationRealtimeConnectedEvent
  | AutomationRealtimeHeartbeatEvent
  | AutomationRealtimeEvent;
