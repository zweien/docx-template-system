"use client";

interface FormulaCellEditorProps {
  value: unknown;
}

export function FormulaCellEditor({ value }: FormulaCellEditorProps) {
  return (
    <span className="text-sm text-muted-foreground italic">
      {value === null || value === undefined ? "-" : String(value)}
    </span>
  );
}
