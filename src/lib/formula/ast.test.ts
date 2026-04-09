import { describe, expect, it } from "vitest";
import { parseFormula, type AstNode } from "./ast";

describe("parseFormula", () => {
  it("should parse simple field reference", () => {
    const ast = parseFormula("{ price }");
    expect(ast).toEqual({ type: "fieldRef", key: "price" });
  });

  it("should parse number literal", () => {
    const ast = parseFormula("42");
    expect(ast).toEqual({ type: "numberLiteral", value: 42 });
  });

  it("should parse string literal", () => {
    const ast = parseFormula('"hello"');
    expect(ast).toEqual({ type: "stringLiteral", value: "hello" });
  });

  it("should parse binary expression", () => {
    const ast = parseFormula("{ price } * { quantity }");
    expect(ast).toMatchObject({
      type: "binaryOp",
      op: "*",
      left: { type: "fieldRef", key: "price" },
      right: { type: "fieldRef", key: "quantity" },
    });
  });

  it("should parse function call", () => {
    const ast = parseFormula("SUM({ a }, { b })");
    expect(ast).toMatchObject({
      type: "functionCall",
      name: "SUM",
      args: [
        { type: "fieldRef", key: "a" },
        { type: "fieldRef", key: "b" },
      ],
    });
  });

  it("should parse nested IF", () => {
    const ast = parseFormula('IF({ status } = "done", 1, 0)');
    expect(ast.type).toBe("functionCall");
    expect(ast).toMatchObject({ name: "IF" });
    expect((ast as unknown as { args: unknown[] }).args).toHaveLength(3);
  });

  it("should respect operator precedence (multiply before add)", () => {
    const ast = parseFormula("{ a } + { b } * { c }");
    expect(ast.type).toBe("binaryOp");
    expect((ast as unknown as { op: string }).op).toBe("+");
    expect((ast as unknown as { right: AstNode }).right.type).toBe("binaryOp");
    expect((ast as unknown as { right: AstNode }).right.op).toBe("*");
  });

  it("should parse parenthesized expression", () => {
    const ast = parseFormula("({ a } + { b }) * { c }");
    expect(ast.type).toBe("binaryOp");
    expect((ast as unknown as { op: string }).op).toBe("*");
    expect((ast as unknown as { left: AstNode }).left.type).toBe("binaryOp");
    expect((ast as unknown as { left: AstNode }).left.op).toBe("+");
  });

  it("should parse unary minus", () => {
    const ast = parseFormula("-{ a }");
    expect(ast).toMatchObject({
      type: "unaryOp",
      op: "-",
      operand: { type: "fieldRef", key: "a" },
    });
  });

  it("should throw on empty formula", () => {
    expect(() => parseFormula("")).toThrow();
  });

  it("should throw on trailing tokens", () => {
    expect(() => parseFormula("{ a } { b }")).toThrow();
  });
});
