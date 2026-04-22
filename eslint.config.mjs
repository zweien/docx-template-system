import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore third-party and generated code
    "node_modules/**",
    ".claude/worktrees/**",
    "scripts/**",
    "packages/idrl-ui/**",
  ]),
  {
    rules: {
      // Allow unused variables that start with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Disable problematic react-hooks rules that conflict with valid patterns
      "react-hooks/set-state-in-effect": "off",
      // Enforce LinkButton for navigation-style buttons.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name='Button'] > JSXAttribute[name.name='render'] JSXOpeningElement[name.name='Link']",
          message:
            "不要使用 `Button render={<Link .../>}`。请改用 `LinkButton`，以统一处理 `nativeButton={false}` 并避免控制台语义错误。",
        },
      ],
    },
  },
  {
    files: ["src/components/ui/button.tsx"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]);

export default eslintConfig;
