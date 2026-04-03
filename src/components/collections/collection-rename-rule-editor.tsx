"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BUILTIN_VARIABLES = [
  "任务标题",
  "姓名",
  "邮箱",
  "序号",
  "提交时间",
  "原始文件名",
  "版本号",
] as const;

function replaceTokens(template: string, values: Record<string, string>) {
  return template.replace(/\{([^}]+)\}/g, (_, token: string) => values[token] ?? `{${token}}`);
}

export function CollectionRenameRuleEditor({
  value,
  onChange,
  customVariables,
  previewContext,
}: {
  value: string;
  onChange: (value: string) => void;
  customVariables: Record<string, string>;
  previewContext?: Partial<Record<(typeof BUILTIN_VARIABLES)[number], string>>;
}) {
  const previewValues: Record<string, string> = {
    任务标题: "营业执照收集",
    姓名: "张三",
    邮箱: "zhangsan@example.com",
    序号: "1",
    提交时间: "20260403_120000",
    原始文件名: "营业执照",
    版本号: "2",
    ...previewContext,
    ...customVariables,
  };

  const preview = `${replaceTokens(value || "{任务标题}_{姓名}", previewValues)}.docx`;

  function insertVariable(variable: string) {
    onChange(`${value}{${variable}}`);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="renameRule">文件命名规则</Label>
        <Input
          id="renameRule"
          aria-label="文件命名规则"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="{任务标题}_{姓名}"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {BUILTIN_VARIABLES.map((variable) => (
          <Button
            key={variable}
            type="button"
            variant="outline"
            size="sm"
            aria-label={`插入变量 ${variable}`}
            onClick={() => insertVariable(variable)}
          >
            {variable}
          </Button>
        ))}
        {Object.keys(customVariables).map((variable) => (
          <Button
            key={variable}
            type="button"
            variant="outline"
            size="sm"
            aria-label={`插入变量 ${variable}`}
            onClick={() => insertVariable(variable)}
          >
            {variable}
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">预览：{preview}</p>
    </div>
  );
}
