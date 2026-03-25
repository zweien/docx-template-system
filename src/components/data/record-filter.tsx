"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Filter } from "lucide-react";
import type { DataFieldItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

export type FilterOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';

export interface ActiveFilter {
  fieldKey: string;
  operator: FilterOperator;
  value: string;
}

interface RecordFilterProps {
  fields: DataFieldItem[];
  filters: ActiveFilter[];
  onFiltersChange: (filters: ActiveFilter[]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: '等于',
  ne: '不等于',
  gt: '大于',
  lt: '小于',
  gte: '大于等于',
  lte: '小于等于',
  contains: '包含',
};

// 根据字段类型返回可用操作符
function getOperatorsForType(type: FieldType): FilterOperator[] {
  switch (type) {
    case FieldType.NUMBER:
      return ['eq', 'ne', 'gt', 'lt', 'gte', 'lte'];
    case FieldType.DATE:
      return ['eq', 'gt', 'lt', 'gte', 'lte'];
    case FieldType.SELECT:
      return ['eq', 'ne'];
    case FieldType.MULTISELECT:
      return ['contains'];
    case FieldType.EMAIL:
    case FieldType.PHONE:
      return ['eq', 'contains'];
    case FieldType.TEXT:
    default:
      return ['eq', 'ne', 'contains'];
  }
}

export function RecordFilter({
  fields,
  filters,
  onFiltersChange,
  searchValue,
  onSearchChange,
}: RecordFilterProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState<string>("");
  const [newOperator, setNewOperator] = useState<FilterOperator>('eq');
  const [newValue, setNewValue] = useState("");

  const handleAddFilter = () => {
    if (!newFieldKey || !newValue) return;

    onFiltersChange([
      ...filters,
      { fieldKey: newFieldKey, operator: newOperator, value: newValue },
    ]);

    // 重置状态
    setNewFieldKey("");
    setNewOperator('eq');
    setNewValue("");
    setIsAdding(false);
  };

  const handleRemoveFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    onFiltersChange([]);
  };

  // 获取字段信息
  const getField = (key: string) => fields.find((f) => f.key === key);

  return (
    <div className="space-y-3">
      {/* 搜索框和添加筛选按钮 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="搜索记录..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pr-8"
          />
        </div>
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            添加筛选
          </Button>
        )}
      </div>

      {/* 添加筛选表单 */}
      {isAdding && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Select
            value={newFieldKey}
            onValueChange={(v) => {
              if (!v) return;
              setNewFieldKey(v);
              // 重置操作符为该类型的第一个可用操作符
              const field = getField(v);
              if (field) {
                const ops = getOperatorsForType(field.type);
                setNewOperator(ops[0]);
              }
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="选择字段" />
            </SelectTrigger>
            <SelectContent>
              {fields.map((field) => (
                <SelectItem key={field.key} value={field.key}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {newFieldKey && (
            <>
              <Select
                value={newOperator}
                onValueChange={(v) => {
                  if (!v) return;
                  setNewOperator(v as FilterOperator);
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getOperatorsForType(getField(newFieldKey)!.type).map((op) => (
                    <SelectItem key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="输入值"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-[150px]"
                onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
              />

              <Button size="sm" onClick={handleAddFilter} disabled={!newValue}>
                添加
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewFieldKey("");
                  setNewValue("");
                }}
              >
                取消
              </Button>
            </>
          )}
        </div>
      )}

      {/* 活动筛选标签 */}
      {filters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filters.map((filter, index) => {
            const field = getField(filter.fieldKey);
            return (
              <Badge key={index} variant="secondary" className="gap-1">
                <span>{field?.label || filter.fieldKey}</span>
                <span className="text-muted-foreground">
                  {OPERATOR_LABELS[filter.operator]}
                </span>
                <span className="font-medium">{filter.value}</span>
                <button
                  onClick={() => handleRemoveFilter(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={handleClearAll}
          >
            清除全部
          </Button>
        </div>
      )}
    </div>
  );
}
