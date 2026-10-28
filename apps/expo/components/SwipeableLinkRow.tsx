/**
 * SwipeableLinkRow Component
 *
 * Wraps a LinkCard with swipe actions (share on the left, delete on the right).
 * Uses ReanimatedSwipeable so the swipe runs on the UI thread and stays smooth
 * even while JS is busy (e.g. fetching metadata).
 */

import React, { memo, useCallback, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinkData } from "../types/link";
import { LinkCard, LINK_CARD_HEIGHT, LINK_CARD_MARGIN } from "./LinkCard";
import { Theme, radius, useThemedStyles } from "../utils/theme";

/**
 * Width (px) a row slides when an action is revealed. Includes the 16px outer
 * gutter, so the button itself is 76px with a 16px gap to the card.
 */
const ACTION_WIDTH = 92;

interface SwipeableLinkRowProps {
  linkData: LinkData;
  folderName?: string | null;
  onDelete: (link: LinkData) => void;
  onShare: (link: LinkData) => void;
  onMetadataFetched?: (url: string, patch: Partial<LinkData>) => void;
}

interface SwipeActionProps {
  label: string;
  color: string;
  progress: SharedValue<number>;
  side: "left" | "right";
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

/**
 * A single swipe action button that scales/fades in with the swipe progress
 */
const SwipeAction: React.FC<SwipeActionProps> = ({
  label,
  color,
  progress,
  side,
  onPress,
  styles,
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1], "clamp") }],
  }));

  return (
    <Animated.View
      style={[
        styles.actionContainer,
        side === "left" ? styles.actionLeft : styles.actionRight,
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: color }]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.actionText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const SwipeableLinkRowComponent: React.FC<SwipeableLinkRowProps> = ({
  linkData,
  folderName,
  onDelete,
  onShare,
  onMetadataFetched,
}) => {
  const { theme, styles } = useThemedStyles(createStyles);
  const swipeableRef = useRef<SwipeableMethods | null>(null);

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
    swipeableRef.current?.close();
    onDelete(linkData);
  }, [linkData, onDelete]);

  const handleShare = useCallback(() => {
    swipeableRef.current?.close();
    onShare(linkData);
  }, [linkData, onShare]);

  const renderLeftActions = useCallback(
    (progress: SharedValue<number>) => (
      <SwipeAction
        label="Share"
        color={theme.primary}
        progress={progress}
        side="left"
        onPress={handleShare}
        styles={styles}
      />
    ),
    [handleShare, styles, theme.primary]
  );

  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => (
      <SwipeAction
        label="Delete"
        color={theme.danger}
        progress={progress}
        side="right"
        onPress={handleDelete}
        styles={styles}
      />
    ),
    [handleDelete, styles, theme.danger]
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={1.6}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={() =>
        Haptics.selectionAsync().catch(() => {})
      }
    >
      <LinkCard
        linkData={linkData}
        folderName={folderName}
        onMetadataFetched={onMetadataFetched}
      />
    </ReanimatedSwipeable>
  );
};

export const SwipeableLinkRow = memo(SwipeableLinkRowComponent);

function createStyles(theme: Theme) {
  return StyleSheet.create({
    actionContainer: {
      width: ACTION_WIDTH,
      height: LINK_CARD_HEIGHT,
      marginVertical: LINK_CARD_MARGIN,
    },
    actionLeft: {
      paddingLeft: 16,
    },
    actionRight: {
      paddingRight: 16,
    },
    actionButton: {
      flex: 1,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    actionText: {
      color: theme.onPrimary,
      fontWeight: "700",
      fontSize: 15,
    },
  });
}
