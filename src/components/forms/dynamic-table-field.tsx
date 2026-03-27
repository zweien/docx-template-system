"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DynamicTableColumn {
  key: string;
  label: string;
}

interface DynamicTableFieldProps {
  label: string;
  columns: DynamicTableColumn[];
  value: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
  disabled?: boolean;
}

export function DynamicTableField({
  columns,
  value,
  onChange,
  disabled,
}: DynamicTableFieldProps) {
  const handleAddRow = () => {
    const newRow: Record<string, string> = {};
    for (const col of columns) {
      newRow[col.key] = "";
    }
    onChange([...value, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleCellChange = (rowIndex: number, colKey: string, cellValue: string) => {
    const next = value.map((row, i) =>
      i === rowIndex ? { ...row, [colKey]: cellValue } : row
    );
    onChange(next);
  };

  return (
    <Card size="sm">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Input
                      value={row[col.key] ?? ""}
                      onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                      placeholder={`请输入`}
                      disabled={disabled}
                      className="h-7 text-sm"
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDeleteRow(rowIndex)}
                    disabled={disabled}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {value.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-12 text-center text-muted-foreground text-sm"
                >
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            disabled={disabled}
          >
            <Plus />
            添加一行
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
