/**
 * LinkCard Component
 *
 * This component displays a link card with metadata (title, description, image, URL, tag).
 * It handles missing metadata gracefully and adapts to light / dark mode.
 * Pressing the card opens the URL, long pressing navigates to the edit screen.
 */

import React, { useState, useEffect, useRef, memo, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { LinkData } from "../types/link";
import { fetchLinkMetadata } from "../services/metadata";
import { updateLink } from "../services/storage";
import { Theme, radius, useThemedStyles } from "../utils/theme";

/**
 * Navigation param types
 */
type RootStackParamList = {
  Home: undefined;
  EditLink: {
    linkData: LinkData;
  };
};

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

/** Card body height (px) */
export const LINK_CARD_HEIGHT = 92;
/** Vertical margin around each card (px) */
export const LINK_CARD_MARGIN = 5;
/** Total row height used for FlatList.getItemLayout */
export const LINK_ROW_HEIGHT = LINK_CARD_HEIGHT + LINK_CARD_MARGIN * 2;

/**
 * URLs whose metadata fetch was already attempted this session.
 * Prevents refetching (and re-hitting slow sites) every time a virtualized
 * row remounts while scrolling.
 */
const attemptedMetadataUrls = new Set<string>();

/**
 * Props for the LinkCard component
 *
 * @property linkData - The link data object containing URL and metadata
 * @property index - The index of the link in the list
 * @property folderName - Optional folder name to display (if link is assigned to a folder)
 * @property onMetadataFetched - Called after metadata is fetched and stored, so the list can update in place
 */
interface LinkCardProps {
  linkData: LinkData;
  index?: number;
  folderName?: string | null;
  onMetadataFetched?: (url: string, patch: Partial<LinkData>) => void;
}

/**
 * Extracts a display hostname (without "www.") from a URL
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * LinkCard component that displays link metadata in a card format
 *
 * @returns JSX.Element - The rendered link card component
 */
const LinkCardComponent: React.FC<LinkCardProps> = ({
  linkData,
  folderName,
  onMetadataFetched,
}) => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { theme, styles } = useThemedStyles(createStyles);
  const displayImageUri =
    linkData.image ||
    (Array.isArray(linkData.sharedImages) && linkData.sharedImages.length > 0
      ? linkData.sharedImages[0]
      : null);
  const hostname = useMemo(() => getHostname(linkData.url), [linkData.url]);
  const [imageErrored, setImageErrored] = useState<boolean>(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState<boolean>(false);
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const onMetadataFetchedRef = useRef(onMetadataFetched);
  onMetadataFetchedRef.current = onMetadataFetched;

  // Reset image state when the image changes (e.g. after metadata arrives)
  useEffect(() => {
    setImageErrored(false);
    imageOpacity.setValue(0);
  }, [displayImageUri, imageOpacity]);

  /**
   * Automatically fetches metadata when card renders if metadataFetched is false
   */
  useEffect(() => {
    if (linkData.metadataFetched || attemptedMetadataUrls.has(linkData.url)) {
      return;
    }
    attemptedMetadataUrls.add(linkData.url);
    let isMounted = true;

    const fetchMetadataIfNeeded = async () => {
      try {
        setIsFetchingMetadata(true);
        const fetchedMetadata = await fetchLinkMetadata(linkData.url);
        const patch: Partial<LinkData> = {
          // Keep values parsed from the shared text when the page has none
          title: fetchedMetadata.title || linkData.title,
          description: fetchedMetadata.description || linkData.description,
          image: fetchedMetadata.image || linkData.image,
          tag: fetchedMetadata.tag || linkData.tag,
          metadataFetched: true,
        };

        // Update the link in storage with fetched metadata
        await updateLink(linkData.url, patch);
        onMetadataFetchedRef.current?.(linkData.url, patch);
      } catch (error) {
        // Log error but don't block card display
        console.error("Error fetching metadata for card:", error);
      } finally {
        if (isMounted) setIsFetchingMetadata(false);
      }
    };

    fetchMetadataIfNeeded();
    return () => {
      isMounted = false;
    };
  }, [linkData.url, linkData.metadataFetched]);

  /**
   * Handles opening the URL when the card is pressed
   */
  const handlePress = async () => {
    try {
      await Linking.openURL(linkData.url);
    } catch (error) {
      console.error("Error opening URL:", error);
      Alert.alert("Error", "Failed to open URL");
    }
  };

  /**
   * Handles navigation to edit screen when the card is long pressed
   */
  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    navigation.navigate("EditLink", {
      linkData,
    });
  };

  const animatePress = (toValue: number) => {
    Animated.spring(pressScale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const showImage = !!displayImageUri && !imageErrored;

  return (
    <Animated.View
      style={[styles.cardWrapper, { transform: [{ scale: pressScale }] }]}
    >
      <Pressable
        style={styles.card}
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={() => animatePress(0.97)}
        onPressOut={() => animatePress(1)}
        delayLongPress={350}
        android_ripple={{ color: theme.primarySoft }}
        accessibilityRole="link"
        accessibilityHint="Opens the link. Long press to edit."
      >
        {/* Content Section - Left Side */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {linkData.title || hostname}
          </Text>

          {linkData.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {linkData.description}
            </Text>
          ) : isFetchingMetadata ? (
            <Text style={styles.description} numberOfLines={1}>
              Fetching details…
            </Text>
          ) : null}

          {/* Hostname, tag and folder badges */}
          <View style={styles.metaRow}>
            <Text style={styles.hostname} numberOfLines={1}>
              {hostname}
            </Text>
            {linkData.tag ? (
              <View style={styles.tagContainer}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {linkData.tag}
                </Text>
              </View>
            ) : null}
            {folderName ? (
              <View style={styles.folderContainer}>
                <Text style={styles.folderText} numberOfLines={1}>
                  {folderName}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Image Section - Right Side */}
        <View style={styles.imageContainer}>
          {showImage ? (
            <Animated.Image
              source={{ uri: displayImageUri }}
              style={[styles.image, { opacity: imageOpacity }]}
              resizeMode="cover"
              onLoad={() =>
                Animated.timing(imageOpacity, {
                  toValue: 1,
                  duration: 220,
                  useNativeDriver: true,
                }).start()
              }
              onError={() => setImageErrored(true)}
            />
          ) : (
            <Text style={styles.placeholderLetter}>
              {hostname.charAt(0).toUpperCase()}
            </Text>
          )}
          {isFetchingMetadata && (
            <View style={styles.imageLoaderOverlay}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

export const LinkCard = memo(LinkCardComponent);

/**
 * Styles for the LinkCard component
 */
function createStyles(theme: Theme) {
  return StyleSheet.create({
    cardWrapper: {
      marginHorizontal: 16,
      marginVertical: LINK_CARD_MARGIN,
      height: LINK_CARD_HEIGHT,
      borderRadius: radius.md,
      backgroundColor: theme.card,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.isDark ? 0 : 0.06,
      shadowRadius: 6,
      elevation: theme.isDark ? 0 : 2,
      borderWidth: theme.isDark ? StyleSheet.hairlineWidth : 0,
      borderColor: theme.border,
    },
    card: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingRight: 10,
      paddingLeft: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 2,
    },
    description: {
      fontSize: 13,
      color: theme.textMuted,
      marginBottom: 6,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      overflow: "hidden",
    },
    hostname: {
      flexShrink: 1,
      fontSize: 12,
      color: theme.textSubtle,
    },
    imageContainer: {
      width: 72,
      height: 72,
      borderRadius: radius.sm,
      backgroundColor: theme.placeholderBg,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    image: {
      ...StyleSheet.absoluteFillObject,
    },
    placeholderLetter: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.textSubtle,
    },
    imageLoaderOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    tagContainer: {
      backgroundColor: theme.primarySoft,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      maxWidth: 110,
    },
    tagText: {
      fontSize: 11,
      color: theme.primary,
      fontWeight: "600",
    },
    folderContainer: {
      backgroundColor: theme.placeholderBg,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      maxWidth: 110,
    },
    folderText: {
      fontSize: 11,
      color: theme.textMuted,
      fontWeight: "600",
    },
  });
}
