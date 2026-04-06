import { describe, expect, it } from "vitest";
import { evaluateFormula } from "./evaluator";

describe("evaluateFormula", () => {
  const data = { price: 10, quantity: 3, name: "Test", score: 85, active: true };

  it("should evaluate field reference", () => {
    expect(evaluateFormula("{ price }", data)).toBe(10);
  });

  it("should evaluate arithmetic", () => {
    expect(evaluateFormula("{ price } * { quantity }", data)).toBe(30);
  });

  it("should evaluate SUM function", () => {
    expect(evaluateFormula("SUM({ price }, { quantity }, 5)", data)).toBe(18);
  });

  it("should evaluate AVERAGE function", () => {
    expect(evaluateFormula("AVERAGE({ price }, { quantity })", data)).toBe(6.5);
  });

  it("should evaluate IF function (true branch)", () => {
    expect(evaluateFormula('IF({ score } > 60, "pass", "fail")', data)).toBe("pass");
  });

  it("should evaluate IF function (false branch)", () => {
    expect(evaluateFormula('IF({ score } < 60, "pass", "fail")', { ...data, score: 90 })).toBe("fail");
  });

  it("should evaluate CONCAT", () => {
    expect(evaluateFormula('CONCAT({ name }, "!", "OK")', data)).toBe("Test!OK");
  });

  it("should evaluate ROUND", () => {
    expect(evaluateFormula("ROUND(10 / 3, 2)", data)).toBe(3.33);
  });

  it("should return #REF for missing field", () => {
    expect(evaluateFormula("{ nonexistent }", data)).toBe("#REF");
  });

  it("should return #DIV/0 for division by zero", () => {
    expect(evaluateFormula("{ price } / 0", data)).toBe("#DIV/0");
  });

  it("should evaluate string concat with &", () => {
    expect(evaluateFormula('{ name } & " OK"', data)).toBe("Test OK");
  });

  it("should evaluate LEN", () => {
    expect(evaluateFormula("LEN({ name })", data)).toBe(4);
  });

  it("should evaluate AND", () => {
    expect(evaluateFormula("AND({ active }, { score } > 60)", data)).toBe(true);
  });

  it("should evaluate OR", () => {
    expect(evaluateFormula("OR({ active }, { score } < 60)", data)).toBe(true);
  });

  it("should evaluate NOT", () => {
    expect(evaluateFormula("NOT({ active })", data)).toBe(false);
  });
});
