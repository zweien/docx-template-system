import { describe, expect, it } from "vitest";
import { tokenize, TokenType } from "./tokenizer";

describe("tokenize", () => {
  it("should tokenize a simple field reference", () => {
    const tokens = tokenize("{ price }");
    expect(tokens).toEqual([
      { type: "FIELD_REF", value: "price" },
    ]);
  });

  it("should tokenize arithmetic expression", () => {
    const tokens = tokenize("{ price } * { quantity }");
    expect(tokens).toEqual([
      { type: "FIELD_REF", value: "price" },
      { type: "OPERATOR", value: "*" },
      { type: "FIELD_REF", value: "quantity" },
    ]);
  });

  it("should tokenize function call", () => {
    const tokens = tokenize("SUM({ a }, { b })");
    expect(tokens).toEqual([
      { type: "FUNCTION", value: "SUM" },
      { type: "LPAREN", value: "(" },
      { type: "FIELD_REF", value: "a" },
      { type: "COMMA", value: "," },
      { type: "FIELD_REF", value: "b" },
      { type: "RPAREN", value: ")" },
    ]);
  });

  it("should tokenize IF with string literal", () => {
    const tokens = tokenize('IF({ status } = "done", 1, 0)');
    expect(tokens).toContainEqual({ type: "FUNCTION", value: "IF" });
    expect(tokens).toContainEqual({ type: "STRING", value: "done" });
    expect(tokens).toContainEqual({ type: "NUMBER", value: "1" });
  });

  it("should tokenize Chinese field names", () => {
    const tokens = tokenize("{ 单价 } * { 数量 }");
    expect(tokens).toContainEqual({ type: "FIELD_REF", value: "单价" });
    expect(tokens).toContainEqual({ type: "FIELD_REF", value: "数量" });
  });

  it("should tokenize comparison operators", () => {
    const tokens = tokenize("{ a } != { b }");
    expect(tokens).toContainEqual({ type: "COMPARISON", value: "!=" });
  });

  it("should tokenize string concatenation with &", () => {
    const tokens = tokenize('{ a } & "!"');
    expect(tokens).toContainEqual({ type: "AMPERSAND", value: "&" });
    expect(tokens).toContainEqual({ type: "STRING", value: "!" });
  });

  it("should throw on unrecognized character", () => {
    expect(() => tokenize("{ a } @ { b }")).toThrow();
  });

  it("should handle empty input", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("should tokenize nested parentheses", () => {
    const tokens = tokenize("(({ a }))");
    expect(tokens.filter(t => t.type === "LPAREN")).toHaveLength(2);
    expect(tokens.filter(t => t.type === "RPAREN")).toHaveLength(2);
  });
});
