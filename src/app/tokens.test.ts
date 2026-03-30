import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const TOKENS_FILE = path.resolve(process.cwd(), "src/app/tokens.css");

describe("theme tokens", () => {
  it("defines semantic colors required by UI surfaces", () => {
    const tokensCss = readFileSync(TOKENS_FILE, "utf8");

    expect(tokensCss).toContain("--color-primary:");
    expect(tokensCss).toContain("--color-primary-foreground:");
    expect(tokensCss).toContain("--color-secondary:");
    expect(tokensCss).toContain("--color-secondary-foreground:");
    expect(tokensCss).toContain("--color-destructive:");
    expect(tokensCss).toContain("--color-destructive-foreground:");
    expect(tokensCss).toContain("--color-input:");
    expect(tokensCss).toContain("--color-popover:");
    expect(tokensCss).toContain("--color-popover-foreground:");
    expect(tokensCss).toContain("--color-muted:");
    expect(tokensCss).toContain("--color-muted-foreground:");
    expect(tokensCss).toContain("--color-accent:");
    expect(tokensCss).toContain("--color-accent-foreground:");
    expect(tokensCss).toContain("--color-card:");
    expect(tokensCss).toContain("--color-card-foreground:");
    expect(tokensCss).toContain("--color-ring:");
  });
});
