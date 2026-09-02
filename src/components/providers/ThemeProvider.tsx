"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Stage 10a — theming scaffold for the shadcn primitives.
 *
 * Stage 10 ships LIGHT ONLY: `forcedTheme="light"` pins the `light` class on
 * <html> and ignores system preference / localStorage, so none of the `.dark`
 * token blocks in shadcn-tokens.css can activate. The provider is here (rather
 * than adding it later) purely so a future dark mode is a one-line change:
 * drop `forcedTheme` and add a toggle.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
