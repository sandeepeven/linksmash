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

/**
 * Props for the SafeAreaWrapper component
 *
 * @property children - React children to render inside the safe area
 * @property style - Optional style override for the container
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
  return (
    <SafeAreaView
      style={[styles.container, style]}
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
    backgroundColor: "#ffffff",
  },
});

export type { SafeAreaWrapperProps };
