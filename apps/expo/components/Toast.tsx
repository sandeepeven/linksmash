/**
 * Toast Component
 *
 * This component displays a toast notification at the bottom center of the screen.
 * It automatically dismisses after a specified duration and can show an optional
 * action button (e.g. "Undo").
 *
 * Use <ToastProvider> once near the root and call `useToast().show(...)` anywhere.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Text, StyleSheet, Animated, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, radius, useThemedStyles } from "../utils/theme";

/**
 * Props for the Toast component
 *
 * @property message - The message to display in the toast
 * @property visible - Whether the toast is visible
 * @property onDismiss - Callback function called when toast is dismissed
 * @property duration - Duration in milliseconds before auto-dismiss (default: 3000)
 * @property actionLabel - Optional action button label
 * @property onAction - Callback when the action button is pressed
 * @property bottomOffset - Extra distance from the bottom edge
 */
interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  bottomOffset?: number;
}

/**
 * Toast component that displays a message at the bottom center
 *
 * @returns JSX.Element - The rendered toast component
 */
export const Toast: React.FC<ToastProps> = ({
  message,
  visible,
  onDismiss,
  duration = 3000,
  actionLabel,
  onAction,
  bottomOffset = 20,
}) => {
  const { styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState<boolean>(visible);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
      }).start();

      // Auto-dismiss after duration
      const timer = setTimeout(() => onDismissRef.current(), duration);
      return () => clearTimeout(timer);
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return undefined;
  }, [visible, duration, message, anim]);

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      style={[
        styles.container,
        {
          bottom: insets.bottom + bottomOffset,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [40, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.card}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <TouchableOpacity
            onPress={onAction}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text style={styles.action}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
};

/**
 * Options accepted by `useToast().show`
 */
interface ShowToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastContextValue {
  show: (message: string, options?: ShowToastOptions) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => undefined,
  hide: () => undefined,
});

/**
 * Hosts a single app-wide toast. Render once near the root.
 */
export const ToastProvider: React.FC<{
  children: React.ReactNode;
  bottomOffset?: number;
}> = ({ children, bottomOffset = 84 }) => {
  const [state, setState] = useState<{
    message: string;
    visible: boolean;
    options: ShowToastOptions;
  }>({ message: "", visible: false, options: {} });

  const hide = useCallback(() => {
    setState((current) => ({ ...current, visible: false }));
  }, []);

  const show = useCallback(
    (message: string, options: ShowToastOptions = {}) => {
      setState({ message, visible: true, options });
    },
    []
  );

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        message={state.message}
        visible={state.visible}
        onDismiss={hide}
        duration={state.options.duration ?? (state.options.onAction ? 5000 : 2500)}
        actionLabel={state.options.actionLabel}
        onAction={
          state.options.onAction
            ? () => {
                hide();
                state.options.onAction?.();
              }
            : undefined
        }
        bottomOffset={bottomOffset}
      />
    </ToastContext.Provider>
  );
};

/**
 * Access the app-wide toast
 */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

/**
 * Styles for the Toast component
 */
function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      left: 16,
      right: 16,
      alignItems: "center",
      zIndex: 1000,
      elevation: 10,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      maxWidth: 520,
      backgroundColor: theme.toastBg,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    message: {
      flexShrink: 1,
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "500",
    },
    action: {
      color: "#7db8ff",
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
