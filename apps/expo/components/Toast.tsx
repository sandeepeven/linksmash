/**
 * Toast Component
 *
 * This component displays a toast notification at the bottom center of the screen.
 * It automatically dismisses after a specified duration.
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet, Animated, useColorScheme } from "react-native";

/**
 * Props for the Toast component
 *
 * @property message - The message to display in the toast
 * @property visible - Whether the toast is visible
 * @property onDismiss - Callback function called when toast is dismissed
 * @property duration - Duration in milliseconds before auto-dismiss (default: 3000)
 */
interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

/**
 * Toast component that displays a message at the bottom center
 *
 * @param message - The message to display
 * @param visible - Whether the toast is visible
 * @param onDismiss - Callback when toast is dismissed
 * @param duration - Auto-dismiss duration in milliseconds
 * @returns JSX.Element - The rendered toast component
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  visible,
  onDismiss,
  duration = 3000,
}) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible, duration]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible && fadeAnim._value === 0) {
    return null;
  }

  const theme = {
    background: isDarkMode ? "#2a2c2f" : "#333333",
    text: "#ffffff",
  };

  const styles = createStyles(theme);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

/**
 * Styles for the Toast component
 */
function createStyles(theme: { background: string; text: string }) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 20,
      left: 16,
      right: 16,
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      zIndex: 1000,
    },
    message: {
      color: theme.text,
      fontSize: 14,
      textAlign: "center",
    },
  });
}

