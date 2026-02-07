/**
 * Theme Utility
 *
 * This file provides a shared theme creation utility to avoid duplication
 * across components. It creates theme objects based on the color scheme.
 */

import { useColorScheme } from "react-native";

/**
 * Theme interface defining all theme colors
 */
export interface Theme {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  chipBg: string;
  chipBorder: string;
  chipSelectedBg: string;
  chipSelectedBorder: string;
  errorBg: string;
}

/**
 * Creates a theme object based on the color scheme
 *
 * @param isDarkMode - Whether dark mode is enabled
 * @returns Theme - The theme object with all color values
 */
export function createTheme(isDarkMode: boolean): Theme {
  return {
    background: isDarkMode ? "#0b0b0c" : "#ffffff",
    surface: isDarkMode ? "#161718" : "#ffffff",
    text: isDarkMode ? "#f2f4f7" : "#000000",
    textMuted: isDarkMode ? "#c7c9ce" : "#666666",
    border: isDarkMode ? "#2a2c2f" : "#e0e0e0",
    chipBg: isDarkMode ? "#232527" : "#f2f4f7",
    chipBorder: isDarkMode ? "#34363a" : "#d0d5dd",
    chipSelectedBg: "#0066cc",
    chipSelectedBorder: "#004a99",
    errorBg: "#ff4444",
  };
}

/**
 * Hook to get the current theme based on system color scheme
 *
 * @returns Theme - The current theme object
 */
export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  return createTheme(isDarkMode);
}

