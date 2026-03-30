"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ChoiceOption {
  value: string;
  label: string;
}

interface ChoicePickerFieldProps {
  mode: "single" | "multiple";
  options: ChoiceOption[];
  value: string | string[];
  onChange: (nextValue: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function getTriggerLabel(
  mode: ChoicePickerFieldProps["mode"],
  options: ChoiceOption[],
  value: string | string[],
  placeholder: string
): string {
  if (mode === "single") {
    if (typeof value !== "string" || !value) {
      return placeholder;
    }

    return options.find((option) => option.value === value)?.label ?? value;
  }

  if (!Array.isArray(value) || value.length === 0) {
    return placeholder;
  }

  return `已选择 ${value.length} 项`;
}

export function ChoicePickerField({
  mode,
  options,
  value,
  onChange,
  placeholder = "请选择",
  disabled,
}: ChoicePickerFieldProps) {
  const triggerLabel = getTriggerLabel(mode, options, value, placeholder);
  const selectedValues = Array.isArray(value) ? value : [];

  return (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="outline" className="w-full justify-between" disabled={disabled} />}
      >
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent role="dialog" align="start" className="w-72 p-2">
        <div className="flex flex-col gap-1">
          {options.map((option) => {
            if (mode === "single") {
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={value === option.value ? "default" : "ghost"}
                  className="justify-start"
                  onClick={() => onChange(option.value)}
                >
                  {option.label}
                </Button>
              );
            }

            const checked = selectedValues.includes(option.value);

            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <Checkbox
                  aria-label={option.label}
                  checked={checked}
                  onCheckedChange={(nextChecked) => {
                    if (nextChecked) {
                      onChange([...selectedValues, option.value]);
                      return;
                    }

                    onChange(selectedValues.filter((item) => item !== option.value));
                  }}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
