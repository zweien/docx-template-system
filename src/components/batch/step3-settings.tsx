"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import type { Settings } from "@/types/batch-generation";

interface Step3SettingsProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  availableVariables: string[];
  onPrev: () => void;
  onNext: () => void;
}

export function Step3Settings({
  settings,
  onSettingsChange,
  availableVariables,
  onPrev,
  onNext,
}: Step3SettingsProps) {
  const [patternError, setPatternError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validatePattern = (pattern: string): boolean => {
    if (!pattern.trim()) {
      setPatternError("文件名不能为空");
      return false;
    }
    if (pattern.length > 200) {
      setPatternError("文件名过长（最多200个字符）");
      return false;
    }
    // 检查非法字符
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(pattern)) {
      setPatternError("文件名包含非法字符");
      return false;
    }
    setPatternError(null);
    return true;
  };

  const handlePatternChange = (value: string) => {
    onSettingsChange({ ...settings, fileNamePattern: value });
    validatePattern(value);
  };

  const handleOutputMethodChange = (value: "DOWNLOAD" | "SAVE_TO_RECORDS") => {
    onSettingsChange({ ...settings, outputMethod: value });
  };

  const insertVariable = (variable: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const before = settings.fileNamePattern.substring(0, start);
      const after = settings.fileNamePattern.substring(end);
      const newPattern = `${before}{{${variable}}}${after}`;
      handlePatternChange(newPattern);
      // 设置光标位置
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    } else {
      handlePatternChange(`${settings.fileNamePattern}{{${variable}}}`);
    }
  };

  const canNext = !patternError && settings.fileNamePattern.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">生成设置</h2>
        <p className="text-zinc-500 text-sm mt-1">
          配置文件名格式和输出方式
        </p>
      </div>

      {/* 文件名模式 */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fileNamePattern">文件名格式</Label>
          <Input
            id="fileNamePattern"
            ref={inputRef}
            value={settings.fileNamePattern}
            onChange={(e) => handlePatternChange(e.target.value)}
            placeholder="例如: 合同_{{name}}_{{date}}"
            className={patternError ? "border-red-500" : ""}
          />
          {patternError && (
            <p className="text-sm text-red-500">{patternError}</p>
          )}
          <p className="text-xs text-zinc-500">
            使用 {"{{变量名}}"} 插入数据字段值，使用 {"{{_index}}"} 插入序号
          </p>
        </div>

        {/* 可用变量 */}
        {availableVariables.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Info className="h-4 w-4" />
              可用变量（点击插入）
            </div>
            <div className="flex flex-wrap gap-2">
              {availableVariables.map((variable) => (
                <Badge
                  key={variable}
                  variant="outline"
                  className="cursor-pointer hover:bg-zinc-100 transition-colors"
                  onClick={() => insertVariable(variable)}
                >
                  {"{{"} {variable} {"}}"}
                </Badge>
              ))}
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-zinc-200 transition-colors"
                onClick={() => insertVariable("_index")}
              >
                {"{{"} _index {"}}"}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* 输出方式 */}
      <div className="space-y-4">
        <Label>输出方式</Label>
        <RadioGroup
          value={settings.outputMethod}
          onValueChange={(v) => handleOutputMethodChange(v as "DOWNLOAD" | "SAVE_TO_RECORDS")}
          className="space-y-3"
        >
          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted cursor-pointer">
            <RadioGroupItem value="DOWNLOAD" id="download" className="mt-0.5" />
            <div className="flex-1">
              <label htmlFor="download" className="font-medium cursor-pointer">
                下载 ZIP 压缩包
              </label>
              <p className="text-sm text-zinc-500 mt-1">
                将所有生成的文档打包为 ZIP 文件下载
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted cursor-pointer">
            <RadioGroupItem value="SAVE_TO_RECORDS" id="save" className="mt-0.5" />
            <div className="flex-1">
              <label htmlFor="save" className="font-medium cursor-pointer">
                保存到记录
              </label>
              <p className="text-sm text-zinc-500 mt-1">
                将生成的文档保存到对应的数据记录中，可在记录详情中查看和下载
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* 底部导航 */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          上一步
        </Button>
        <Button onClick={onNext} disabled={!canNext}>
          开始生成
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
