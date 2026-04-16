export interface FunctionEntry {
  name: string;
  syntax: string;
  description: string;
}

export interface FunctionCategory {
  label: string;
  functions: FunctionEntry[];
}

export const FUNCTION_CATALOG: FunctionCategory[] = [
  {
    label: "数学",
    functions: [
      { name: "SUM", syntax: "SUM(val1, val2, ...)", description: "求和" },
      { name: "AVERAGE", syntax: "AVERAGE(val1, val2, ...)", description: "求平均值" },
      { name: "MIN", syntax: "MIN(val1, val2, ...)", description: "最小值" },
      { name: "MAX", syntax: "MAX(val1, val2, ...)", description: "最大值" },
      { name: "ROUND", syntax: "ROUND(value, digits)", description: "四舍五入" },
      { name: "ABS", syntax: "ABS(value)", description: "绝对值" },
      { name: "CEILING", syntax: "CEILING(value)", description: "向上取整" },
      { name: "FLOOR", syntax: "FLOOR(value)", description: "向下取整" },
    ],
  },
  {
    label: "逻辑",
    functions: [
      { name: "IF", syntax: "IF(condition, then, else)", description: "条件判断" },
      { name: "AND", syntax: "AND(cond1, cond2, ...)", description: "全部为真" },
      { name: "OR", syntax: "OR(cond1, cond2, ...)", description: "任一为真" },
      { name: "NOT", syntax: "NOT(condition)", description: "取反" },
    ],
  },
  {
    label: "文本",
    functions: [
      { name: "CONCAT", syntax: "CONCAT(str1, str2, ...)", description: "连接字符串" },
      { name: "LEN", syntax: "LEN(text)", description: "字符串长度" },
      { name: "LEFT", syntax: "LEFT(text, count)", description: "取左侧字符" },
      { name: "RIGHT", syntax: "RIGHT(text, count)", description: "取右侧字符" },
      { name: "MID", syntax: "MID(text, start, len)", description: "取中间字符" },
      { name: "UPPER", syntax: "UPPER(text)", description: "转大写" },
      { name: "LOWER", syntax: "LOWER(text)", description: "转小写" },
      { name: "TRIM", syntax: "TRIM(text)", description: "去除首尾空格" },
    ],
  },
  {
    label: "日期",
    functions: [
      { name: "NOW", syntax: "NOW()", description: "当前时间" },
      { name: "YEAR", syntax: "YEAR(date)", description: "提取年份" },
      { name: "MONTH", syntax: "MONTH(date)", description: "提取月份" },
      { name: "DAY", syntax: "DAY(date)", description: "提取日期" },
      { name: "DATE_DIFF", syntax: "DATE_DIFF(date1, date2, unit)", description: "日期差值" },
    ],
  },
  {
    label: "类型转换",
    functions: [
      { name: "NUMBER", syntax: "NUMBER(value)", description: "转为数字" },
      { name: "TEXT", syntax: "TEXT(value)", description: "转为文本" },
    ],
  },
];

export const ALL_FUNCTIONS = new Map<string, FunctionEntry>(
  FUNCTION_CATALOG.flatMap((cat) => cat.functions.map((fn) => [fn.name, fn]))
);
