import { parseFormula, type AstNode } from "./ast";
import { ALL_FUNCTIONS } from "./function-catalog";

type FormulaValue = number | string | boolean | null;

export function evaluateFormula(
  formula: string,
  recordData: Record<string, unknown>
): FormulaValue {
  try {
    const ast = parseFormula(formula);
    return evaluateNode(ast, recordData);
  } catch {
    return "#ERROR";
  }
}

function evaluateNode(node: AstNode, data: Record<string, unknown>): FormulaValue {
  switch (node.type) {
    case "numberLiteral":
      return node.value;
    case "stringLiteral":
      return node.value;
    case "fieldRef": {
      if (node.key in data) return data[node.key] as FormulaValue;
      return "#REF";
    }
    case "unaryOp": {
      const val = evaluateNode(node.operand, data);
      if (typeof val === "string" && val.startsWith("#")) return val;
      if (node.op === "-") return -(Number(val) || 0);
      return val;
    }
    case "binaryOp":
      return evaluateBinaryOp(node.op, node.left, node.right, data);
    case "functionCall":
      return evaluateFunction(node.name, node.args, data);
  }
}

function evaluateBinaryOp(op: string, leftNode: AstNode, rightNode: AstNode, data: Record<string, unknown>): FormulaValue {
  if (op === "&") {
    return String(evaluateNode(leftNode, data) ?? "") + String(evaluateNode(rightNode, data) ?? "");
  }
  const left = evaluateNode(leftNode, data);
  const right = evaluateNode(rightNode, data);
  if (typeof left === "string" && left.startsWith("#")) return left;
  if (typeof right === "string" && right.startsWith("#")) return right;
  const l = Number(left) || 0;
  const r = Number(right) || 0;
  switch (op) {
    case "+": return l + r;
    case "-": return l - r;
    case "*": return l * r;
    case "/": return r === 0 ? "#DIV/0" : l / r;
    case "%": return r === 0 ? "#DIV/0" : l % r;
    case "=": return left === right;
    case "!=": return left !== right;
    case ">": return l > r;
    case "<": return l < r;
    case ">=": return l >= r;
    case "<=": return l <= r;
    default: return "#ERROR";
  }
}

function toNumber(v: FormulaValue): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toString(v: FormulaValue): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function evaluateFunction(name: string, argNodes: AstNode[], data: Record<string, unknown>): FormulaValue {
  const entry = ALL_FUNCTIONS.get(name);
  if (entry && argNodes.length < entry.minArgs) {
    return `#ERROR:${name} 至少需要 ${entry.minArgs} 个参数`;
  }
  switch (name) {
    case "SUM": return argNodes.reduce((s, n) => s + toNumber(evaluateNode(n, data)), 0);
    case "AVERAGE": {
      const vals = argNodes.map(n => toNumber(evaluateNode(n, data)));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    case "MIN": return Math.min(...argNodes.map(n => toNumber(evaluateNode(n, data))));
    case "MAX": return Math.max(...argNodes.map(n => toNumber(evaluateNode(n, data))));
    case "ROUND": {
      const val = toNumber(evaluateNode(argNodes[0], data));
      const dec = argNodes[1] ? toNumber(evaluateNode(argNodes[1], data)) : 0;
      const f = Math.pow(10, dec);
      return Math.round(val * f) / f;
    }
    case "ABS": return Math.abs(toNumber(evaluateNode(argNodes[0], data)));
    case "CEILING": return Math.ceil(toNumber(evaluateNode(argNodes[0], data)));
    case "FLOOR": return Math.floor(toNumber(evaluateNode(argNodes[0], data)));
    case "IF": {
      const cond = evaluateNode(argNodes[0], data);
      return cond ? evaluateNode(argNodes[1], data) : (argNodes[2] ? evaluateNode(argNodes[2], data) : null);
    }
    case "AND": return argNodes.every(n => !!evaluateNode(n, data));
    case "OR": return argNodes.some(n => !!evaluateNode(n, data));
    case "NOT": return !evaluateNode(argNodes[0], data);
    case "CONCAT": return argNodes.map(n => toString(evaluateNode(n, data))).join("");
    case "LEN": return toString(evaluateNode(argNodes[0], data)).length;
    case "LEFT": return toString(evaluateNode(argNodes[0], data)).slice(0, toNumber(evaluateNode(argNodes[1], data)));
    case "RIGHT": return toString(evaluateNode(argNodes[0], data)).slice(-toNumber(evaluateNode(argNodes[1], data)));
    case "MID": {
      const s = toString(evaluateNode(argNodes[0], data));
      const start = toNumber(evaluateNode(argNodes[1], data)) - 1;
      const len = toNumber(evaluateNode(argNodes[2], data));
      return s.slice(start, start + len);
    }
    case "UPPER": return toString(evaluateNode(argNodes[0], data)).toUpperCase();
    case "LOWER": return toString(evaluateNode(argNodes[0], data)).toLowerCase();
    case "TRIM": return toString(evaluateNode(argNodes[0], data)).trim();
    case "NOW": return new Date().toISOString();
    case "YEAR": return new Date(toString(evaluateNode(argNodes[0], data))).getFullYear();
    case "MONTH": return new Date(toString(evaluateNode(argNodes[0], data))).getMonth() + 1;
    case "DAY": return new Date(toString(evaluateNode(argNodes[0], data))).getDate();
    case "DATE_DIFF": {
      const a = new Date(toString(evaluateNode(argNodes[0], data))).getTime();
      const b = new Date(toString(evaluateNode(argNodes[1], data))).getTime();
      const diff = Math.abs(a - b);
      const unit = argNodes[2] ? toString(evaluateNode(argNodes[2], data)) : "day";
      switch (unit) {
        case "day": return Math.floor(diff / 86400000);
        case "month": return Math.floor(diff / 2592000000);
        case "year": return Math.floor(diff / 31536000000);
        default: return diff;
      }
    }
    case "NUMBER": return toNumber(evaluateNode(argNodes[0], data));
    case "TEXT": return toString(evaluateNode(argNodes[0], data));
    default: return `#ERROR:未知函数 ${name}`;
  }
}
