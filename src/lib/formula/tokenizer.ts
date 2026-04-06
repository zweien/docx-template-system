export type TokenType =
  | "NUMBER"
  | "STRING"
  | "FIELD_REF"
  | "FUNCTION"
  | "OPERATOR"
  | "COMPARISON"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "AMPERSAND";

export interface Token {
  type: TokenType;
  value: string;
}

const OPERATORS = new Set(["+", "-", "*", "/", "%"]);
const COMPARISONS = new Set(["=", "!=", ">", "<", ">=", "<="]);
const FUNCTIONS = new Set([
  "SUM", "AVERAGE", "MIN", "MAX", "ROUND", "ABS", "CEILING", "FLOOR",
  "IF", "AND", "OR", "NOT",
  "CONCAT", "LEN", "LEFT", "RIGHT", "MID", "UPPER", "LOWER", "TRIM",
  "DATE_DIFF", "NOW", "YEAR", "MONTH", "DAY",
  "NUMBER", "TEXT",
]);

export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // String literal
    if (ch === '"') {
      let value = "";
      i++;
      while (i < formula.length && formula[i] !== '"') {
        value += formula[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: "STRING", value });
      continue;
    }

    // Field reference { ... }
    if (ch === "{") {
      let value = "";
      i++;
      while (i < formula.length && formula[i] !== "}") {
        value += formula[i];
        i++;
      }
      i++; // skip closing }
      tokens.push({ type: "FIELD_REF", value: value.trim() });
      continue;
    }

    // Parentheses
    if (ch === "(") { tokens.push({ type: "LPAREN", value: "(" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "RPAREN", value: ")" }); i++; continue; }

    // Comma
    if (ch === ",") { tokens.push({ type: "COMMA", value: "," }); i++; continue; }

    // Ampersand
    if (ch === "&") { tokens.push({ type: "AMPERSAND", value: "&" }); i++; continue; }

    // Comparison operators (multi-char first)
    const twoChar = formula.slice(i, i + 2);
    if (twoChar === "!=" || twoChar === ">=" || twoChar === "<=") {
      tokens.push({ type: "COMPARISON", value: twoChar });
      i += 2;
      continue;
    }
    if (COMPARISONS.has(ch)) {
      tokens.push({ type: "COMPARISON", value: ch });
      i++;
      continue;
    }

    // Arithmetic operators
    if (OPERATORS.has(ch)) {
      tokens.push({ type: "OPERATOR", value: ch });
      i++;
      continue;
    }

    // Number
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < formula.length && /[0-9]/.test(formula[i + 1]))) {
      let value = "";
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        value += formula[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value });
      continue;
    }

    // Identifier (function name or bare field reference)
    if (/[a-zA-Z_\u4e00-\u9fff]/.test(ch)) {
      let value = "";
      while (i < formula.length && /[a-zA-Z0-9_\u4e00-\u9fff]/.test(formula[i])) {
        value += formula[i];
        i++;
      }
      const nextNonSpace = formula.slice(i).trimStart();
      if (nextNonSpace.startsWith("(") && FUNCTIONS.has(value.toUpperCase())) {
        tokens.push({ type: "FUNCTION", value: value.toUpperCase() });
      } else {
        tokens.push({ type: "FIELD_REF", value });
      }
      continue;
    }

    throw new Error(`公式解析错误：无法识别的字符 "${ch}" (位置 ${i})`);
  }

  return tokens;
}
