import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "var(--color-primary-50)",
          100: "var(--color-primary-100)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
          900: "var(--color-primary-900)",
        },
        neutral: {
          50: "var(--color-neutral-50)",
          100: "var(--color-neutral-100)",
          200: "var(--color-neutral-200)",
          300: "var(--color-neutral-300)",
          400: "var(--color-neutral-400)",
          500: "var(--color-neutral-500)",
          600: "var(--color-neutral-600)",
          700: "var(--color-neutral-700)",
          800: "var(--color-neutral-800)",
          900: "var(--color-neutral-900)",
        },
        border: "var(--color-border)",
        "border-hover": "var(--color-border-hover)",
        background: "var(--color-background)",
        "background-subtle": "var(--color-background-subtle)",
        foreground: "var(--color-text-primary)",
        "foreground-secondary": "var(--color-text-secondary)",
        "foreground-muted": "var(--color-text-muted)",
        "primary-foreground": "#ffffff",
        secondary: "var(--color-neutral-100)",
        "secondary-foreground": "var(--color-neutral-700)",
        muted: "var(--color-neutral-100)",
        "muted-foreground": "var(--color-neutral-600)",
        destructive: "var(--color-error)",
        "destructive-foreground": "#ffffff",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        info: "var(--color-info)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      spacing: {
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        md: "var(--spacing-md)",
        lg: "var(--spacing-lg)",
        xl: "var(--spacing-xl)",
        "2xl": "var(--spacing-2xl)",
      },
    },
  },
};

export default config;