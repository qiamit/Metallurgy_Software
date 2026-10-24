/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--ui-border))",
        input: "hsl(var(--ui-input))",
        ring: "hsl(var(--ui-ring))",
        background: "hsl(var(--ui-background))",
        foreground: "hsl(var(--ui-foreground))",
        primary: {
          DEFAULT: "hsl(var(--ui-primary))",
          foreground: "hsl(var(--ui-primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--ui-secondary))",
          foreground: "hsl(var(--ui-secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--ui-destructive))",
          foreground: "hsl(var(--ui-destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--ui-muted))",
          foreground: "hsl(var(--ui-muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--ui-accent))",
          foreground: "hsl(var(--ui-accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--ui-popover))",
          foreground: "hsl(var(--ui-popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--ui-card))",
          foreground: "hsl(var(--ui-card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--ui-sidebar))",
          foreground: "hsl(var(--ui-sidebar-foreground))",
          border: "hsl(var(--ui-sidebar-border))",
          accent: "hsl(var(--ui-sidebar-accent))",
          "accent-foreground": "hsl(var(--ui-sidebar-accent-foreground))",
          muted: "hsl(var(--ui-sidebar-muted))",
          ring: "hsl(var(--ui-sidebar-ring))",
        },
        success: {
          DEFAULT: "hsl(var(--ui-success))",
          foreground: "hsl(var(--ui-success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--ui-warning))",
          foreground: "hsl(var(--ui-warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--ui-info))",
          foreground: "hsl(var(--ui-info-foreground))",
        },
      },
      boxShadow: {
        soft: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)",
        card: "0 4px 6px -1px rgb(15 23 42 / 0.05), 0 2px 4px -2px rgb(13 148 136 / 0.06)",
      },
      /* Metallurgy Lab uses square corners everywhere */
      borderRadius: {
        DEFAULT: "var(--ui-radius)",
        sm: "var(--ui-radius)",
        md: "var(--ui-radius)",
        lg: "var(--ui-radius)",
        xl: "var(--ui-radius)",
        "2xl": "var(--ui-radius)",
        "3xl": "var(--ui-radius)",
        full: "var(--ui-radius)",
      },
      fontFamily: {
        sans: ['"DM Sans"', "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        jakarta: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
