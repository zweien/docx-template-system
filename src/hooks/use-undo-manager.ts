"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export type CommandType =
  | "UPDATE_CELL"
  | "ADD_RECORD"
  | "DELETE_RECORD"
  | "BATCH_UPDATE"
  | "ADD_FIELD"
  | "DELETE_FIELD"
  | "FILL_CELLS";

export interface Command {
  type: CommandType;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
  description: string;
}

interface UndoManagerState {
  canUndo: boolean;
  canRedo: boolean;
  isExecuting: boolean;
  lastDescription: string | null;
}

const MAX_STACK_SIZE = 50;

export function useUndoManager() {
  const undoStackRef = useRef<Command[]>([]);
  const redoStackRef = useRef<Command[]>([]);
  const [state, setState] = useState<UndoManagerState>({
    canUndo: false,
    canRedo: false,
    isExecuting: false,
    lastDescription: null,
  });

  const updateState = useCallback(() => {
    setState({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
      isExecuting: false,
      lastDescription:
        undoStackRef.current.length > 0
          ? undoStackRef.current[undoStackRef.current.length - 1].description
          : null,
    });
  }, []);

  const execute = useCallback(async (command: Command) => {
    try {
      setState((s) => ({ ...s, isExecuting: true }));
      await command.execute();
      undoStackRef.current.push(command);
      if (undoStackRef.current.length > MAX_STACK_SIZE) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      updateState();
    } catch (error) {
      setState((s) => ({ ...s, isExecuting: false }));
      throw error;
    }
  }, [updateState]);

  const undo = useCallback(async () => {
    const command = undoStackRef.current[undoStackRef.current.length - 1];
    if (!command) return;

    setState((s) => ({ ...s, isExecuting: true }));
    try {
      await command.undo();
      undoStackRef.current.pop();
      redoStackRef.current.push(command);
      updateState();
      toast.info(`已撤销：${command.description}`);
    } catch {
      updateState();
      toast.error("撤销失败");
    }
  }, [updateState]);

  const redo = useCallback(async () => {
    const command = redoStackRef.current[redoStackRef.current.length - 1];
    if (!command) return;

    setState((s) => ({ ...s, isExecuting: true }));
    try {
      await command.execute();
      redoStackRef.current.pop();
      undoStackRef.current.push(command);
      updateState();
      toast.info(`已重做：${command.description}`);
    } catch {
      updateState();
      toast.error("重做失败");
    }
  }, [updateState]);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setState({ canUndo: false, canRedo: false, isExecuting: false, lastDescription: null });
  }, []);

  return {
    ...state,
    execute,
    undo,
    redo,
    clear,
  };
}
