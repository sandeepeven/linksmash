/**
 * LinkCard Component
 *
 * This component displays a link card with metadata (title, description, image, URL, tag).
 * It handles missing metadata gracefully and is styled for a white background.
 * Pressing the card opens the URL, long pressing navigates to the edit screen.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  useColorScheme,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinkData } from "../types/link";
import { fetchLinkMetadata } from "../services/metadata";
import { updateLink } from "../services/storage";

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

/**
 * Props for the LinkCard component
 *
 * @property linkData - The link data object containing URL and metadata
 * @property index - The index of the link in the list (used for navigation)
 */
interface LinkCardProps {
  linkData: LinkData;
  index: number;
}

/**
 * LinkCard component that displays link metadata in a card format
 *
 * @param linkData - The link data object containing URL and metadata
 * @param index - The index of the link in the list
 * @returns JSX.Element - The rendered link card component
 */
export const LinkCard: React.FC<LinkCardProps> = ({ linkData, index }) => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const displayImageUri =
    linkData.image ||
    (Array.isArray(linkData.sharedImages) && linkData.sharedImages.length > 0
      ? linkData.sharedImages[0]
      : null);
  const [imageLoading, setImageLoading] = useState<boolean>(!!displayImageUri);
  const [imageErrored, setImageErrored] = useState<boolean>(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState<boolean>(false);
  const fetchInProgressRef = useRef<boolean>(false);

  /**
   * Automatically fetches metadata when card renders if metadataFetched is false
   */
  useEffect(() => {
    const fetchMetadataIfNeeded = async () => {
      // Only fetch if metadata hasn't been fetched yet and we're not already fetching
      if (!linkData.metadataFetched && !fetchInProgressRef.current) {
        fetchInProgressRef.current = true;
        try {
          setIsFetchingMetadata(true);
          const fetchedMetadata = await fetchLinkMetadata(linkData.url);

          // Update the link in storage with fetched metadata
          await updateLink(linkData.url, {
            title: fetchedMetadata.title,
            description: fetchedMetadata.description,
            image: fetchedMetadata.image,
            tag: fetchedMetadata.tag,
            metadataFetched: true,
          });
        } catch (error) {
          // Log error but don't block card display
          console.error("Error fetching metadata for card:", error);
        } finally {
          setIsFetchingMetadata(false);
          fetchInProgressRef.current = false;
        }
      }
    };

    fetchMetadataIfNeeded();
  }, [linkData.url, linkData.metadataFetched]);

  /**
   * Handles opening the URL when the card is pressed
   */
  const handlePress = async () => {
    try {
      const url = linkData.url;
      await Linking.openURL(url);
    } catch (error) {
      console.error("Error opening URL:", error);
      Alert.alert("Error", "Failed to open URL");
    }
  };

  /**
   * Handles navigation to edit screen when the card is long pressed
   */
  const handleLongPress = () => {
    navigation.navigate("EditLink", {
      linkData,
    });
  };

  const cardStyle = [styles.card, isDarkMode && styles.cardDark];

  const titleStyle = [styles.title, isDarkMode && styles.titleDark];

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      {/* Content Section - Left Side */}
      <View style={styles.content}>
        {/* Metadata Fetching Loader */}
        {isFetchingMetadata && (
          <View style={styles.metadataLoaderContainer}>
            <ActivityIndicator size="small" color="#0066cc" />
          </View>
        )}

        {linkData.title ? (
          <Text style={titleStyle} numberOfLines={1} ellipsizeMode="tail">
            {linkData.title}
          </Text>
        ) : null}

        {linkData.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {linkData.description}
          </Text>
        ) : null}

        {/* Tag Badge */}
        {linkData.tag && (
          <View style={styles.tagContainer}>
            <Text style={styles.tagText}>{linkData.tag}</Text>
          </View>
        )}
      </View>

      {/* Image Section - Right Side */}
      {displayImageUri ? (
        <View style={styles.imageContainer}>
          {imageLoading && (
            <View style={styles.imageLoaderOverlay}>
              <ActivityIndicator size="small" color="#0066cc" />
            </View>
          )}
          {!imageErrored && (
            <Image
              source={{ uri: displayImageUri }}
              style={styles.image}
              resizeMode="contain"
              onLoadEnd={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageErrored(true);
              }}
            />
          )}
          {imageErrored && (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>No image</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>No image</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

/**
 * Styles for the LinkCard component
 */
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 0,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: "hidden",
    flexDirection: "row",
    height: 80,
    position: "relative",
  },
  cardDark: {
    backgroundColor: "#000000",
    borderWidth: 2,
    borderColor: "rgb(0, 255, 0)",
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  title: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000000",
    marginBottom: 4,
  },
  titleDark: {
    color: "#ffffff",
  },
  description: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 6,
    lineHeight: 10,
  },
  imageContainer: {
    width: 100,
    height: "100%",
    backgroundColor: "#f0f0f0",
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
  },
  imageLoaderOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  imagePlaceholder: {
    width: 100,
    height: "100%",
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#999999",
    fontSize: 11,
  },
  tagContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#0066cc",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    color: "#ffffff",
    fontWeight: "600",
  },
  metadataLoaderContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
  },
});
