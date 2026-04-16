export interface ParamDef {
  name: string;
  type: "number" | "string" | "boolean" | "date" | "any";
  repeated?: boolean;
  optional?: boolean;
}

export interface FunctionEntry {
  name: string;
  syntax: string;
  description: string;
  params: ParamDef[];
  returnType: "number" | "string" | "boolean" | "date";
  minArgs: number;
  example?: string;
  exampleResult?: string;
}

export interface FunctionCategory {
  label: string;
  functions: FunctionEntry[];
}

export const FUNCTION_CATALOG: FunctionCategory[] = [
  {
    label: "数学",
    functions: [
      { name: "SUM", syntax: "SUM(val1, val2, ...)", description: "求和", params: [{ name: "val1", type: "number" }, { name: "val2", type: "number", repeated: true }], returnType: "number", minArgs: 1, example: "SUM({ price }, { quantity })", exampleResult: "150" },
      { name: "AVERAGE", syntax: "AVERAGE(val1, val2, ...)", description: "求平均值", params: [{ name: "val1", type: "number" }, { name: "val2", type: "number", repeated: true }], returnType: "number", minArgs: 1, example: "AVERAGE(80, 90, 100)", exampleResult: "90" },
      { name: "MIN", syntax: "MIN(val1, val2, ...)", description: "最小值", params: [{ name: "val1", type: "number" }, { name: "val2", type: "number", repeated: true }], returnType: "number", minArgs: 1, example: "MIN(3, 1, 4, 1, 5)", exampleResult: "1" },
      { name: "MAX", syntax: "MAX(val1, val2, ...)", description: "最大值", params: [{ name: "val1", type: "number" }, { name: "val2", type: "number", repeated: true }], returnType: "number", minArgs: 1, example: "MAX(3, 1, 4, 1, 5)", exampleResult: "5" },
      { name: "ROUND", syntax: "ROUND(value, digits)", description: "四舍五入", params: [{ name: "value", type: "number" }, { name: "digits", type: "number", optional: true }], returnType: "number", minArgs: 1, example: "ROUND(3.1415, 2)", exampleResult: "3.14" },
      { name: "ABS", syntax: "ABS(value)", description: "绝对值", params: [{ name: "value", type: "number" }], returnType: "number", minArgs: 1, example: "ABS(-42)", exampleResult: "42" },
      { name: "CEILING", syntax: "CEILING(value)", description: "向上取整", params: [{ name: "value", type: "number" }], returnType: "number", minArgs: 1, example: "CEILING(3.2)", exampleResult: "4" },
      { name: "FLOOR", syntax: "FLOOR(value)", description: "向下取整", params: [{ name: "value", type: "number" }], returnType: "number", minArgs: 1, example: "FLOOR(3.8)", exampleResult: "3" },
    ],
  },
  {
    label: "逻辑",
    functions: [
      { name: "IF", syntax: "IF(condition, then, else)", description: "条件判断", params: [{ name: "condition", type: "boolean" }, { name: "then", type: "any" }, { name: "else", type: "any", optional: true }], returnType: "number", minArgs: 2, example: 'IF({ score } >= 60, "及格", "不及格")', exampleResult: '"及格"' },
      { name: "AND", syntax: "AND(cond1, cond2, ...)", description: "全部为真", params: [{ name: "cond1", type: "boolean" }, { name: "cond2", type: "boolean", repeated: true }], returnType: "boolean", minArgs: 1, example: "AND({ age } > 18, { active })", exampleResult: "true" },
      { name: "OR", syntax: "OR(cond1, cond2, ...)", description: "任一为真", params: [{ name: "cond1", type: "boolean" }, { name: "cond2", type: "boolean", repeated: true }], returnType: "boolean", minArgs: 1, example: "OR({ vip }, { score } > 90)", exampleResult: "true" },
      { name: "NOT", syntax: "NOT(condition)", description: "取反", params: [{ name: "condition", type: "boolean" }], returnType: "boolean", minArgs: 1, example: "NOT({ disabled })", exampleResult: "true" },
    ],
  },
  {
    label: "文本",
    functions: [
      { name: "CONCAT", syntax: "CONCAT(str1, str2, ...)", description: "连接字符串", params: [{ name: "str1", type: "string" }, { name: "str2", type: "string", repeated: true }], returnType: "string", minArgs: 1, example: 'CONCAT({ last }, " ", { first })', exampleResult: '"张 三"' },
      { name: "LEN", syntax: "LEN(text)", description: "字符串长度", params: [{ name: "text", type: "string" }], returnType: "number", minArgs: 1, example: 'LEN("Hello")', exampleResult: "5" },
      { name: "LEFT", syntax: "LEFT(text, count)", description: "取左侧字符", params: [{ name: "text", type: "string" }, { name: "count", type: "number" }], returnType: "string", minArgs: 2, example: 'LEFT("Hello", 3)', exampleResult: '"Hel"' },
      { name: "RIGHT", syntax: "RIGHT(text, count)", description: "取右侧字符", params: [{ name: "text", type: "string" }, { name: "count", type: "number" }], returnType: "string", minArgs: 2, example: 'RIGHT("Hello", 2)', exampleResult: '"lo"' },
      { name: "MID", syntax: "MID(text, start, len)", description: "取中间字符", params: [{ name: "text", type: "string" }, { name: "start", type: "number" }, { name: "len", type: "number" }], returnType: "string", minArgs: 3, example: 'MID("Hello", 2, 3)', exampleResult: '"ell"' },
      { name: "UPPER", syntax: "UPPER(text)", description: "转大写", params: [{ name: "text", type: "string" }], returnType: "string", minArgs: 1, example: 'UPPER("hello")', exampleResult: '"HELLO"' },
      { name: "LOWER", syntax: "LOWER(text)", description: "转小写", params: [{ name: "text", type: "string" }], returnType: "string", minArgs: 1, example: 'LOWER("HELLO")', exampleResult: '"hello"' },
      { name: "TRIM", syntax: "TRIM(text)", description: "去除首尾空格", params: [{ name: "text", type: "string" }], returnType: "string", minArgs: 1, example: 'TRIM("  hi  ")', exampleResult: '"hi"' },
    ],
  },
  {
    label: "日期",
    functions: [
      { name: "NOW", syntax: "NOW()", description: "当前时间", params: [], returnType: "date", minArgs: 0, example: "NOW()", exampleResult: "2026-04-16T..." },
      { name: "YEAR", syntax: "YEAR(date)", description: "提取年份", params: [{ name: "date", type: "date" }], returnType: "number", minArgs: 1, example: 'YEAR("2026-04-16")', exampleResult: "2026" },
      { name: "MONTH", syntax: "MONTH(date)", description: "提取月份", params: [{ name: "date", type: "date" }], returnType: "number", minArgs: 1, example: 'MONTH("2026-04-16")', exampleResult: "4" },
      { name: "DAY", syntax: "DAY(date)", description: "提取日期", params: [{ name: "date", type: "date" }], returnType: "number", minArgs: 1, example: 'DAY("2026-04-16")', exampleResult: "16" },
      { name: "DATE_DIFF", syntax: "DATE_DIFF(date1, date2, unit)", description: "日期差值", params: [{ name: "date1", type: "date" }, { name: "date2", type: "date" }, { name: "unit", type: "string", optional: true }], returnType: "number", minArgs: 2, example: 'DATE_DIFF("2026-01-01", "2026-04-16", "day")', exampleResult: "105" },
    ],
  },
  {
    label: "类型转换",
    functions: [
      { name: "NUMBER", syntax: "NUMBER(value)", description: "转为数字", params: [{ name: "value", type: "any" }], returnType: "number", minArgs: 1, example: 'NUMBER("42")', exampleResult: "42" },
      { name: "TEXT", syntax: "TEXT(value)", description: "转为文本", params: [{ name: "value", type: "any" }], returnType: "string", minArgs: 1, example: "TEXT(3.14)", exampleResult: '"3.14"' },
    ],
  },
];

export const ALL_FUNCTIONS = new Map<string, FunctionEntry>(
  FUNCTION_CATALOG.flatMap((cat) => cat.functions.map((fn) => [fn.name, fn]))
);
