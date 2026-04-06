import { parseFormula, type AstNode } from "./ast";

export function extractFieldRefs(formula: string): string[] {
  try {
    const ast = parseFormula(formula);
    const refs = new Set<string>();
    collectFieldRefs(ast, refs);
    return Array.from(refs);
  } catch {
    return [];
  }
}

function collectFieldRefs(node: AstNode, refs: Set<string>): void {
  if (node.type === "fieldRef") {
    refs.add(node.key);
  } else if (node.type === "binaryOp") {
    collectFieldRefs(node.left, refs);
    collectFieldRefs(node.right, refs);
  } else if (node.type === "functionCall") {
    for (const arg of node.args) collectFieldRefs(arg, refs);
  } else if (node.type === "unaryOp") {
    collectFieldRefs(node.operand, refs);
  }
}

export function detectCircularRefs(fields: Record<string, string>): string | null {
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(fieldKey: string): boolean {
    if (stack.has(fieldKey)) return true;
    if (visited.has(fieldKey)) return false;
    visited.add(fieldKey);
    stack.add(fieldKey);
    const formula = fields[fieldKey];
    if (formula) {
      const refs = extractFieldRefs(formula);
      for (const ref of refs) {
        if (ref in fields && dfs(ref)) return true;
      }
    }
    stack.delete(fieldKey);
    return false;
  }

  for (const fieldKey of Object.keys(fields)) {
    if (dfs(fieldKey)) return `检测到循环引用，涉及字段: ${fieldKey}`;
    visited.clear();
    stack.clear();
  }
  return null;
}
