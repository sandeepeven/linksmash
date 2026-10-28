/**
 * SafeAreaWrapper Component
 *
 * Provides a consistent safe-area-aware container across the application.
 * This ensures content respects device status bars, notches, and navigation areas.
 */

import React from "react";
import { StyleSheet, ViewProps, StyleProp, ViewStyle } from "react-native";
import {
  SafeAreaView,
  SafeAreaViewProps,
} from "react-native-safe-area-context";
import { useTheme } from "../utils/theme";

/**
 * Props for the SafeAreaWrapper component
 *
 * @property children - React children to render inside the safe area
 * @property style - Optional style override for the container
 * @property edges - Safe-area edges to pad. Screens with a native header should
 *                   omit "top" (the header already handles it).
 */
interface SafeAreaWrapperProps extends SafeAreaViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * SafeAreaWrapper component
 *
 * Wraps content inside a SafeAreaView with sensible defaults for the app.
 *
 * @param children - The content to display within the safe area
 * @param style - Optional style overrides for the container
 * @param rest - Additional SafeAreaView props
 * @returns JSX.Element
 */
export const SafeAreaWrapper: React.FC<SafeAreaWrapperProps> = ({
  children,
  style,
  ...rest
}) => {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }, style]}
      edges={["top", "bottom", "left", "right"]}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
};

/**
 * Styles for the SafeAreaWrapper component
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export type { SafeAreaWrapperProps };
