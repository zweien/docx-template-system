import { tokenize, type Token } from "./tokenizer";

// ── AST Node Types ──

export type AstNode =
  | { type: "numberLiteral"; value: number }
  | { type: "stringLiteral"; value: string }
  | { type: "fieldRef"; key: string }
  | { type: "binaryOp"; op: string; left: AstNode; right: AstNode }
  | { type: "functionCall"; name: string; args: AstNode[] }
  | { type: "unaryOp"; op: string; operand: AstNode };

// ── Parser ──

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export function parseFormula(formula: string): AstNode {
  const tokens = tokenize(formula);
  if (tokens.length === 0) throw new ParseError("公式不能为空");

  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function expect(type: string): Token {
    const token = peek();
    if (!token) throw new ParseError(`公式意外结束，期望 ${type}`);
    if (token.type !== type) {
      throw new ParseError(`期望 ${type}，实际为 "${token.value}"(${token.type})`);
    }
    return advance();
  }

  // comparison → additive (("=" | "!=" | ">" | "<" | ">=" | "<=") additive)?
  function parseComparison(): AstNode {
    let left = parseAdditive();
    const token = peek();
    if (token?.type === "COMPARISON") {
      const op = advance().value;
      const right = parseAdditive();
      return { type: "binaryOp", op, left, right };
    }
    return left;
  }

  // additive → multiplicative (("+" | "-") multiplicative)*
  function parseAdditive(): AstNode {
    let left = parseMultiplicative();
    while (peek()?.type === "OPERATOR" && (peek()?.value === "+" || peek()?.value === "-")) {
      const op = advance().value;
      const right = parseMultiplicative();
      left = { type: "binaryOp", op, left, right };
    }
    return left;
  }

  // multiplicative → unary (("*" | "/" | "%") | "&") unary)*
  function parseMultiplicative(): AstNode {
    let left = parseUnary();
    while (
      (peek()?.type === "OPERATOR" && ["*", "/", "%"].includes(peek()?.value ?? "")) ||
      peek()?.type === "AMPERSAND"
    ) {
      const op = advance().value;
      const right = parseUnary();
      left = { type: "binaryOp", op, left, right };
    }
    return left;
  }

  // unary → ("-" unary) | primary
  function parseUnary(): AstNode {
    if (peek()?.type === "OPERATOR" && peek()?.value === "-") {
      advance();
      const operand = parseUnary();
      return { type: "unaryOp", op: "-", operand };
    }
    return parsePrimary();
  }

  // primary → NUMBER | STRING | FIELD_REF | FUNCTION(...) | "(" expression ")"
  function parsePrimary(): AstNode {
    const token = peek();
    if (!token) throw new ParseError("公式意外结束");

    switch (token.type) {
      case "NUMBER": {
        advance();
        return { type: "numberLiteral", value: Number(token.value) };
      }
      case "STRING": {
        advance();
        return { type: "stringLiteral", value: token.value };
      }
      case "FIELD_REF": {
        advance();
        return { type: "fieldRef", key: token.value };
      }
      case "FUNCTION": {
        const name = advance().value;
        expect("LPAREN");
        const args: AstNode[] = [];
        if (peek()?.type !== "RPAREN") {
          args.push(parseComparison());
          while (peek()?.type === "COMMA") {
            advance();
            args.push(parseComparison());
          }
        }
        expect("RPAREN");
        return { type: "functionCall", name, args };
      }
      case "LPAREN": {
        advance();
        const expr = parseComparison();
        expect("RPAREN");
        return expr;
      }
      default:
        throw new ParseError(`无法解析: "${token.value}"(${token.type})`);
    }
  }

  const result = parseComparison();
  if (pos < tokens.length) {
    throw new ParseError(`公式末尾有多余内容: "${tokens[pos].value}"`);
  }
  return result;
}
