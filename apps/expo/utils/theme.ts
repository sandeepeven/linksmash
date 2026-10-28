/**
 * Theme Utility
 *
 * This file provides a shared theme creation utility to avoid duplication
 * across components. It creates theme objects based on the color scheme.
 */

import { useMemo } from "react";
import { useColorScheme } from "react-native";

/**
 * Theme interface defining all theme colors
 */
export interface Theme {
  isDark: boolean;
  background: string;
  surface: string;
  card: string;
  inputBg: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  chipBg: string;
  chipBorder: string;
  chipSelectedBg: string;
  chipSelectedBorder: string;
  errorBg: string;
  danger: string;
  toastBg: string;
  backdrop: string;
  placeholderBg: string;
  shadow: string;
}

/**
 * Shared spacing / radius scale so screens line up visually
 */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

/**
 * Creates a theme object based on the color scheme
 *
 * @param isDarkMode - Whether dark mode is enabled
 * @returns Theme - The theme object with all color values
 */
export function createTheme(isDarkMode: boolean): Theme {
  const primary = isDarkMode ? "#4c9dff" : "#0a66d8";
  return {
    isDark: isDarkMode,
    background: isDarkMode ? "#0b0b0c" : "#f4f5f7",
    surface: isDarkMode ? "#141516" : "#ffffff",
    card: isDarkMode ? "#1b1c1e" : "#ffffff",
    inputBg: isDarkMode ? "#1f2023" : "#eef0f3",
    text: isDarkMode ? "#f2f4f7" : "#101114",
    textMuted: isDarkMode ? "#a9adb4" : "#5d6370",
    textSubtle: isDarkMode ? "#70747c" : "#9298a3",
    border: isDarkMode ? "#2a2c2f" : "#e3e5e9",
    primary,
    primarySoft: isDarkMode ? "rgba(76,157,255,0.16)" : "rgba(10,102,216,0.1)",
    onPrimary: "#ffffff",
    chipBg: isDarkMode ? "#1f2023" : "#ffffff",
    chipBorder: isDarkMode ? "#34363a" : "#dde0e5",
    chipSelectedBg: primary,
    chipSelectedBorder: primary,
    errorBg: isDarkMode ? "#d93a3a" : "#e5484d",
    danger: isDarkMode ? "#d93a3a" : "#e5484d",
    toastBg: isDarkMode ? "#2a2c2f" : "#1f2023",
    backdrop: "rgba(0, 0, 0, 0.45)",
    placeholderBg: isDarkMode ? "#232528" : "#eef0f3",
    shadow: "#000000",
  };
}

/**
 * Hook to get the current theme based on system color scheme
 *
 * @returns Theme - The current theme object (memoized per color scheme)
 */
export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  return useMemo(() => createTheme(isDarkMode), [isDarkMode]);
}

/**
 * Hook that builds a theme-aware StyleSheet once per color scheme instead of
 * on every render.
 *
 * @param factory - Function creating styles from a theme (define it at module scope)
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): {
  theme: Theme;
  styles: T;
} {
  const theme = useTheme();
  const styles = useMemo(() => factory(theme), [factory, theme]);
  return { theme, styles };
}
